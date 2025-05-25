import {
	type Mint,
	createTokenIfMissing,
	fetchMint,
	findAssociatedTokenPda,
	setComputeUnitPrice,
	transferSol,
	transferTokens,
} from "@metaplex-foundation/mpl-toolbox";
import {
	type PublicKey,
	type Signer,
	type TransactionBuilder,
	type TransactionBuilderItemsInput,
	type Umi,
	publicKey,
	sol,
	transactionBuilder,
} from "@metaplex-foundation/umi";
import { base58 } from "@metaplex-foundation/umi/serializers";

// Constants for transaction limits and configuration
const MAX_SPL_TRANSFERS = 10;
const MAX_SOL_TRANSFERS = 256;
const DEFAULT_COMPUTE_UNIT_PRICE = 2_500_000;
const LOW_COMPUTE_UNIT_PRICE = 2_000_000;
const SOL_MINT_ADDRESS = "11111111111111111111111111111111"; // Native SOL mint

// Global mint info cache to reduce redundant network calls
const mintInfoCache = new Map<string, Mint>();

/**
 * Result type for transfer operations
 */
export type TransferResult<T = string> = {
	data?: T;
	error?: string;
	success: boolean;
};

/**
 * Enhanced error handling for transfer operations
 */
export class TransferError extends Error {
	constructor(
		message: string,
		public readonly code?: string,
		public readonly details?: unknown,
	) {
		super(message);
		this.name = "TransferError";
	}
}

/**
 * Utility functions for common operations
 */
const TransferUtils = {
	/**
	 * Validates a public key string
	 */
	isValidPublicKey(key: string): boolean {
		try {
			publicKey(key);
			return true;
		} catch {
			return false;
		}
	},

	/**
	 * Validates transfer amount
	 */
	isValidAmount(amount: number): boolean {
		return Number.isFinite(amount) && amount > 0;
	},

	/**
	 * Gets or fetches mint info with caching
	 */
	async getMintInfo(umi: Umi, mint: string): Promise<Mint> {
		if (mint === SOL_MINT_ADDRESS) {
			throw new TransferError("SOL mint does not have mint info");
		}

		const cached = mintInfoCache.get(mint);
		if (cached) {
			return cached;
		}

		try {
			const mintInfo = await fetchMint(umi, publicKey(mint));
			mintInfoCache.set(mint, mintInfo);
			return mintInfo;
		} catch (error) {
			throw new TransferError(
				`Failed to fetch mint info for ${mint}`,
				"MINT_FETCH_ERROR",
				error,
			);
		}
	},

	/**
	 * Converts human-readable amount to raw amount based on decimals
	 */
	toRawAmount(humanAmount: number, decimals: number): bigint {
		return BigInt(Math.round(humanAmount * 10 ** decimals));
	},

	/**
	 * Creates a standardized error result
	 */
	createErrorResult<T>(message: string, error?: unknown): TransferResult<T> {
		console.error("Transfer Error:", message, error);
		return {
			success: false,
			error: message,
		};
	},

	/**
	 * Creates a success result
	 */
	createSuccessResult<T>(data: T): TransferResult<T> {
		return {
			success: true,
			data,
		};
	},

	/**
	 * Adds compute unit price instruction with proper error handling
	 */
	addComputeUnitPrice(
		builder: TransactionBuilder,
		umi: Umi,
		microLamports: number = DEFAULT_COMPUTE_UNIT_PRICE,
	): TransactionBuilder {
		try {
			return builder.add(setComputeUnitPrice(umi, { microLamports }));
		} catch (error) {
			console.warn("Failed to set compute unit price:", error);
			return builder;
		}
	},

	/**
	 * Executes transaction with proper error handling and retry logic
	 */
	async executeTransaction(
		builder: TransactionBuilder,
		umi: Umi,
		retries = 3,
	): Promise<string> {
		for (let attempt = 1; attempt <= retries; attempt++) {
			try {
				const result = await builder.sendAndConfirm(umi, {
					confirm: { commitment: "finalized" },
				});
				return base58.deserialize(result.signature)[0];
			} catch (error) {
				if (attempt === retries) {
					throw new TransferError(
						`Transaction failed after ${retries} attempts`,
						"TRANSACTION_FAILED",
						error,
					);
				}
				console.warn(
					`Transaction attempt ${attempt} failed, retrying...`,
					error,
				);
				// Add exponential backoff
				await new Promise((resolve) =>
					setTimeout(resolve, 2 ** attempt * 1000),
				);
			}
		}
		throw new TransferError("Unexpected error in transaction execution");
	},
};

/**
 * Enhanced parameters for transferring a single asset
 */
export interface TransferParams {
	recipient: string;
	amount: number; // Human-readable amount
	mint: string; // Mint address, defaults to SOL if "all-1s"
	sourceSigner?: Signer;
	computeUnitPrice?: number; // Optional custom compute unit price
	priority?: "low" | "medium" | "high"; // Transaction priority
}

/**
 * Transfers a single asset (SOL or SPL token) from the source to the recipient.
 * Enhanced with better error handling, validation, and performance optimizations.
 *
 * @param params - The parameters for the transfer
 * @param umi - The Umi instance
 * @returns A promise that resolves to a TransferResult containing the signature or error
 */
export const transferAsset = async (
	params: TransferParams,
	umi: Umi,
): Promise<TransferResult<string>> => {
	const {
		recipient,
		amount,
		mint,
		sourceSigner,
		computeUnitPrice,
		priority = "medium",
	} = params;

	// Enhanced input validation
	if (!recipient) {
		return TransferUtils.createErrorResult("Recipient address is required");
	}
	if (!TransferUtils.isValidPublicKey(recipient)) {
		return TransferUtils.createErrorResult("Invalid recipient address format");
	}
	if (!mint) {
		return TransferUtils.createErrorResult("Mint address is required");
	}
	if (!TransferUtils.isValidPublicKey(mint)) {
		return TransferUtils.createErrorResult("Invalid mint address format");
	}
	if (!TransferUtils.isValidAmount(amount)) {
		return TransferUtils.createErrorResult("Amount must be a positive number");
	}

	try {
		const recipientPublicKey = publicKey(recipient);
		const authority = sourceSigner || umi.identity;
		let builder = transactionBuilder();

		// Determine compute unit price based on priority
		const finalComputeUnitPrice =
			computeUnitPrice ||
			(priority === "high"
				? DEFAULT_COMPUTE_UNIT_PRICE + 1_000_000
				: priority === "low"
					? LOW_COMPUTE_UNIT_PRICE
					: DEFAULT_COMPUTE_UNIT_PRICE);

		if (mint === SOL_MINT_ADDRESS) {
			// SOL Transfer - optimized
			builder = builder.add(
				transferSol(umi, {
					source: authority,
					destination: recipientPublicKey,
					amount: sol(amount),
				}),
			);
		} else {
			// SPL Token Transfer - optimized with caching
			const mintInfo = await TransferUtils.getMintInfo(umi, mint);
			const rawAmount = TransferUtils.toRawAmount(amount, mintInfo.decimals);
			const mintPublicKey = publicKey(mint);

			// Derive ATAs
			const sourceATA = findAssociatedTokenPda(umi, {
				mint: mintPublicKey,
				owner: authority.publicKey,
			});
			const destinationATA = findAssociatedTokenPda(umi, {
				mint: mintPublicKey,
				owner: recipientPublicKey,
			});

			// Create destination ATA if missing
			builder = builder.add(
				createTokenIfMissing(umi, {
					mint: mintPublicKey,
					owner: recipientPublicKey,
					token: destinationATA,
				}),
			);

			// Add token transfer
			builder = builder.add(
				transferTokens(umi, {
					source: sourceATA,
					destination: destinationATA,
					amount: rawAmount,
					authority: authority,
				}),
			);
		}

		// Add compute unit price
		builder = TransferUtils.addComputeUnitPrice(
			builder,
			umi,
			finalComputeUnitPrice,
		);

		// Validate transaction has instructions
		if (builder.items.length === 0) {
			return TransferUtils.createErrorResult(
				"No transfer instructions generated",
			);
		}

		// Execute transaction with retry logic
		const signature = await TransferUtils.executeTransaction(builder, umi);
		return TransferUtils.createSuccessResult(signature);
	} catch (error) {
		if (error instanceof TransferError) {
			return TransferUtils.createErrorResult(error.message, error);
		}
		return TransferUtils.createErrorResult(
			`Unexpected error during transfer: ${error instanceof Error ? error.message : String(error)}`,
			error,
		);
	}
};

/**
 * Enhanced information for a single recipient in a one-to-many transfer
 */
export interface RecipientInfo {
	address: string;
	amount: number; // Human-readable amount
}

/**
 * Enhanced parameters for transferring one asset to multiple recipients
 */
export interface TransferOneToManyParams {
	mint: string; // The mint address of the asset to transfer
	recipients: RecipientInfo[]; // Array of recipients and amounts
	sourceSigner?: Signer; // Optional signer for the source account
	batchSize?: number; // Custom batch size for transaction splitting
	computeUnitPrice?: number; // Custom compute unit price
	priority?: "low" | "medium" | "high"; // Transaction priority
}

/**
 * Enhanced batch processor for one-to-many transfers
 */
class BatchTransferProcessor {
	private builder = transactionBuilder();
	private signatures: string[] = [];
	private readonly batchSize: number;
	private readonly umi: Umi;
	private readonly computeUnitPrice: number;

	constructor(
		umi: Umi,
		batchSize: number = MAX_SPL_TRANSFERS,
		computeUnitPrice: number = DEFAULT_COMPUTE_UNIT_PRICE,
	) {
		this.umi = umi;
		this.batchSize = batchSize;
		this.computeUnitPrice = computeUnitPrice;
	}

	addInstruction(instruction: TransactionBuilderItemsInput): void {
		this.builder = this.builder.add(instruction);
	}

	async flushIfNeeded(): Promise<void> {
		if (this.builder.items.length >= this.batchSize) {
			await this.flush();
		}
	}

	async flush(): Promise<void> {
		if (this.builder.items.length === 0) return;

		this.builder = TransferUtils.addComputeUnitPrice(
			this.builder,
			this.umi,
			this.computeUnitPrice,
		);

		const signature = await TransferUtils.executeTransaction(
			this.builder,
			this.umi,
		);
		this.signatures.push(signature);
		this.builder = transactionBuilder();
	}

	async finalFlush(): Promise<string[]> {
		await this.flush();
		return this.signatures;
	}
}

/**
 * Transfers a single asset (SOL or SPL token) from one source to multiple recipients.
 * Enhanced with better batching, error handling, and performance optimizations.
 *
 * @param params - The parameters for the one-to-many transfer
 * @param umi - The Umi instance
 * @returns A promise that resolves to a TransferResult containing signatures or error
 */
export const transferOneAssetToMany = async (
	params: TransferOneToManyParams,
	umi: Umi,
): Promise<TransferResult<string[]>> => {
	const {
		mint,
		recipients,
		sourceSigner,
		batchSize = MAX_SPL_TRANSFERS,
		computeUnitPrice,
		priority = "medium",
	} = params;

	// Enhanced validation
	if (!mint) {
		return TransferUtils.createErrorResult("Mint address is required");
	}
	if (!TransferUtils.isValidPublicKey(mint)) {
		return TransferUtils.createErrorResult("Invalid mint address format");
	}
	if (!recipients || recipients.length === 0) {
		return TransferUtils.createErrorResult("No recipients provided");
	}

	// Validate all recipients upfront
	const invalidRecipients = recipients.filter(
		(r) =>
			!r.address ||
			!TransferUtils.isValidPublicKey(r.address) ||
			!TransferUtils.isValidAmount(r.amount),
	);
	if (invalidRecipients.length > 0) {
		return TransferUtils.createErrorResult(
			`Invalid recipients found: ${invalidRecipients.length} out of ${recipients.length}`,
		);
	}

	const authority = sourceSigner || umi.identity;
	const isSOL = mint === SOL_MINT_ADDRESS;

	// Determine compute unit price
	const finalComputeUnitPrice =
		computeUnitPrice ||
		(priority === "high"
			? DEFAULT_COMPUTE_UNIT_PRICE + 1_000_000
			: priority === "low"
				? LOW_COMPUTE_UNIT_PRICE
				: DEFAULT_COMPUTE_UNIT_PRICE);

	try {
		const processor = new BatchTransferProcessor(
			umi,
			batchSize,
			finalComputeUnitPrice,
		);
		let mintInfo: Mint | undefined;

		// Pre-fetch mint info for SPL tokens
		if (!isSOL) {
			mintInfo = await TransferUtils.getMintInfo(umi, mint);
		}

		const mintPublicKey = publicKey(mint);
		let processedCount = 0;

		for (const recipient of recipients) {
			try {
				const recipientPublicKey = publicKey(recipient.address);
				const humanAmount = recipient.amount;

				if (isSOL) {
					processor.addInstruction(
						transferSol(umi, {
							source: authority,
							destination: recipientPublicKey,
							amount: sol(humanAmount),
						}),
					);
				} else {
					if (!mintInfo) {
						throw new TransferError(
							"Mint info not available for SPL token transfer",
						);
					}

					const rawAmount = TransferUtils.toRawAmount(
						humanAmount,
						mintInfo.decimals,
					);

					// Derive ATAs
					const sourceATA = findAssociatedTokenPda(umi, {
						mint: mintPublicKey,
						owner: authority.publicKey,
					});
					const destinationATA = findAssociatedTokenPda(umi, {
						mint: mintPublicKey,
						owner: recipientPublicKey,
					});

					// Create destination ATA
					processor.addInstruction(
						createTokenIfMissing(umi, {
							mint: mintPublicKey,
							owner: recipientPublicKey,
							token: destinationATA,
						}),
					);

					// Add transfer instruction
					processor.addInstruction(
						transferTokens(umi, {
							source: sourceATA,
							destination: destinationATA,
							amount: rawAmount,
							authority: authority,
						}),
					);
				}

				processedCount++;
				await processor.flushIfNeeded();
			} catch (error) {
				console.warn(
					`Failed to process recipient ${recipient.address}:`,
					error instanceof Error ? error.message : String(error),
				);
				// Continue processing other recipients
			}
		}

		const signatures = await processor.finalFlush();

		if (signatures.length === 0) {
			return TransferUtils.createErrorResult(
				"No successful transfers completed",
			);
		}

		console.log(
			`Successfully processed ${processedCount} out of ${recipients.length} recipients`,
		);
		return TransferUtils.createSuccessResult(signatures);
	} catch (error) {
		if (error instanceof TransferError) {
			return TransferUtils.createErrorResult(error.message, error);
		}
		return TransferUtils.createErrorResult(
			`Unexpected error during batch transfer: ${error instanceof Error ? error.message : String(error)}`,
			error,
		);
	}
};

/**
 * Enhanced information for a single source in a many-to-one transfer
 */
export interface SourceInfo {
	signer: Signer; // Each source must provide their own signer
	amount: number; // Human-readable amount
}

/**
 * Enhanced parameters for transferring one asset from multiple sources to one recipient
 */
export interface TransferManyToOneParams {
	mint: string; // The mint address of the asset to transfer
	sources: SourceInfo[]; // Array of sources, their signers, and amounts
	destination: string; // The recipient's address
	batchSize?: number; // Custom batch size
	computeUnitPrice?: number; // Custom compute unit price
	priority?: "low" | "medium" | "high"; // Transaction priority
}

/**
 * Transfers a single asset (SOL or SPL token) from multiple sources to one recipient.
 * Each source must sign the transaction for their respective transfer.
 * Enhanced with better validation, batching, and error handling.
 *
 * @param params - The parameters for the many-to-one transfer
 * @param umi - The Umi instance
 * @returns A promise that resolves to a TransferResult containing signatures or error
 */
export const transferOneAssetManyToOne = async (
	params: TransferManyToOneParams,
	umi: Umi,
): Promise<TransferResult<string[]>> => {
	const {
		mint,
		sources,
		destination,
		batchSize = MAX_SPL_TRANSFERS,
		computeUnitPrice,
		priority = "medium",
	} = params;

	// Enhanced validation
	if (!mint) {
		return TransferUtils.createErrorResult("Mint address is required");
	}
	if (!TransferUtils.isValidPublicKey(mint)) {
		return TransferUtils.createErrorResult("Invalid mint address format");
	}
	if (!destination) {
		return TransferUtils.createErrorResult("Destination address is required");
	}
	if (!TransferUtils.isValidPublicKey(destination)) {
		return TransferUtils.createErrorResult(
			"Invalid destination address format",
		);
	}
	if (!sources || sources.length === 0) {
		return TransferUtils.createErrorResult("No sources provided");
	}

	// Validate all sources upfront
	const invalidSources = sources.filter(
		(s) => !s.signer || !TransferUtils.isValidAmount(s.amount),
	);
	if (invalidSources.length > 0) {
		return TransferUtils.createErrorResult(
			`Invalid sources found: ${invalidSources.length} out of ${sources.length}`,
		);
	}

	const isSOL = mint === SOL_MINT_ADDRESS;
	const mintPublicKey = publicKey(mint);
	const destinationPublicKey = publicKey(destination);

	// Determine compute unit price
	const finalComputeUnitPrice =
		computeUnitPrice ||
		(priority === "high"
			? DEFAULT_COMPUTE_UNIT_PRICE + 1_000_000
			: priority === "low"
				? LOW_COMPUTE_UNIT_PRICE
				: DEFAULT_COMPUTE_UNIT_PRICE);

	try {
		const processor = new BatchTransferProcessor(
			umi,
			batchSize,
			finalComputeUnitPrice,
		);
		let mintInfo: Mint | undefined;

		// Pre-fetch mint info and create destination ATA for SPL tokens
		if (!isSOL) {
			mintInfo = await TransferUtils.getMintInfo(umi, mint);

			// Create destination ATA once for all transfers
			const destinationATA = findAssociatedTokenPda(umi, {
				mint: mintPublicKey,
				owner: destinationPublicKey,
			});

			processor.addInstruction(
				createTokenIfMissing(umi, {
					mint: mintPublicKey,
					owner: destinationPublicKey,
					token: destinationATA,
				}),
			);
		}

		let processedCount = 0;

		for (const sourceInfo of sources) {
			try {
				const { signer, amount: humanAmount } = sourceInfo;

				if (isSOL) {
					processor.addInstruction(
						transferSol(umi, {
							source: signer,
							destination: destinationPublicKey,
							amount: sol(humanAmount),
						}),
					);
				} else {
					if (!mintInfo) {
						throw new TransferError(
							"Mint info not available for SPL token transfer",
						);
					}

					const rawAmount = TransferUtils.toRawAmount(
						humanAmount,
						mintInfo.decimals,
					);

					// Derive source ATA
					const sourceATA = findAssociatedTokenPda(umi, {
						mint: mintPublicKey,
						owner: signer.publicKey,
					});
					const destinationATA = findAssociatedTokenPda(umi, {
						mint: mintPublicKey,
						owner: destinationPublicKey,
					});

					// Add transfer instruction
					processor.addInstruction(
						transferTokens(umi, {
							source: sourceATA,
							destination: destinationATA,
							amount: rawAmount,
							authority: signer,
						}),
					);
				}

				processedCount++;
				await processor.flushIfNeeded();
			} catch (error) {
				console.warn(
					`Failed to process source ${sourceInfo.signer.publicKey}:`,
					error instanceof Error ? error.message : String(error),
				);
				// Continue processing other sources
			}
		}

		const signatures = await processor.finalFlush();

		if (signatures.length === 0) {
			return TransferUtils.createErrorResult(
				"No successful transfers completed",
			);
		}

		console.log(
			`Successfully processed ${processedCount} out of ${sources.length} sources`,
		);
		return TransferUtils.createSuccessResult(signatures);
	} catch (error) {
		if (error instanceof TransferError) {
			return TransferUtils.createErrorResult(error.message, error);
		}
		return TransferUtils.createErrorResult(
			`Unexpected error during many-to-one transfer: ${error instanceof Error ? error.message : String(error)}`,
			error,
		);
	}
};

/**
 * Enhanced asset transfer detail for many-to-many transfers
 */
export interface AssetTransferDetail {
	mint: string; // Mint address of the asset to transfer (SOL or SPL token)
	recipient: string; // Public key of the recipient
	amount: number; // Human-readable amount to transfer
}

/**
 * Enhanced parameters for transferring multiple different assets to multiple recipients
 */
export interface TransferManyAssetsToManyRecipientsParams {
	sourceSigner?: Signer; // Optional signer for the source account (defaults to umi.identity)
	transfers: AssetTransferDetail[]; // Array of transfer details
	computeUnitPrice?: number; // Custom compute unit price
	priority?: "low" | "medium" | "high"; // Transaction priority
	validateAllUpfront?: boolean; // Whether to validate all transfers before executing any
}

/**
 * Transfers multiple, potentially different, assets (SOL or SPL tokens) from a single source
 * to multiple recipients. Each transfer in the `transfers` array specifies the mint,
 * recipient, and amount.
 *
 * Enhanced with better validation, performance optimizations, and error handling.
 * This is useful for airdrops or distributions where one entity sends various tokens
 * to different users.
 *
 * @param params - The parameters for the many-assets-to-many-recipients transfer
 * @param umi - The Umi instance
 * @returns A promise that resolves to a TransferResult containing the signature or error
 */
export const transferManyAssetsToManyRecipients = async (
	params: TransferManyAssetsToManyRecipientsParams,
	umi: Umi,
): Promise<TransferResult<string>> => {
	const {
		sourceSigner,
		transfers,
		computeUnitPrice,
		priority = "medium",
		validateAllUpfront = true,
	} = params;

	// Enhanced validation
	if (!transfers || transfers.length === 0) {
		return TransferUtils.createErrorResult("No transfers provided");
	}

	// Validate all transfers upfront if requested
	if (validateAllUpfront) {
		const invalidTransfers = transfers.filter(
			(t) =>
				!t.mint ||
				!t.recipient ||
				!TransferUtils.isValidPublicKey(t.mint) ||
				!TransferUtils.isValidPublicKey(t.recipient) ||
				!TransferUtils.isValidAmount(t.amount),
		);

		if (invalidTransfers.length > 0) {
			return TransferUtils.createErrorResult(
				`Invalid transfers found: ${invalidTransfers.length} out of ${transfers.length}`,
			);
		}
	}

	const authority = sourceSigner || umi.identity;

	// Determine compute unit price
	const finalComputeUnitPrice =
		computeUnitPrice ||
		(priority === "high"
			? DEFAULT_COMPUTE_UNIT_PRICE + 1_000_000
			: priority === "low"
				? LOW_COMPUTE_UNIT_PRICE
				: DEFAULT_COMPUTE_UNIT_PRICE);

	let builder = transactionBuilder();
	const localMintInfoCache = new Map<string, Mint>();

	try {
		let processedCount = 0;

		for (const transfer of transfers) {
			try {
				const { mint, recipient, amount } = transfer;

				// Skip invalid transfers if not validating upfront
				if (
					!validateAllUpfront &&
					(!mint ||
						!recipient ||
						!TransferUtils.isValidAmount(amount) ||
						!TransferUtils.isValidPublicKey(mint) ||
						!TransferUtils.isValidPublicKey(recipient))
				) {
					console.warn("Skipping invalid transfer:", transfer);
					continue;
				}

				const recipientPublicKey = publicKey(recipient);

				if (mint === SOL_MINT_ADDRESS) {
					// SOL Transfer
					builder = builder.add(
						transferSol(umi, {
							source: authority,
							destination: recipientPublicKey,
							amount: sol(amount),
						}),
					);
				} else {
					// SPL Token Transfer with caching
					let mintInfo = localMintInfoCache.get(mint);
					if (!mintInfo) {
						mintInfo = await TransferUtils.getMintInfo(umi, mint);
						localMintInfoCache.set(mint, mintInfo);
					}

					const rawAmount = TransferUtils.toRawAmount(
						amount,
						mintInfo.decimals,
					);
					const mintPublicKey = publicKey(mint);

					const sourceATA = findAssociatedTokenPda(umi, {
						mint: mintPublicKey,
						owner: authority.publicKey,
					});
					const destinationATA = findAssociatedTokenPda(umi, {
						mint: mintPublicKey,
						owner: recipientPublicKey,
					});

					// Create destination ATA
					builder = builder.add(
						createTokenIfMissing(umi, {
							mint: mintPublicKey,
							owner: recipientPublicKey,
							token: destinationATA,
						}),
					);

					// Add transfer
					builder = builder.add(
						transferTokens(umi, {
							source: sourceATA,
							destination: destinationATA,
							amount: rawAmount,
							authority: authority,
						}),
					);
				}

				processedCount++;
			} catch (error) {
				const errorMsg = error instanceof Error ? error.message : String(error);
				console.warn(
					`Failed to process transfer ${JSON.stringify(transfer)}: ${errorMsg}`,
				);

				if (validateAllUpfront) {
					// If validating upfront, fail the entire operation
					return TransferUtils.createErrorResult(
						`Failed to process transfer to ${transfer.recipient}: ${errorMsg}`,
						error,
					);
				}
				// Otherwise continue processing
			}
		}

		if (builder.items.length === 0) {
			return TransferUtils.createErrorResult(
				"No valid transfer instructions generated",
			);
		}

		// Add compute unit price
		builder = TransferUtils.addComputeUnitPrice(
			builder,
			umi,
			finalComputeUnitPrice,
		);

		// Execute transaction
		const signature = await TransferUtils.executeTransaction(builder, umi);

		console.log(
			`Successfully processed ${processedCount} out of ${transfers.length} transfers`,
		);
		return TransferUtils.createSuccessResult(signature);
	} catch (error) {
		if (error instanceof TransferError) {
			return TransferUtils.createErrorResult(error.message, error);
		}
		return TransferUtils.createErrorResult(
			`Unexpected error during multi-asset transfer: ${error instanceof Error ? error.message : String(error)}`,
			error,
		);
	}
};

/**
 * Enhanced asset information for multi-asset transfers to single recipient
 */
export interface AssetToSend {
	mint: string; // Mint address of the asset (SOL or SPL token)
	amount: number; // Human-readable amount to transfer
}

/**
 * Enhanced parameters for transferring multiple different assets to a single recipient
 */
export interface TransferManyAssetsToSingleRecipientParams {
	sourceSigner?: Signer; // Optional signer for the source account (defaults to umi.identity)
	recipient: string; // Public key of the single recipient
	assets: AssetToSend[]; // Array of assets (mint and amount) to transfer
	computeUnitPrice?: number; // Custom compute unit price
	priority?: "low" | "medium" | "high"; // Transaction priority
	validateAllUpfront?: boolean; // Whether to validate all assets before executing
}

/**
 * Transfers multiple, potentially different, assets (SOL or SPL tokens) from a single source
 * to a single recipient. Each asset in the `assets` array specifies the mint and amount.
 *
 * Enhanced with better validation, performance optimizations, and error handling.
 * This is useful for sending a bundle of different tokens to one user.
 *
 * @param params - The parameters for the many-assets-to-single-recipient transfer
 * @param umi - The Umi instance
 * @returns A promise that resolves to a TransferResult containing the signature or error
 */
export const transferManyAssetsToSingleRecipient = async (
	params: TransferManyAssetsToSingleRecipientParams,
	umi: Umi,
): Promise<TransferResult<string>> => {
	const {
		sourceSigner,
		recipient,
		assets,
		computeUnitPrice,
		priority = "medium",
		validateAllUpfront = true,
	} = params;

	// Enhanced validation
	if (!recipient) {
		return TransferUtils.createErrorResult("Recipient address is required");
	}
	if (!TransferUtils.isValidPublicKey(recipient)) {
		return TransferUtils.createErrorResult("Invalid recipient address format");
	}
	if (!assets || assets.length === 0) {
		return TransferUtils.createErrorResult("No assets provided to transfer");
	}

	// Validate all assets upfront if requested
	if (validateAllUpfront) {
		const invalidAssets = assets.filter(
			(a) =>
				!a.mint ||
				!TransferUtils.isValidPublicKey(a.mint) ||
				!TransferUtils.isValidAmount(a.amount),
		);

		if (invalidAssets.length > 0) {
			return TransferUtils.createErrorResult(
				`Invalid assets found: ${invalidAssets.length} out of ${assets.length}`,
			);
		}
	}

	const authority = sourceSigner || umi.identity;
	const recipientPublicKey = publicKey(recipient);

	// Determine compute unit price
	const finalComputeUnitPrice =
		computeUnitPrice ||
		(priority === "high"
			? DEFAULT_COMPUTE_UNIT_PRICE + 1_000_000
			: priority === "low"
				? LOW_COMPUTE_UNIT_PRICE
				: DEFAULT_COMPUTE_UNIT_PRICE);

	let builder = transactionBuilder();
	const localMintInfoCache = new Map<string, Mint>();

	try {
		let processedCount = 0;

		for (const asset of assets) {
			try {
				const { mint, amount } = asset;

				// Skip invalid assets if not validating upfront
				if (
					!validateAllUpfront &&
					(!mint ||
						!TransferUtils.isValidAmount(amount) ||
						!TransferUtils.isValidPublicKey(mint))
				) {
					console.warn("Skipping invalid asset:", asset);
					continue;
				}

				if (mint === SOL_MINT_ADDRESS) {
					// SOL Transfer
					builder = builder.add(
						transferSol(umi, {
							source: authority,
							destination: recipientPublicKey,
							amount: sol(amount),
						}),
					);
				} else {
					// SPL Token Transfer with caching
					let mintInfo = localMintInfoCache.get(mint);
					if (!mintInfo) {
						mintInfo = await TransferUtils.getMintInfo(umi, mint);
						localMintInfoCache.set(mint, mintInfo);
					}

					const rawAmount = TransferUtils.toRawAmount(
						amount,
						mintInfo.decimals,
					);
					const mintPublicKey = publicKey(mint);

					const sourceATA = findAssociatedTokenPda(umi, {
						mint: mintPublicKey,
						owner: authority.publicKey,
					});
					const destinationATA = findAssociatedTokenPda(umi, {
						mint: mintPublicKey,
						owner: recipientPublicKey,
					});

					// Create destination ATA for this specific token
					builder = builder.add(
						createTokenIfMissing(umi, {
							mint: mintPublicKey,
							owner: recipientPublicKey,
							token: destinationATA,
						}),
					);

					// Add the token transfer instruction
					builder = builder.add(
						transferTokens(umi, {
							source: sourceATA,
							destination: destinationATA,
							amount: rawAmount,
							authority: authority,
						}),
					);
				}

				processedCount++;
			} catch (error) {
				const errorMsg = error instanceof Error ? error.message : String(error);
				console.warn(
					`Failed to process asset ${JSON.stringify(asset)}: ${errorMsg}`,
				);

				if (validateAllUpfront) {
					// If validating upfront, fail the entire operation
					return TransferUtils.createErrorResult(
						`Failed to process asset ${asset.mint}: ${errorMsg}`,
						error,
					);
				}
				// Otherwise continue processing
			}
		}

		if (builder.items.length === 0) {
			return TransferUtils.createErrorResult(
				"No valid transfer instructions generated",
			);
		}

		// Add compute unit price
		builder = TransferUtils.addComputeUnitPrice(
			builder,
			umi,
			finalComputeUnitPrice,
		);

		// Execute transaction
		const signature = await TransferUtils.executeTransaction(builder, umi);

		console.log(
			`Successfully processed ${processedCount} out of ${assets.length} assets`,
		);
		return TransferUtils.createSuccessResult(signature);
	} catch (error) {
		if (error instanceof TransferError) {
			return TransferUtils.createErrorResult(error.message, error);
		}
		return TransferUtils.createErrorResult(
			`Unexpected error during multi-asset to single recipient transfer: ${error instanceof Error ? error.message : String(error)}`,
			error,
		);
	}
};

/**
 * Utility function to clear the mint info cache
 * Useful for long-running applications to prevent memory leaks
 */
export const clearMintInfoCache = (): void => {
	mintInfoCache.clear();
};

/**
 * Utility function to get cache statistics
 * Useful for monitoring and debugging
 */
export const getMintInfoCacheStats = (): { size: number; keys: string[] } => {
	return {
		size: mintInfoCache.size,
		keys: Array.from(mintInfoCache.keys()),
	};
};

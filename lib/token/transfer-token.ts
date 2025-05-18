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
	type Signer,
	type Umi,
	publicKey,
	sol,
	transactionBuilder,
} from "@metaplex-foundation/umi";
import { base58 } from "@metaplex-foundation/umi/serializers";

// Maximum number of instructions per transaction to avoid Solana size/compute limits
const MAX_SPL_TRANSFERS = 10;
const MAX_SOL_TRANSFERS = 256;

const SOL_MINT_ADDRESS = "11111111111111111111111111111111"; // Native SOL mint

/**
 * Parameters for transferring a single asset.
 */
interface TransferParams {
	recipient: string;
	amount: number; // Human-readable amount
	mint: string; // Mint address, defaults to SOL if "all-1s"
	sourceSigner?: Signer;
}

/**
 * Transfers a single asset (SOL or SPL token) from the source to the recipient.
 * @param params - The parameters for the transfer.
 * @param umi - The Umi instance.
 * @returns A promise that resolves to an object containing the signature or an error.
 */
export const transferAsset = async (
	params: TransferParams,
	umi: Umi,
): Promise<{ signature?: string; error?: string }> => {
	const { recipient, amount, mint, sourceSigner } = params;

	// Validate input parameters
	if (!recipient || !mint) {
		return { error: "Recipient and mint address are required." };
	}
	if (amount <= 0) {
		return { error: "Amount must be positive." };
	}

	try {
		const mintPublicKey = publicKey(mint);
		const recipientPublicKey = publicKey(recipient);
		// Use the provided sourceSigner or default to umi.identity
		const authority = sourceSigner || umi.identity;

		let builder = transactionBuilder();

		if (mint === SOL_MINT_ADDRESS) {
			// SOL Transfer
			builder = builder.add(
				transferSol(umi, {
					source: authority,
					destination: recipientPublicKey,
					amount: sol(amount), // Umi's sol helper converts human-readable SOL to lamports
				}),
			);
			builder = builder.add(
				setComputeUnitPrice(umi, { microLamports: 2_500_000 }),
			);
		} else {
			// SPL Token Transfer
			const mintInfo = await fetchMint(umi, mintPublicKey);
			// Convert human-readable amount to raw amount based on token decimals
			const rawAmount = BigInt(Math.round(amount * 10 ** mintInfo.decimals));

			// Derive the Associated Token Account (ATA) for the source
			const sourceATA = findAssociatedTokenPda(umi, {
				mint: mintPublicKey,
				owner: authority.publicKey,
			});
			// Derive the Associated Token Account (ATA) for the destination
			const destinationATA = findAssociatedTokenPda(umi, {
				mint: mintPublicKey,
				owner: recipientPublicKey,
			});

			// Ensure the destination ATA is created if it does not exist.
			// createTokenIfMissing is idempotent, meaning it won't fail if the token account already exists.
			builder = builder.add(
				createTokenIfMissing(umi, {
					mint: mintPublicKey,
					owner: recipientPublicKey,
					token: destinationATA, // Explicitly provide the derived ATA
				}),
			);

			// Add the token transfer instruction
			builder = builder.add(
				transferTokens(umi, {
					source: sourceATA,
					destination: destinationATA,
					amount: rawAmount,
					authority: authority, // The authority signing for the source ATA
				}),
			);
			builder = builder.add(
				setComputeUnitPrice(umi, { microLamports: 2_500_000 }),
			);
		}

		// Check if any instructions were added to the builder
		if (builder.items.length === 0) {
			return { error: "No transfer instructions to send." };
		}

		// Send and confirm the transaction
		const result = await builder.sendAndConfirm(umi, {
			confirm: { commitment: "finalized" }, // Wait for finalization
		});
		// Deserialize the signature from Uint8Array to base58 string
		return { signature: base58.deserialize(result.signature)[0] };
	} catch (error: unknown) {
		console.error("Transfer failed:", error);
		const message = error instanceof Error ? error.message : String(error);
		return { error: `Transfer failed: ${message}` };
	}
};

/**
 * Information for a single recipient in a one-to-many transfer.
 */
interface RecipientInfo {
	address: string;
	amount: number; // Human-readable amount
}

/**
 * Parameters for transferring one asset to multiple recipients.
 */
interface TransferOneToManyParams {
	mint: string; // The mint address of the asset to transfer
	recipients: RecipientInfo[]; // Array of recipients and amounts
	sourceSigner?: Signer; // Optional signer for the source account
}

/**
 * Transfers a single asset (SOL or SPL token) from one source to multiple recipients.
 * @param params - The parameters for the one-to-many transfer.
 * @param umi - The Umi instance.
 * @returns A promise that resolves to an object containing the signature or an error.
 */
export const transferOneAssetToMany = async (
	params: TransferOneToManyParams,
	umi: Umi,
): Promise<{ signatures?: string[]; error?: string }> => {
	const { mint, recipients, sourceSigner } = params;
	// Use the provided sourceSigner or default to umi.identity
	const authority = sourceSigner || umi.identity;

	// Validate input parameters
	if (!recipients || recipients.length === 0) {
		return { error: "No recipients provided." };
	}
	if (!mint) {
		return { error: "Mint address is required." };
	}

	let builder = transactionBuilder();
	const signatures: string[] = [];
	const mintPublicKey = publicKey(mint);
	const isSOL = mint === SOL_MINT_ADDRESS;

	let mintInfo: Mint | undefined = undefined; // To store mint info for SPL tokens

	try {
		// Fetch mint info once if it's an SPL token
		if (!isSOL) {
			mintInfo = await fetchMint(umi, mintPublicKey);
			if (!mintInfo) {
				// Should ideally not happen as fetchMint throws on failure
				return { error: "Failed to fetch mint information for SPL token." };
			}
		}

		for (const recipient of recipients) {
			// Validate amount for each recipient
			if (recipient.amount <= 0) {
				console.warn(
					`Skipping recipient ${recipient.address} due to non-positive amount: ${recipient.amount}`,
				);
				continue; // Skip this recipient and proceed to the next
			}
			const recipientPublicKey = publicKey(recipient.address);
			const humanAmount = recipient.amount;

			if (isSOL) {
				builder = builder.add(
					transferSol(umi, {
						source: authority,
						destination: recipientPublicKey,
						amount: sol(humanAmount),
					}),
				);
				builder = builder.add(
					setComputeUnitPrice(umi, { microLamports: 2_500_000 }),
				);
			} else {
				// SPL Token Transfer
				if (!mintInfo) {
					// This case should ideally be caught by the initial fetchMint if not SOL
					return {
						error:
							"Token mint information could not be determined for SPL token transfer.",
					};
				}
				// Convert human-readable amount to raw amount
				const rawAmount = BigInt(
					Math.round(humanAmount * 10 ** mintInfo.decimals),
				);

				// Derive source and destination ATAs
				const sourceATA = findAssociatedTokenPda(umi, {
					mint: mintPublicKey,
					owner: authority.publicKey,
				});
				const destinationATA = findAssociatedTokenPda(umi, {
					mint: mintPublicKey,
					owner: recipientPublicKey,
				});

				// Ensure destination ATA exists
				builder = builder.add(
					createTokenIfMissing(umi, {
						mint: mintPublicKey,
						owner: recipientPublicKey,
						token: destinationATA,
					}),
				);

				// Add SPL token transfer instruction
				builder = builder.add(
					transferTokens(umi, {
						source: sourceATA,
						destination: destinationATA,
						amount: rawAmount,
						authority: authority,
					}),
				);
				builder = builder.add(
					setComputeUnitPrice(umi, { microLamports: 2_500_000 }),
				);
			}
			// Flush if reaching MAX instructions
			if (builder.items.length >= MAX_SPL_TRANSFERS) {
				const res = await builder.sendAndConfirm(umi, {
					confirm: { commitment: "finalized" },
				});
				signatures.push(base58.deserialize(res.signature)[0]);
				builder = transactionBuilder();
			}
		}
		// Final flush for remaining instructions
		if (builder.items.length > 0) {
			const res = await builder.sendAndConfirm(umi, {
				confirm: { commitment: "finalized" },
			});
			signatures.push(base58.deserialize(res.signature)[0]);
		}
		if (signatures.length === 0) {
			return { error: "No valid transfer instructions to send." };
		}
		return { signatures };
	} catch (error: unknown) {
		console.error("Error in transferOneAssetToMany:", error);
		const message = error instanceof Error ? error.message : String(error);
		return {
			error: message || "An unknown error occurred during batch transfer.",
		};
	}
};

/**
 * Information for a single source in a many-to-one transfer.
 */
interface SourceInfo {
	signer: Signer; // Each source must provide their own signer
	amount: number; // Human-readable amount
}

/**
 * Parameters for transferring one asset from multiple sources to one recipient.
 */
interface TransferManyToOneParams {
	mint: string; // The mint address of the asset to transfer
	sources: SourceInfo[]; // Array of sources, their signers, and amounts
	destination: string; // The recipient's address
}

/**
 * Transfers a single asset (SOL or SPL token) from multiple sources to one recipient.
 * Each source must sign the transaction for their respective transfer.
 * @param params - The parameters for the many-to-one transfer.
 * @param umi - The Umi instance.
 * @returns A promise that resolves to an object containing the signature or an error.
 */
export const transferOneAssetManyToOne = async (
	params: TransferManyToOneParams,
	umi: Umi,
): Promise<{ signatures?: string[]; error?: string }> => {
	const { mint, sources, destination } = params;

	// Validate input parameters
	if (!sources || sources.length === 0) {
		return { error: "No sources provided." };
	}
	if (!destination) {
		return { error: "No destination address provided." };
	}
	if (!mint) {
		return { error: "Mint address is required." };
	}

	let builder = transactionBuilder();
	const signatures: string[] = [];
	const mintPublicKey = publicKey(mint);
	const destinationPublicKey = publicKey(destination);
	const isSOL = mint === SOL_MINT_ADDRESS;

	let mintInfo: Mint | undefined = undefined; // To store mint info for SPL tokens

	try {
		// Fetch mint info once if it's an SPL token
		if (!isSOL) {
			mintInfo = await fetchMint(umi, mintPublicKey);
			if (!mintInfo) {
				return { error: "Failed to fetch mint information for SPL token." };
			}
			// For SPL tokens, ensure the destination ATA is created once if there are sources.
			// This is done outside the loop to avoid redundant instructions.
			if (sources.length > 0) {
				// Only create if there are actual sources to send from
				const destinationATA = findAssociatedTokenPda(umi, {
					mint: mintPublicKey,
					owner: destinationPublicKey,
				});
				builder = builder.add(
					createTokenIfMissing(umi, {
						mint: mintPublicKey,
						owner: destinationPublicKey,
						token: destinationATA,
					}),
				);
			}
		}

		for (const sourceInfo of sources) {
			const { signer, amount: humanAmount } = sourceInfo;
			// Validate amount for each source
			if (humanAmount <= 0) {
				console.warn(
					`Skipping source ${signer.publicKey} due to non-positive amount: ${humanAmount}`,
				);
				continue; // Skip this source
			}

			if (isSOL) {
				builder = builder.add(
					transferSol(umi, {
						source: signer,
						destination: destinationPublicKey,
						amount: sol(humanAmount),
					}),
				);
				builder = builder.add(
					setComputeUnitPrice(umi, { microLamports: 2_500_000 }),
				);
			} else {
				// SPL Token Transfer
				if (!mintInfo) {
					// Should be caught by initial fetch if !isSOL
					return {
						error:
							"Token mint information could not be determined for SPL token transfer.",
					};
				}
				// Convert human-readable amount to raw amount
				const rawAmount = BigInt(
					Math.round(humanAmount * 10 ** mintInfo.decimals),
				);

				// Derive source and destination ATAs
				const sourceATA = findAssociatedTokenPda(umi, {
					mint: mintPublicKey,
					owner: signer.publicKey, // Source ATA is owned by the specific signer
				});
				const destinationATA = findAssociatedTokenPda(umi, {
					// Destination ATA is already handled for creation
					mint: mintPublicKey,
					owner: destinationPublicKey,
				});

				// Add SPL token transfer instruction
				builder = builder.add(
					transferTokens(umi, {
						source: sourceATA,
						destination: destinationATA,
						amount: rawAmount,
						authority: signer, // Each source's signer authorizes their part of the transfer
					}),
				);
				builder = builder.add(
					setComputeUnitPrice(umi, { microLamports: 2_500_000 }),
				);
			}
			// Flush batch
			if (builder.items.length >= MAX_SPL_TRANSFERS) {
				const res = await builder.sendAndConfirm(umi, {
					confirm: { commitment: "finalized" },
				});
				signatures.push(base58.deserialize(res.signature)[0]);
				builder = transactionBuilder();
			}
		}
		// Final flush
		if (builder.items.length > 0) {
			const res = await builder.sendAndConfirm(umi, {
				confirm: { commitment: "finalized" },
			});
			signatures.push(base58.deserialize(res.signature)[0]);
		}
		if (signatures.length === 0) {
			return { error: "No valid transfer instructions to send." };
		}
		return { signatures };
	} catch (error: unknown) {
		console.error("Error in transferOneAssetManyToOne:", error);
		const message = error instanceof Error ? error.message : String(error);
		return {
			error: message || "An unknown error occurred during M-to-1 transfer.",
		};
	}
};

/**
 * Describes a single asset transfer operation for many-to-many, including the asset (mint),
 * the recipient, and the amount.
 */
interface AssetTransferDetail {
	mint: string; // Mint address of the asset to transfer (SOL or SPL token)
	recipient: string; // Public key of the recipient
	amount: number; // Human-readable amount to transfer
}

/**
 * Parameters for transferring multiple different assets from a single source
 * to multiple (potentially different) recipients.
 */
interface TransferManyAssetsToManyRecipientsParams {
	sourceSigner?: Signer; // Optional signer for the source account (defaults to umi.identity)
	transfers: AssetTransferDetail[]; // Array of transfer details
}

/**
 * Transfers multiple, potentially different, assets (SOL or SPL tokens) from a single source
 * to multiple recipients. Each transfer in the `transfers` array specifies the mint,
 * recipient, and amount.
 *
 * This is useful for airdrops or distributions where one entity sends various tokens
 * to different users in a single transaction.
 *
 * @param params - The parameters for the many-assets-to-many-recipients transfer.
 * @param umi - The Umi instance.
 * @returns A promise that resolves to an object containing the transaction signature or an error.
 */
export const transferManyAssetsToManyRecipients = async (
	params: TransferManyAssetsToManyRecipientsParams,
	umi: Umi,
): Promise<{ signature?: string; error?: string }> => {
	const { sourceSigner, transfers } = params;

	// Validate input parameters
	if (!transfers || transfers.length === 0) {
		return { error: "No transfers provided." };
	}

	// Use the provided sourceSigner or default to umi.identity as the authority for all transfers
	const authority = sourceSigner || umi.identity;
	let builder = transactionBuilder();
	const mintInfoCache = new Map<string, Mint>(); // Cache for mint information

	try {
		for (const transfer of transfers) {
			const { mint, recipient, amount } = transfer;

			// Validate individual transfer details
			if (!mint || !recipient) {
				console.warn(
					`Skipping a transfer due to missing mint or recipient. Mint: ${mint}, Recipient: ${recipient}`,
				);
				continue;
			}
			if (amount <= 0) {
				console.warn(
					`Skipping transfer of mint ${mint} to ${recipient} due to non-positive amount: ${amount}`,
				);
				continue;
			}

			const recipientPublicKey = publicKey(recipient);
			const mintPublicKey = publicKey(mint);

			if (mint === SOL_MINT_ADDRESS) {
				// SOL Transfer
				builder = builder.add(
					transferSol(umi, {
						source: authority,
						destination: recipientPublicKey,
						amount: sol(amount),
					}),
				);
				builder = builder.add(
					setComputeUnitPrice(umi, { microLamports: 2_500_000 }),
				);
			} else {
				// SPL Token Transfer
				let mintInfo = mintInfoCache.get(mint);
				if (!mintInfo) {
					try {
						mintInfo = await fetchMint(umi, mintPublicKey);
						mintInfoCache.set(mint, mintInfo);
					} catch (fetchError: any) {
						console.error(
							`Failed to fetch mint info for ${mint}: ${fetchError.message || String(fetchError)}`,
						);
						return {
							error: `Failed to fetch mint info for ${mint}: ${fetchError.message || String(fetchError)}`,
						};
					}
				}
				if (!mintInfo) {
					// Safeguard, should be caught by try-catch
					console.error(
						`Mint info for ${mint} is unexpectedly undefined after fetch attempt.`,
					);
					return { error: `Mint info for ${mint} is unexpectedly undefined.` };
				}

				const rawAmount = BigInt(Math.round(amount * 10 ** mintInfo.decimals));

				const sourceATA = findAssociatedTokenPda(umi, {
					mint: mintPublicKey,
					owner: authority.publicKey,
				});
				const destinationATA = findAssociatedTokenPda(umi, {
					mint: mintPublicKey,
					owner: recipientPublicKey,
				});

				builder = builder.add(
					createTokenIfMissing(umi, {
						mint: mintPublicKey,
						owner: recipientPublicKey,
						token: destinationATA,
					}),
				);

				builder = builder.add(
					transferTokens(umi, {
						source: sourceATA,
						destination: destinationATA,
						amount: rawAmount,
						authority: authority,
					}),
				);
				builder = builder.add(
					setComputeUnitPrice(umi, { microLamports: 2_500_000 }),
				);
			}
		}

		if (builder.items.length === 0) {
			return { error: "No valid transfer instructions to send." };
		}

		const result = await builder.sendAndConfirm(umi, {
			confirm: { commitment: "finalized" },
		});
		return { signature: base58.deserialize(result.signature)[0] };
	} catch (error: unknown) {
		console.error("Error in transferManyAssetsToManyRecipients:", error);
		const message = error instanceof Error ? error.message : String(error);
		return {
			error:
				message ||
				"An unknown error occurred during many-assets-to-many-recipients transfer.",
		};
	}
};

/**
 * Describes a single asset to be transferred, including its mint and amount.
 * Used when sending multiple different assets to a single recipient.
 */
interface AssetToSend {
	mint: string; // Mint address of the asset (SOL or SPL token)
	amount: number; // Human-readable amount to transfer
}

/**
 * Parameters for transferring multiple different assets from a single source
 * to a single recipient.
 */
interface TransferManyAssetsToSingleRecipientParams {
	sourceSigner?: Signer; // Optional signer for the source account (defaults to umi.identity)
	recipient: string; // Public key of the single recipient
	assets: AssetToSend[]; // Array of assets (mint and amount) to transfer
}

/**
 * Transfers multiple, potentially different, assets (SOL or SPL tokens) from a single source
 * to a single recipient. Each asset in the `assets` array specifies the mint and amount.
 *
 * This is useful for sending a bundle of different tokens to one user.
 *
 * @param params - The parameters for the many-assets-to-single-recipient transfer.
 * @param umi - The Umi instance.
 * @returns A promise that resolves to an object containing the transaction signature or an error.
 */
export const transferManyAssetsToSingleRecipient = async (
	params: TransferManyAssetsToSingleRecipientParams,
	umi: Umi,
): Promise<{ signature?: string; error?: string }> => {
	const { sourceSigner, recipient, assets } = params;

	// Validate input parameters
	if (!recipient) {
		return { error: "Recipient address is required." };
	}
	if (!assets || assets.length === 0) {
		return { error: "No assets provided to transfer." };
	}

	const authority = sourceSigner || umi.identity;
	const recipientPublicKey = publicKey(recipient);
	let builder = transactionBuilder();
	const mintInfoCache = new Map<string, Mint>(); // Cache for mint information

	try {
		for (const asset of assets) {
			const { mint, amount } = asset;

			// Validate individual asset details
			if (!mint) {
				console.warn(
					`Skipping an asset transfer due to missing mint. Amount: ${amount}`,
				);
				continue;
			}
			if (amount <= 0) {
				console.warn(
					`Skipping transfer of mint ${mint} to ${recipient} due to non-positive amount: ${amount}`,
				);
				continue;
			}

			const mintPublicKey = publicKey(mint);

			if (mint === SOL_MINT_ADDRESS) {
				// SOL Transfer
				builder = builder.add(
					transferSol(umi, {
						source: authority,
						destination: recipientPublicKey,
						amount: sol(amount),
					}),
				);
				builder = builder.add(
					setComputeUnitPrice(umi, { microLamports: 2_000_000 }),
				);
			} else {
				// SPL Token Transfer
				let mintInfo = mintInfoCache.get(mint);
				if (!mintInfo) {
					try {
						mintInfo = await fetchMint(umi, mintPublicKey);
						mintInfoCache.set(mint, mintInfo);
					} catch (fetchError: any) {
						console.error(
							`Failed to fetch mint info for ${mint}: ${fetchError.message || String(fetchError)}`,
						);
						// Fail the entire transaction if any mint info cannot be fetched
						return {
							error: `Failed to fetch mint info for ${mint}: ${fetchError.message || String(fetchError)}`,
						};
					}
				}
				if (!mintInfo) {
					// Safeguard
					console.error(
						`Mint info for ${mint} is unexpectedly undefined after fetch attempt.`,
					);
					return { error: `Mint info for ${mint} is unexpectedly undefined.` };
				}

				const rawAmount = BigInt(Math.round(amount * 10 ** mintInfo.decimals));

				const sourceATA = findAssociatedTokenPda(umi, {
					mint: mintPublicKey,
					owner: authority.publicKey,
				});
				const destinationATA = findAssociatedTokenPda(umi, {
					mint: mintPublicKey,
					owner: recipientPublicKey,
				});

				// Ensure the destination ATA for this specific token exists for the recipient
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
				builder = builder.add(
					setComputeUnitPrice(umi, { microLamports: 2_000_000 }),
				);
			}
		}

		if (builder.items.length === 0) {
			return { error: "No valid transfer instructions to send." };
		}

		const result = await builder.sendAndConfirm(umi, {
			confirm: { commitment: "finalized" },
		});
		return { signature: base58.deserialize(result.signature)[0] };
	} catch (error: unknown) {
		console.error("Error in transferManyAssetsToSingleRecipient:", error);
		const message = error instanceof Error ? error.message : String(error);
		return {
			error:
				message ||
				"An unknown error occurred during many-assets-to-single-recipient transfer.",
		};
	}
};

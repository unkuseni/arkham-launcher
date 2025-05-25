import useUmiStore from "@/store/useUmiStore";
import {
	createTokenIfMissing,
	findAssociatedTokenPda,
	getSplAssociatedTokenProgramId,
	mintTokensTo,
	setComputeUnitPrice,
} from "@metaplex-foundation/mpl-toolbox";
import { TransactionBuilder, publicKey } from "@metaplex-foundation/umi";
import { base58 } from "@metaplex-foundation/umi/serializers";

export interface MintTokensResult {
	signature: string;
	amountMinted: bigint;
	recipientAta: string;
}

export interface MintTokensParams {
	mintAddress: string;
	amount: number;
	recipientAddress?: string;
	computeUnitPrice?: number;
}

export const mintSPLTokens = async ({
	mintAddress,
	amount,
	recipientAddress,
	computeUnitPrice = 2_500_000,
}: MintTokensParams): Promise<MintTokensResult> => {
	// Input validation
	if (!mintAddress?.trim()) {
		throw new Error("Mint address is required");
	}
	if (amount <= 0) {
		throw new Error("Amount must be greater than 0");
	}

	const { umi, signer } = useUmiStore.getState();
	if (!signer) {
		throw new Error("No wallet connected. Please connect your wallet first.");
	}

	try {
		// Convert addresses to public keys
		const mint = publicKey(mintAddress);
		const recipient = recipientAddress
			? publicKey(recipientAddress)
			: signer.publicKey;

		// Find the ATA for the recipient (not signer)
		const recipientAta = findAssociatedTokenPda(umi, {
			mint,
			owner: recipient,
		});

		// Build transaction with proper error handling
		const txBuilder = createTokenIfMissing(umi, {
			mint,
			owner: recipient, // Create ATA for the actual recipient
			ataProgram: getSplAssociatedTokenProgramId(umi),
		})
			.add(
				mintTokensTo(umi, {
					mint,
					token: recipientAta,
					amount: BigInt(amount),
				}),
			)
			.add(
				setComputeUnitPrice(umi, {
					microLamports: computeUnitPrice,
				}),
			);

		// Send and confirm transaction
		const tx = await txBuilder.sendAndConfirm(umi);
		const signature = base58.deserialize(tx.signature)[0];

		return {
			signature,
			amountMinted: BigInt(amount),
			recipientAta: recipientAta[0].toString(),
		};
	} catch (error) {
		// Provide more context in error messages
		if (error instanceof Error) {
			throw new Error(`Failed to mint tokens: ${error.message}`);
		}
		throw new Error("An unexpected error occurred while minting tokens");
	}
};

export interface MintToMultipleRecipient {
	address: string;
	amount: number;
}

export interface MintToMultipleParams {
	mintAddress: string;
	recipients: MintToMultipleRecipient[];
	computeUnitPrice?: number;
}

export interface MintToMultipleResult {
	signature: string;
	totalAmountMinted: bigint;
	recipients: Array<{
		address: string;
		ata: string;
		amountMinted: bigint;
	}>;
	failedRecipients?: Array<{
		address: string;
		error: string;
	}>;
}

/**
 * Mints SPL tokens to multiple recipients in a single transaction
 * @param params MintToMultipleParams
 * @returns Promise<MintToMultipleResult>
 */
export const mintSPLTokensToMultiple = async ({
	mintAddress,
	recipients,
	computeUnitPrice = 2_500_000,
}: MintToMultipleParams): Promise<MintToMultipleResult> => {
	// Input validation
	if (!mintAddress?.trim()) {
		throw new Error("Mint address is required");
	}
	if (!recipients || recipients.length === 0) {
		throw new Error("At least one recipient is required");
	}
	if (recipients.length > 20) {
		throw new Error(
			"Maximum 20 recipients allowed per transaction to avoid size limits",
		);
	}

	// Validate each recipient
	const validRecipients: MintToMultipleRecipient[] = [];
	const failedRecipients: Array<{ address: string; error: string }> = [];

	for (const recipient of recipients) {
		try {
			if (!recipient.address?.trim()) {
				throw new Error("Recipient address is required");
			}
			if (recipient.amount <= 0) {
				throw new Error("Amount must be greater than 0");
			}
			// Test if address is valid by trying to convert it
			publicKey(recipient.address);
			validRecipients.push(recipient);
		} catch (error) {
			failedRecipients.push({
				address: recipient.address || "unknown",
				error:
					error instanceof Error ? error.message : "Invalid recipient data",
			});
		}
	}

	if (validRecipients.length === 0) {
		throw new Error("No valid recipients found");
	}

	const { umi, signer } = useUmiStore.getState();
	if (!signer) {
		throw new Error("No wallet connected. Please connect your wallet first.");
	}

	try {
		const mint = publicKey(mintAddress);
		let txBuilder = new TransactionBuilder();

		// Add compute unit price first
		txBuilder = txBuilder.add(
			setComputeUnitPrice(umi, {
				microLamports: computeUnitPrice,
			}),
		);

		const recipientResults: Array<{
			address: string;
			ata: string;
			amountMinted: bigint;
		}> = [];

		let totalAmount = BigInt(0);

		// Process each recipient
		for (const recipient of validRecipients) {
			const recipientPubkey = publicKey(recipient.address);

			// Find the ATA for this recipient
			const recipientAta = findAssociatedTokenPda(umi, {
				mint,
				owner: recipientPubkey,
			});

			// Create ATA if missing
			txBuilder = txBuilder.add(
				createTokenIfMissing(umi, {
					mint,
					owner: recipientPubkey,
					ataProgram: getSplAssociatedTokenProgramId(umi),
				}),
			);

			// Add mint instruction
			txBuilder = txBuilder.add(
				mintTokensTo(umi, {
					mint,
					token: recipientAta,
					amount: BigInt(recipient.amount),
				}),
			);

			const amountMinted = BigInt(recipient.amount);
			totalAmount += amountMinted;

			recipientResults.push({
				address: recipient.address,
				ata: recipientAta[0].toString(),
				amountMinted,
			});
		}

		// Send and confirm transaction
		const tx = await txBuilder.sendAndConfirm(umi);
		const signature = base58.deserialize(tx.signature)[0];

		const result: MintToMultipleResult = {
			signature,
			totalAmountMinted: totalAmount,
			recipients: recipientResults,
		};

		// Include failed recipients if any
		if (failedRecipients.length > 0) {
			result.failedRecipients = failedRecipients;
		}

		return result;
	} catch (error) {
		if (error instanceof Error) {
			throw new Error(
				`Failed to mint tokens to multiple recipients: ${error.message}`,
			);
		}
		throw new Error(
			"An unexpected error occurred while minting tokens to multiple recipients",
		);
	}
};

/**
 * Utility function to split large recipient lists into batches
 * @param recipients Array of recipients
 * @param batchSize Maximum recipients per batch (default: 15)
 * @returns Array of recipient batches
 */
export const batchRecipients = (
	recipients: MintToMultipleRecipient[],
	batchSize = 15,
): MintToMultipleRecipient[][] => {
	const batches: MintToMultipleRecipient[][] = [];

	for (let i = 0; i < recipients.length; i += batchSize) {
		batches.push(recipients.slice(i, i + batchSize));
	}

	return batches;
};

/**
 * Processes large recipient lists by batching transactions
 * @param params MintToMultipleParams with potentially large recipient list
 * @returns Promise<MintToMultipleResult[]> Array of results for each batch
 */
export const mintSPLTokensToMultipleBatched = async (
	params: MintToMultipleParams,
): Promise<MintToMultipleResult[]> => {
	const batches = batchRecipients(params.recipients);
	const results: MintToMultipleResult[] = [];

	for (let i = 0; i < batches.length; i++) {
		try {
			console.log(
				`Processing batch ${i + 1} of ${batches.length} (${batches[i].length} recipients)`,
			);

			const result = await mintSPLTokensToMultiple({
				...params,
				recipients: batches[i],
			});

			results.push(result);

			// Small delay between batches to avoid rate limiting
			if (i < batches.length - 1) {
				await new Promise((resolve) => setTimeout(resolve, 1000));
			}
		} catch (error) {
			console.error(`Failed to process batch ${i + 1}:`, error);
			// Continue with next batch even if one fails
		}
	}

	return results;
};

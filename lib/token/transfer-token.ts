import {
	createAssociatedToken,
	fetchMint, // Added for ATA creation
	fetchToken,
	findAssociatedTokenPda,
	transferSol,
	transferTokens,
} from "@metaplex-foundation/mpl-toolbox";
import {
	type Signer, // Added for sourceSigner parameter
	type Umi,
	publicKey,
	sol,
	transactionBuilder, // Added for batching transactions
} from "@metaplex-foundation/umi";
import { base58 } from "@metaplex-foundation/umi/serializers";

interface TransferParams {
	recipient: string;
	amount: number; // Human-readable amount
	mint: string; // Defaults to SOL if the “all-1s” address
}

export const transferAsset = async (
	params: TransferParams,
	umi: Umi,
): Promise<string> => {
	const { recipient, amount, mint } = params;
	const mintPublicKey = publicKey(mint);
	const recipientPublicKey = publicKey(recipient);

	const isSOL =
		mint === "1111111111111111111111111111111111111111111111111111111111111111";

	try {
		if (isSOL) {
			const lamports = amount * 1e9;
			const tokenAccount = await fetchToken(umi, mintPublicKey);
			if (tokenAccount.amount < lamports) {
				throw new Error(`Insufficient SOL balance. Required: ${amount} SOL`);
			}
			const tx = transferSol(umi, {
				source: umi.identity,
				destination: recipientPublicKey,
				amount: sol(amount),
			});
			const res = await tx.sendAndConfirm(umi);
			return base58.deserialize(res.signature)[0];
		}
		const sourceATA = findAssociatedTokenPda(umi, {
			mint: mintPublicKey,
			owner: umi.identity.publicKey,
		});
		const destinationATA = findAssociatedTokenPda(umi, {
			mint: mintPublicKey,
			owner: recipientPublicKey,
		});

		const tx = transferTokens(umi, {
			source: sourceATA,
			destination: destinationATA,
			amount: amount,
			authority: umi.identity,
		});
		const res = await tx.sendAndConfirm(umi);
		return base58.deserialize(res.signature)[0];
	} catch (error: any) {
		// Fallback for other errors
		console.log(error);
		throw new Error(`Transfer failed: ${error.message || error}`);
	}
};

// New interface for recipient details in batch transfers
interface RecipientInfo {
	address: string;
	amount: number; // Human-readable amount
}

// New interface for batch transfer parameters
interface TransferOneToManyParams {
	mint: string; // Mint address of the token to transfer
	recipients: RecipientInfo[];
	sourceSigner?: Signer; // Optional: defaults to umi.identity
}

export const transferOneAssetToMany = async (
	params: TransferOneToManyParams,
	umi: Umi,
): Promise<{ signature?: string; error?: string }> => {
	const { mint, recipients, sourceSigner } = params;
	const source = sourceSigner || umi.identity;

	if (!recipients || recipients.length === 0) {
		return { error: "No recipients provided." };
	}

	let builder = transactionBuilder();
	const mintPublicKey = publicKey(mint);
	const isSOL =
		mint === "1111111111111111111111111111111111111111111111111111111111111111";

	let tokenDecimals: number | undefined;

	try {
		if (!isSOL) {
			const tokenInfo = await fetchMint(umi, mintPublicKey);
			tokenDecimals = tokenInfo.decimals;
		}

		for (const recipient of recipients) {
			const recipientPublicKey = publicKey(recipient.address);
			const humanAmount = recipient.amount;

			if (isSOL) {
				builder = builder.add(
					transferSol(umi, {
						source,
						destination: recipientPublicKey,
						amount: sol(humanAmount), // sol() helper converts human amount to SolAmount
					}),
				);
			} else {
				if (typeof tokenDecimals !== "number") {
					return {
						error:
							"Token decimals could not be determined for SPL token transfer.",
					};
				}
				// Convert human-readable amount to raw amount using token decimals
				const rawAmount = BigInt(Math.trunc(humanAmount * 10 ** tokenDecimals));

				const sourceATA = findAssociatedTokenPda(umi, {
					mint: mintPublicKey,
					owner: source.publicKey,
				});
				const destinationATA = findAssociatedTokenPda(umi, {
					mint: mintPublicKey,
					owner: recipientPublicKey,
				});

				// Add instruction to create destination ATA if it doesn't exist
				builder = builder.add(
					createAssociatedToken(umi, {
						mint: mintPublicKey,
						owner: recipientPublicKey,
						payer: source, // Source pays for ATA creation
					}),
				);

				// Add transfer instruction
				builder = builder.add(
					transferTokens(umi, {
						source: sourceATA,
						destination: destinationATA,
						amount: rawAmount,
						authority: source,
					}),
				);
			}
		}

		if (builder.items.length === 0) {
			return { error: "No transfer instructions to send." };
		}

		const result = await builder.sendAndConfirm(umi);
		return { signature: base58.deserialize(result.signature)[0] };
	} catch (e: any) {
		console.error("Error in transferOneAssetToMany:", e);
		return { error: e.message || "An unknown error occurred during transfer." };
	}
};

// Interface for source details in many-to-one transfers
interface SourceInfo {
	signer: Signer; // The signer for the source account
	amount: number; // Human-readable amount to transfer from this source
}

// Interface for many-to-one transfer parameters
interface TransferManyToOneParams {
	mint: string; // Mint address of the token to transfer
	sources: SourceInfo[]; // Array of source signers and their respective amounts
	destination: string; // Public key string of the single recipient
}

export const transferOneAssetManyToOne = async (
	params: TransferManyToOneParams,
	umi: Umi,
): Promise<{ signature?: string; error?: string }> => {
	const { mint, sources, destination } = params;

	if (!sources || sources.length === 0) {
		return { error: "No sources provided." };
	}
	if (!destination) {
		return { error: "No destination address provided." };
	}

	let builder = transactionBuilder();
	const mintPublicKey = publicKey(mint);
	const destinationPublicKey = publicKey(destination);
	const isSOL =
		mint === "1111111111111111111111111111111111111111111111111111111111111111";

	let tokenDecimals: number | undefined;

	try {
		if (!isSOL) {
			const tokenInfo = await fetchMint(umi, mintPublicKey);
			tokenDecimals = tokenInfo.decimals;

			// Instruction to create destination ATA if it doesn't exist (only for SPL tokens)
			// This is added once, assuming the payer for ATA creation will be the first source or a designated fee payer.
			// For simplicity, using the first source as payer. This might need adjustment based on your fee model.
			if (sources.length > 0) {
				builder = builder.add(
					createAssociatedToken(umi, {
						mint: mintPublicKey,
						owner: destinationPublicKey,
						payer: sources[0].signer, // First source pays for ATA creation
					}),
				);
			}
		}

		for (const sourceInfo of sources) {
			const { signer, amount: humanAmount } = sourceInfo;

			if (isSOL) {
				builder = builder.add(
					transferSol(umi, {
						source: signer,
						destination: destinationPublicKey,
						amount: sol(humanAmount), // sol() helper converts human amount to SolAmount
					}),
				);
			} else {
				if (typeof tokenDecimals !== "number") {
					return {
						error:
							"Token decimals could not be determined for SPL token transfer.",
					};
				}
				const rawAmount = BigInt(Math.trunc(humanAmount * 10 ** tokenDecimals));

				const sourceATA = findAssociatedTokenPda(umi, {
					mint: mintPublicKey,
					owner: signer.publicKey,
				});
				const destinationATA = findAssociatedTokenPda(umi, {
					// Destination ATA is the same for all
					mint: mintPublicKey,
					owner: destinationPublicKey,
				});

				builder = builder.add(
					transferTokens(umi, {
						source: sourceATA,
						destination: destinationATA,
						amount: rawAmount,
						authority: signer,
					}),
				);
			}
		}

		if (builder.items.length === 0) {
			return { error: "No transfer instructions to send." };
		}

		const result = await builder.sendAndConfirm(umi);
		return { signature: base58.deserialize(result.signature)[0] };
	} catch (e: any) {
		console.error("Error in transferOneAssetManyToOne:", e);
		return { error: e.message || "An unknown error occurred during transfer." };
	}
};

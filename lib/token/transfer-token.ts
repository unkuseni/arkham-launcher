import {
	type Mint,
	createTokenIfMissing,
	fetchMint,
	findAssociatedTokenPda,
	transferSol,
	transferTokens,
} from "@metaplex-foundation/mpl-toolbox";
import {
	type Signer,
	type Umi,
	generateSigner,
	isPublicKey,
	publicKey,
	sol,
	some,
	transactionBuilder,
} from "@metaplex-foundation/umi";
import { base58 } from "@metaplex-foundation/umi/serializers";

const SOL_MINT_ADDRESS = "11111111111111111111111111111111"; // Native SOL mint

interface TransferParams {
	recipient: string;
	amount: number; // Human-readable amount
	mint: string; // Mint address, defaults to SOL if "all-1s"
	sourceSigner?: Signer;
}

export const transferAsset = async (
	params: TransferParams,
	umi: Umi,
): Promise<{ signature?: string; error?: string }> => {
	const { recipient, amount, mint, sourceSigner } = params;

	if (!recipient || !mint) {
		return { error: "Recipient and mint address are required." };
	}
	if (amount <= 0) {
		return { error: "Amount must be positive." };
	}

	try {
		const mintPublicKey = publicKey(mint);
		const recipientPublicKey = publicKey(recipient);
		const authority = sourceSigner || umi.identity;

		let builder = transactionBuilder();

		if (mint === SOL_MINT_ADDRESS) {
			builder = builder.add(
				transferSol(umi, {
					source: authority,
					destination: recipientPublicKey,
					amount: sol(amount),
				}),
			);
		} else {
			// SPL Token Transfer
			const mintInfo = await fetchMint(umi, mintPublicKey);
			const rawAmount = BigInt(Math.trunc(amount * 10 ** mintInfo.decimals));

			const sourceATA = findAssociatedTokenPda(umi, {
				mint: mintPublicKey,
				owner: authority.publicKey,
			});
			const destinationATA = findAssociatedTokenPda(umi, {
				mint: mintPublicKey,
				owner: recipientPublicKey,
			});

			// Ensure the destination ATA is created if it does not exist.
			// createTokenIfMissing is idempotent.
			builder = builder.add(
				createTokenIfMissing(umi, {
					mint: mintPublicKey,
					owner: recipientPublicKey,
					token: destinationATA, // Explicitly provide the derived ATA
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
		}

		if (builder.items.length === 0) {
			return { error: "No transfer instructions to send." };
		}

		const result = await builder.sendAndConfirm(umi, {
			confirm: { commitment: "finalized" },
		});
		return { signature: base58.deserialize(result.signature)[0] };
	} catch (error: any) {
		console.error("Transfer failed:", error);
		return { error: `Transfer failed: ${error.message || String(error)}` };
	}
};

interface RecipientInfo {
	address: string;
	amount: number; // Human-readable amount
}

interface TransferOneToManyParams {
	mint: string;
	recipients: RecipientInfo[];
	sourceSigner?: Signer;
}

export const transferOneAssetToMany = async (
	params: TransferOneToManyParams,
	umi: Umi,
): Promise<{ signature?: string; error?: string }> => {
	const { mint, recipients, sourceSigner } = params;
	const authority = sourceSigner || umi.identity;

	if (!recipients || recipients.length === 0) {
		return { error: "No recipients provided." };
	}
	if (!mint) {
		return { error: "Mint address is required." };
	}

	let builder = transactionBuilder();
	const mintPublicKey = publicKey(mint);
	const isSOL = mint === SOL_MINT_ADDRESS;

	let mintInfo: Mint;

	try {
		mintInfo = await fetchMint(umi, mintPublicKey);

		for (const recipient of recipients) {
			if (recipient.amount <= 0) {
				console.warn(
					`Skipping recipient ${recipient.address} due to non-positive amount: ${recipient.amount}`,
				);
				continue;
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
			} else {
				if (!mintInfo) {
					return {
						error:
							"Token mint information could not be determined for SPL token transfer.",
					};
				}
				const rawAmount = BigInt(
					Math.trunc(humanAmount * 10 ** mintInfo.decimals),
				);

				const sourceATA = findAssociatedTokenPda(umi, {
					mint: mintPublicKey,
					owner: authority.publicKey,
				});
				const destinationATA = findAssociatedTokenPda(umi, {
					mint: mintPublicKey,
					owner: recipientPublicKey,
				});

				// Ensure the destination ATA is created if it does not exist for each recipient.
				// createTokenIfMissing is idempotent.
				builder = builder.add(
					createTokenIfMissing(umi, {
						mint: mintPublicKey,
						owner: recipientPublicKey,
						token: destinationATA, // Explicitly provide the derived ATA
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
			}
		}

		if (builder.items.length === 0) {
			return { error: "No valid transfer instructions to send." };
		}

		const result = await builder.sendAndConfirm(umi, {
			confirm: { commitment: "finalized" },
		});
		return { signature: base58.deserialize(result.signature)[0] };
	} catch (e: any) {
		console.error("Error in transferOneAssetToMany:", e);
		return {
			error: e.message || "An unknown error occurred during batch transfer.",
		};
	}
};

interface SourceInfo {
	signer: Signer;
	amount: number; // Human-readable amount
}

interface TransferManyToOneParams {
	mint: string;
	sources: SourceInfo[];
	destination: string;
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
	if (!mint) {
		return { error: "Mint address is required." };
	}

	let builder = transactionBuilder();
	const mintPublicKey = publicKey(mint);
	const destinationPublicKey = publicKey(destination);
	const isSOL = mint === SOL_MINT_ADDRESS;

	let mintInfo: Mint;

	try {
		mintInfo = await fetchMint(umi, mintPublicKey);
		if (!isSOL) {
			if (sources.length > 0) {
				const destinationATA = findAssociatedTokenPda(umi, {
					mint: mintPublicKey,
					owner: destinationPublicKey,
				});
				builder = builder.add(
					createTokenIfMissing(umi, {
						mint: mintPublicKey,
						owner: destinationPublicKey,
						token: destinationATA, // Explicitly provide the derived ATA
					}),
				);
			}
		}

		for (const sourceInfo of sources) {
			const { signer, amount: humanAmount } = sourceInfo;
			if (humanAmount <= 0) {
				console.warn(
					`Skipping source ${signer.publicKey} due to non-positive amount: ${humanAmount}`,
				);
				continue;
			}

			if (isSOL) {
				builder = builder.add(
					transferSol(umi, {
						source: signer,
						destination: destinationPublicKey,
						amount: sol(humanAmount),
					}),
				);
			} else {
				if (!mintInfo) {
					return {
						error:
							"Token mint information could not be determined for SPL token transfer.",
					};
				}
				const rawAmount = BigInt(
					Math.trunc(humanAmount * 10 ** mintInfo.decimals),
				);
				const sourceATA = findAssociatedTokenPda(umi, {
					mint: mintPublicKey,
					owner: signer.publicKey,
				});
				const destinationATA = findAssociatedTokenPda(umi, {
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
			return { error: "No valid transfer instructions to send." };
		}

		const result = await builder.sendAndConfirm(umi, {
			confirm: { commitment: "finalized" },
		});
		return { signature: base58.deserialize(result.signature)[0] };
	} catch (e: any) {
		console.error("Error in transferOneAssetManyToOne:", e);
		return {
			error: e.message || "An unknown error occurred during M-to-1 transfer.",
		};
	}
};

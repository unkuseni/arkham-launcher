import useUmiStore from "@/store/useUmiStore";
import {
	TokenStandard,
	burnV1,
	delegateStandardV1,
	fetchAllDigitalAssetByOwner,
	lockV1,
	revokeStandardV1,
	transferV1,
	unlockV1,
} from "@metaplex-foundation/mpl-token-metadata";
import {
	approveTokenDelegate,
	fetchAllTokenByOwner,
	findAssociatedTokenPda,
	revokeTokenDelegate,
	setComputeUnitPrice,
} from "@metaplex-foundation/mpl-toolbox";
import { TransactionBuilder, publicKey } from "@metaplex-foundation/umi";
import { base58 } from "@metaplex-foundation/umi/serializers";
import { Token } from "@raydium-io/raydium-sdk-v2";

export interface DelegateTokenParams {
	/** The mint address of the token to delegate */
	mintAddress: string;
	/** The delegate's public key who will have spending authority */
	delegateAddress: string;
	/** The amount of tokens to delegate (in human-readable format) */
	amount: number;
	/** The owner of the token account (optional, defaults to current wallet) */
	ownerAddress?: string;
	/** Delegate type (optional, defaults to "default") */
	delegateType?: "spl" | "default";
	/** Token standard type (optional, defaults to Token Metadata standard) */
	tokenStandard?: TokenStandard.Fungible | TokenStandard.NonFungible;
}

export interface LockUnlockParams {
	/** The mint address of the token to lock/unlock */
	mintAddress: string;
	/** The owner of the token account (optional, defaults to current wallet) */
	ownerAddress?: string;
}

/**
 * Delegates spending authority for SPL tokens or Token Metadata standard tokens.
 * @param params - The parameters for delegating tokens
 * @returns A promise that resolves to an object containing the transaction signature
 */
export const delegateTokens = async (
	params: DelegateTokenParams,
): Promise<{ signature: string; amountDelegated?: bigint }> => {
	const {
		mintAddress,
		delegateAddress,
		amount,
		ownerAddress,
		delegateType = "default",
		tokenStandard = TokenStandard.Fungible,
	} = params;
	const { umi, signer } = useUmiStore.getState();

	if (!signer) {
		throw new Error("No wallet connected. Please connect your wallet first.");
	}

	// Validate input parameters
	if (!mintAddress) {
		throw new Error("Mint address is required.");
	}
	if (!delegateAddress) {
		throw new Error("Delegate address is required.");
	}
	if (tokenStandard === TokenStandard.Fungible && amount <= 0) {
		throw new Error("Amount must be positive for SPL tokens.");
	}

	try {
		const mint = publicKey(mintAddress);
		const delegate = publicKey(delegateAddress);
		const owner = ownerAddress ? publicKey(ownerAddress) : signer.publicKey;

		let txBuilder: TransactionBuilder;
		let rawAmount: bigint | undefined;

		if (delegateType === "default") {
			// Use Token Metadata delegation for NFTs or Token-2022 standards
			txBuilder = delegateStandardV1(umi, {
				mint,
				tokenOwner: owner,
				authority: signer,
				delegate,
				tokenStandard,
			}).add(setComputeUnitPrice(umi, { microLamports: 2_500_000 }));
		} else {
			// Use standard SPL token delegation
			const tokenAccount = findAssociatedTokenPda(umi, {
				mint,
				owner,
			});

			// Fetch mint info to get decimals
			const { fetchMint } = await import("@metaplex-foundation/mpl-toolbox");
			const mintInfo = await fetchMint(umi, mint);

			// Convert human-readable amount to raw amount based on token decimals
			rawAmount = BigInt(Math.round(amount * 10 ** mintInfo.decimals));

			txBuilder = approveTokenDelegate(umi, {
				source: tokenAccount,
				delegate,
				amount: rawAmount,
				owner: signer,
			}).add(setComputeUnitPrice(umi, { microLamports: 2_500_000 }));
		}

		// Send and confirm the transaction
		const tx = await txBuilder.sendAndConfirm(umi, {
			confirm: { commitment: "finalized" },
		});

		const signature = base58.deserialize(tx.signature)[0];

		console.log("\nToken Delegation Complete");
		if (delegateType === "default") {
			console.log(`Delegated ${amount} tokens to ${delegateAddress}`);
		} else {
			console.log(`Delegated ${tokenStandard} token to ${delegateAddress}`);
		}
		console.log("View Transaction on Solana Explorer");
		console.log(`https://explorer.solana.com/tx/${signature}?cluster=devnet`);

		return {
			signature,
			...(rawAmount && { amountDelegated: rawAmount }),
		};
	} catch (error: unknown) {
		console.error("Delegation failed:", error);
		const message = error instanceof Error ? error.message : String(error);
		throw new Error(`Delegation failed: ${message}`);
	}
};

/**
 * Revokes Standard Delegate authority for Token Metadata standard tokens.
 * @param params - The parameters for revoking standard delegation
 * @returns A promise that resolves to an object containing the transaction signature
 */
export const revokeStandardDelegate = async (params: {
	mintAddress: string;
	ownerAddress?: string;
	standardDelegate: string;
	delegateType?: "spl" | "default";
}): Promise<{ signature: string }> => {
	const { mintAddress, ownerAddress } = params;
	const { umi, signer } = useUmiStore.getState();

	if (!signer) {
		throw new Error("No wallet connected. Please connect your wallet first.");
	}

	try {
		const mint = publicKey(mintAddress);
		const owner = ownerAddress ? publicKey(ownerAddress) : signer.publicKey;
		const delegate = publicKey(params.standardDelegate);

		const tokenAccount = findAssociatedTokenPda(umi, {
			mint,
			owner,
		});

		const txBuilder = new TransactionBuilder();
		if (params.delegateType === "spl") {
			txBuilder.add(
				revokeTokenDelegate(umi, {
					source: tokenAccount,
					owner: signer,
				}).add(setComputeUnitPrice(umi, { microLamports: 2_500_000 })),
			);
		} else {
			txBuilder.add(
				revokeStandardV1(umi, {
					mint,
					tokenOwner: owner,
					authority: signer,
					delegate,
					tokenStandard: TokenStandard.NonFungible,
				}),
			);
		}
		const tx = await txBuilder.sendAndConfirm(umi, {
			confirm: { commitment: "finalized" },
		});

		const signature = base58.deserialize(tx.signature)[0];

		console.log("\nStandard Delegate Revoked");
		console.log("View Transaction on Solana Explorer");
		console.log(`https://explorer.solana.com/tx/${signature}?cluster=devnet`);

		return { signature };
	} catch (error: unknown) {
		console.error("Revoke standard delegate failed:", error);
		const message = error instanceof Error ? error.message : String(error);
		throw new Error(`Revoke standard delegate failed: ${message}`);
	}
};

/**
 * Transfers a Token Metadata standard token using delegate authority.
 * Note: This will revoke the delegate authority after the transfer.
 * @param params - The parameters for delegated transfer
 * @returns A promise that resolves to an object containing the transaction signature
 */
export const delegatedTransfer = async (params: {
	mintAddress: string;
	destinationOwnerAddress: string;
	currentOwnerAddress?: string;
	tokenStandard?: TokenStandard;
}): Promise<{ signature: string }> => {
	const {
		mintAddress,
		destinationOwnerAddress,
		currentOwnerAddress,
		tokenStandard = TokenStandard.Fungible,
	} = params;
	const { umi, signer } = useUmiStore.getState();

	if (!signer) {
		throw new Error("No wallet connected. Please connect your wallet first.");
	}

	// Validate input parameters
	if (!mintAddress) {
		throw new Error("Mint address is required.");
	}
	if (!destinationOwnerAddress) {
		throw new Error("Destination owner address is required.");
	}

	try {
		const mint = publicKey(mintAddress);
		const destinationOwner = publicKey(destinationOwnerAddress);
		const currentOwner = currentOwnerAddress
			? publicKey(currentOwnerAddress)
			: signer.publicKey;

		const txBuilder = transferV1(umi, {
			mint,
			authority: signer, // The delegate authority
			tokenOwner: currentOwner,
			destinationOwner,
			tokenStandard,
		}).add(setComputeUnitPrice(umi, { microLamports: 2_500_000 }));

		const tx = await txBuilder.sendAndConfirm(umi, {
			confirm: { commitment: "finalized" },
		});

		const signature = base58.deserialize(tx.signature)[0];

		console.log("\nDelegated Transfer Complete");
		console.log(
			`Transferred token from ${currentOwner} to ${destinationOwnerAddress}`,
		);
		console.log(
			"Note: Delegate authority has been revoked after this transfer",
		);
		console.log("View Transaction on Solana Explorer");
		console.log(`https://explorer.solana.com/tx/${signature}?cluster=devnet`);

		return { signature };
	} catch (error: unknown) {
		console.error("Delegated transfer failed:", error);
		const message = error instanceof Error ? error.message : String(error);
		throw new Error(`Delegated transfer failed: ${message}`);
	}
};

/**
 * Burns a Token Metadata standard token using delegate authority.
 * @param params - The parameters for delegated burn
 * @returns A promise that resolves to an object containing the transaction signature
 */
export const delegatedBurn = async (params: {
	mintAddress: string;
	tokenOwnerAddress?: string;
	tokenStandard?: TokenStandard;
}): Promise<{ signature: string }> => {
	const {
		mintAddress,
		tokenOwnerAddress,
		tokenStandard = TokenStandard.Fungible,
	} = params;
	const { umi, signer } = useUmiStore.getState();

	if (!signer) {
		throw new Error("No wallet connected. Please connect your wallet first.");
	}

	// Validate input parameters
	if (!mintAddress) {
		throw new Error("Mint address is required.");
	}

	try {
		const mint = publicKey(mintAddress);
		const tokenOwner = tokenOwnerAddress
			? publicKey(tokenOwnerAddress)
			: signer.publicKey;

		const txBuilder = burnV1(umi, {
			mint,
			authority: signer, // The delegate authority
			tokenOwner,
			tokenStandard,
		}).add(setComputeUnitPrice(umi, { microLamports: 2_500_000 }));

		const tx = await txBuilder.sendAndConfirm(umi, {
			confirm: { commitment: "finalized" },
		});

		const signature = base58.deserialize(tx.signature)[0];

		console.log("\nDelegated Burn Complete");
		console.log("Token has been burned using delegate authority");
		console.log("View Transaction on Solana Explorer");
		console.log(`https://explorer.solana.com/tx/${signature}?cluster=devnet`);

		return { signature };
	} catch (error: unknown) {
		console.error("Delegated burn failed:", error);
		const message = error instanceof Error ? error.message : String(error);
		throw new Error(`Delegated burn failed: ${message}`);
	}
};

/**
 * Updated lock function with tokenStandard parameter for consistency
 */
export const lockAsset = async (params: {
	mintAddress: string;
	tokenOwnerAddress?: string;
	tokenStandard?: TokenStandard;
}): Promise<{ signature: string }> => {
	const {
		mintAddress,
		tokenOwnerAddress,
		tokenStandard = TokenStandard.NonFungible,
	} = params;
	const { umi, signer } = useUmiStore.getState();

	if (!signer) {
		throw new Error("No wallet connected. Please connect your wallet first.");
	}

	try {
		const mint = publicKey(mintAddress);
		const tokenOwner = tokenOwnerAddress
			? publicKey(tokenOwnerAddress)
			: signer.publicKey;

		const txBuilder = lockV1(umi, {
			mint,
			authority: signer, // Must be the delegate authority
			tokenOwner,
			tokenStandard,
		}).add(setComputeUnitPrice(umi, { microLamports: 2_500_000 }));

		const tx = await txBuilder.sendAndConfirm(umi, {
			confirm: { commitment: "finalized" },
		});

		const signature = base58.deserialize(tx.signature)[0];

		console.log("\nAsset Locked Successfully");
		console.log(
			"The owner cannot transfer, burn, or revoke delegation until unlocked",
		);
		console.log("View Transaction on Solana Explorer");
		console.log(`https://explorer.solana.com/tx/${signature}?cluster=devnet`);

		return { signature };
	} catch (error: unknown) {
		console.error("Lock asset failed:", error);
		const message = error instanceof Error ? error.message : String(error);
		throw new Error(`Lock asset failed: ${message}`);
	}
};

/**
 * Updated unlock function with tokenStandard parameter for consistency
 */
export const unlockAsset = async (params: {
	mintAddress: string;
	tokenOwnerAddress?: string;
	tokenStandard?: TokenStandard;
}): Promise<{ signature: string }> => {
	const {
		mintAddress,
		tokenOwnerAddress,
		tokenStandard = TokenStandard.NonFungible,
	} = params;
	const { umi, signer } = useUmiStore.getState();

	if (!signer) {
		throw new Error("No wallet connected. Please connect your wallet first.");
	}

	try {
		const mint = publicKey(mintAddress);
		const tokenOwner = tokenOwnerAddress
			? publicKey(tokenOwnerAddress)
			: signer.publicKey;

		const txBuilder = unlockV1(umi, {
			mint,
			authority: signer, // Must be the delegate authority
			tokenOwner,
			tokenStandard,
		}).add(setComputeUnitPrice(umi, { microLamports: 2_500_000 }));

		const tx = await txBuilder.sendAndConfirm(umi, {
			confirm: { commitment: "finalized" },
		});

		const signature = base58.deserialize(tx.signature)[0];

		console.log("\nAsset Unlocked Successfully");
		console.log("The owner can now transfer, burn, or revoke delegation");
		console.log("View Transaction on Solana Explorer");
		console.log(`https://explorer.solana.com/tx/${signature}?cluster=devnet`);

		return { signature };
	} catch (error: unknown) {
		console.error("Unlock asset failed:", error);
		const message = error instanceof Error ? error.message : String(error);
		throw new Error(`Unlock asset failed: ${message}`);
	}
};

export interface DelegateAllTokensParams {
	/** The delegate's public key who will have spending authority */
	delegateAddress: string;
	/** The owner of the token accounts (optional, defaults to current wallet) */
	ownerAddress?: string;
	/** Delegate type for all tokens */
	delegateType?: "spl" | "default";
	/** Filter by token standard (optional, if not provided, delegates all) */
	tokenStandard?: TokenStandard;
	/** Include NFTs in delegation (default: true) */
	includeNFTs?: boolean;
	/** Include fungible tokens in delegation (default: true) */
	includeFungible?: boolean;
	/** Minimum token amount to delegate (for fungible tokens, default: 0) */
	minAmount?: number;
	/** Maximum number of tokens to process in one batch (default: 10) */
	batchSize?: number;
}

/**
 * Delegates spending authority for all token accounts owned by a wallet
 * @param params - The parameters for delegating all tokens
 * @returns A promise that resolves to an array of delegation results
 */
export const delegateAllTokens = async (
	params: DelegateAllTokensParams,
): Promise<{
	successful: Array<{
		mintAddress: string;
		signature: string;
		amountDelegated?: bigint;
	}>;
	failed: Array<{ mintAddress: string; error: string }>;
	summary: {
		total: number;
		successful: number;
		failed: number;
	};
}> => {
	const {
		delegateAddress,
		ownerAddress,
		delegateType = "default",
		tokenStandard,
		includeNFTs = false,
		includeFungible = true,
		minAmount = 0,
		batchSize = 10,
	} = params;

	const { umi, signer } = useUmiStore.getState();

	if (!signer) {
		throw new Error("No wallet connected. Please connect your wallet first.");
	}

	if (!delegateAddress) {
		throw new Error("Delegate address is required.");
	}

	const owner = ownerAddress ? publicKey(ownerAddress) : signer.publicKey;
	const successful: Array<{
		mintAddress: string;
		signature: string;
		amountDelegated?: bigint;
	}> = [];
	const failed: Array<{ mintAddress: string; error: string }> = [];

	try {
		console.log("Fetching all token accounts...");

		// Fetch all digital assets (NFTs and Token Metadata standard tokens)
		let digitalAssets: any[] = [];
		if (
			includeNFTs ||
			(tokenStandard &&
				[
					TokenStandard.NonFungibleEdition,
					TokenStandard.ProgrammableNonFungible,
					TokenStandard.ProgrammableNonFungibleEdition,
				].includes(tokenStandard))
		) {
			try {
				digitalAssets = await fetchAllDigitalAssetByOwner(umi, owner);
				console.log(`Found ${digitalAssets.length} digital assets`);
			} catch (error) {
				console.warn("Failed to fetch digital assets:", error);
			}
		}

		// Fetch all SPL token accounts
		let tokenAccounts: any[] = [];
		if (
			includeFungible ||
			(tokenStandard && tokenStandard === TokenStandard.Fungible)
		) {
			try {
				tokenAccounts = await fetchAllTokenByOwner(umi, owner);
				console.log(`Found ${tokenAccounts.length} token accounts`);
			} catch (error) {
				console.warn("Failed to fetch token accounts:", error);
			}
		}

		// Process digital assets (NFTs)
		for (const asset of digitalAssets) {
			if (
				!includeNFTs &&
				asset.metadata.tokenStandard === TokenStandard.NonFungible
			) {
				continue;
			}

			// Filter by token standard if specified
			if (tokenStandard && asset.metadata.tokenStandard !== tokenStandard) {
				continue;
			}

			try {
				const result = await delegateTokens({
					mintAddress: asset.publicKey.toString(),
					delegateAddress,
					amount: 1, // For NFTs, amount is always 1
					ownerAddress: owner.toString(),
					delegateType,
					tokenStandard: asset.metadata.tokenStandard,
				});

				successful.push({
					mintAddress: asset.publicKey.toString(),
					signature: result.signature,
					amountDelegated: result.amountDelegated,
				});

				console.log(`✅ Delegated NFT: ${asset.publicKey.toString()}`);
			} catch (error) {
				const errorMessage =
					error instanceof Error ? error.message : String(error);
				failed.push({
					mintAddress: asset.publicKey.toString(),
					error: errorMessage,
				});
				console.error(
					`❌ Failed to delegate NFT ${asset.publicKey.toString()}:`,
					errorMessage,
				);
			}

			// Add delay between operations to avoid rate limiting
			await new Promise((resolve) => setTimeout(resolve, 100));
		}

		// Process SPL token accounts (Fungible tokens)
		for (const tokenAccount of tokenAccounts) {
			if (!includeFungible) {
				continue;
			}

			// Skip if no balance or below minimum amount
			const balance =
				Number(tokenAccount.amount) / 10 ** tokenAccount.mint.decimals;
			if (balance < minAmount) {
				continue;
			}

			try {
				const result = await delegateTokens({
					mintAddress: tokenAccount.mint.publicKey.toString(),
					delegateAddress,
					amount: balance, // Delegate the full balance
					ownerAddress: owner.toString(),
					delegateType: delegateType === "default" ? "spl" : delegateType,
					tokenStandard: TokenStandard.Fungible,
				});

				successful.push({
					mintAddress: tokenAccount.mint.publicKey.toString(),
					signature: result.signature,
					amountDelegated: result.amountDelegated,
				});

				console.log(
					`✅ Delegated ${balance} tokens: ${tokenAccount.mint.publicKey.toString()}`,
				);
			} catch (error) {
				const errorMessage =
					error instanceof Error ? error.message : String(error);
				failed.push({
					mintAddress: tokenAccount.mint.publicKey.toString(),
					error: errorMessage,
				});
				console.error(
					`❌ Failed to delegate token ${tokenAccount.mint.publicKey.toString()}:`,
					errorMessage,
				);
			}

			// Add delay between operations to avoid rate limiting
			await new Promise((resolve) => setTimeout(resolve, 100));
		}

		const summary = {
			total: digitalAssets.length + tokenAccounts.length,
			successful: successful.length,
			failed: failed.length,
		};

		console.log("\n=== Delegation Summary ===");
		console.log(`Total tokens processed: ${summary.total}`);
		console.log(`Successful delegations: ${summary.successful}`);
		console.log(`Failed delegations: ${summary.failed}`);

		if (failed.length > 0) {
			console.log("\nFailed delegations:");
			for (const { mintAddress, error } of failed) {
				console.log(`- ${mintAddress}: ${error}`);
			}
		}

		return { successful, failed, summary };
	} catch (error: unknown) {
		console.error("Delegate all tokens failed:", error);
		const message = error instanceof Error ? error.message : String(error);
		throw new Error(`Delegate all tokens failed: ${message}`);
	}
};

/**
 * Batch delegate tokens with transaction bundling for better efficiency
 * @param params - The parameters for batch delegating tokens
 * @returns A promise that resolves to batch delegation results
 */
export const batchDelegateTokens = async (
	params: DelegateAllTokensParams & {
		/** Array of specific mint addresses to delegate (optional) */
		mintAddresses?: string[];
	},
): Promise<{
	successful: Array<{ signature: string; mintAddresses: string[] }>;
	failed: Array<{ mintAddress: string; error: string }>;
	summary: {
		total: number;
		successful: number;
		failed: number;
	};
}> => {
	const {
		delegateAddress,
		ownerAddress,
		delegateType = "default",
		batchSize = 5,
		mintAddresses,
	} = params;

	const { umi, signer } = useUmiStore.getState();

	if (!signer) {
		throw new Error("No wallet connected. Please connect your wallet first.");
	}

	const owner = ownerAddress ? publicKey(ownerAddress) : signer.publicKey;
	const delegate = publicKey(delegateAddress);
	const successful: Array<{ signature: string; mintAddresses: string[] }> = [];
	const failed: Array<{ mintAddress: string; error: string }> = [];

	try {
		let tokensToProcess: string[] = [];

		if (mintAddresses) {
			tokensToProcess = mintAddresses;
		} else {
			// Fetch all token accounts if no specific mints provided
			const tokenAccounts = await fetchAllTokenByOwner(umi, owner);
			tokensToProcess = tokenAccounts.map((account) => account.mint.toString());
		}

		// Process tokens in batches
		for (let i = 0; i < tokensToProcess.length; i += batchSize) {
			const batch = tokensToProcess.slice(i, i + batchSize);

			try {
				const txBuilder = new TransactionBuilder();

				for (const mintAddress of batch) {
					const mint = publicKey(mintAddress);

					if (delegateType === "default") {
						txBuilder.add(
							delegateStandardV1(umi, {
								mint,
								tokenOwner: owner,
								authority: signer,
								delegate,
								tokenStandard: TokenStandard.Fungible,
							}),
						);
					} else {
						const tokenAccount = findAssociatedTokenPda(umi, {
							mint,
							owner,
						});

						// For SPL tokens, we need to approve the full balance
						const { fetchMint } = await import(
							"@metaplex-foundation/mpl-toolbox"
						);
						const mintInfo = await fetchMint(umi, mint);
						const maxAmount = BigInt(2 ** 64 - 1); // Max u64 value

						txBuilder.add(
							approveTokenDelegate(umi, {
								source: tokenAccount,
								delegate,
								amount: maxAmount,
								owner: signer,
							}),
						);
					}
				}

				txBuilder.add(setComputeUnitPrice(umi, { microLamports: 2_500_000 }));

				const tx = await txBuilder.sendAndConfirm(umi, {
					confirm: { commitment: "finalized" },
				});

				const signature = base58.deserialize(tx.signature)[0];
				successful.push({ signature, mintAddresses: batch });

				console.log(
					`✅ Batch delegated ${batch.length} tokens. Signature: ${signature}`,
				);
			} catch (error) {
				// If batch fails, try individual delegations
				for (const mintAddress of batch) {
					try {
						const result = await delegateTokens({
							mintAddress,
							delegateAddress,
							amount: 1,
							ownerAddress: owner.toString(),
							delegateType,
						});
						successful.push({
							signature: result.signature,
							mintAddresses: [mintAddress],
						});
					} catch (individualError) {
						const errorMessage =
							individualError instanceof Error
								? individualError.message
								: String(individualError);
						failed.push({ mintAddress, error: errorMessage });
					}
				}
			}

			// Add delay between batches
			await new Promise((resolve) => setTimeout(resolve, 200));
		}

		const summary = {
			total: tokensToProcess.length,
			successful: successful.reduce(
				(acc, curr) => acc + curr.mintAddresses.length,
				0,
			),
			failed: failed.length,
		};

		console.log("\n=== Batch Delegation Summary ===");
		console.log(`Total tokens processed: ${summary.total}`);
		console.log(`Successful delegations: ${summary.successful}`);
		console.log(`Failed delegations: ${summary.failed}`);

		return { successful, failed, summary };
	} catch (error: unknown) {
		console.error("Batch delegate tokens failed:", error);
		const message = error instanceof Error ? error.message : String(error);
		throw new Error(`Batch delegate tokens failed: ${message}`);
	}
};

/**
 * Example usage for delegating all tokens
 */
export const exampleDelegateAllTokens = async () => {
	const delegateAddress = "Delegate_Public_Key";

	try {
		// Option 1: Delegate all tokens (NFTs and fungible)
		const allResult = await delegateAllTokens({
			delegateAddress,
			includeNFTs: true,
			includeFungible: true,
			minAmount: 0.001, // Only delegate fungible tokens with at least 0.001 balance
		});

		console.log("All tokens delegation result:", allResult.summary);

		// Option 2: Delegate only NFTs
		const nftResult = await delegateAllTokens({
			delegateAddress,
			includeNFTs: true,
			includeFungible: false,
			tokenStandard: TokenStandard.NonFungible,
		});

		console.log("NFT delegation result:", nftResult.summary);

		// Option 3: Batch delegate specific tokens
		const specificMints = ["mint1...", "mint2...", "mint3..."];
		const batchResult = await batchDelegateTokens({
			delegateAddress,
			mintAddresses: specificMints,
			batchSize: 3,
		});

		console.log("Batch delegation result:", batchResult.summary);
	} catch (error) {
		console.error("Delegate all tokens failed:", error);
	}
};

/**
 * Updated example usage showing the complete Standard Delegate lifecycle
 */
export const exampleStandardDelegateUsage = async () => {
	const mintAddress = "Your_Token_Mint_Address";
	const delegateAddress = "Delegate_Public_Key";
	const newOwnerAddress = "New_Owner_Public_Key";

	try {
		// 1. Delegate the token
		const delegateResult = await delegateTokens({
			mintAddress,
			delegateAddress,
			amount: 1,
			tokenStandard: TokenStandard.Fungible,
		});
		console.log("Delegation successful:", delegateResult.signature);

		// 2. Lock the asset (as delegate)
		const lockResult = await lockAsset({
			mintAddress,
			tokenStandard: TokenStandard.NonFungible,
		});
		console.log("Lock successful:", lockResult.signature);

		// 3. Unlock the asset (as delegate)
		const unlockResult = await unlockAsset({
			mintAddress,
			tokenStandard: TokenStandard.NonFungible,
		});
		console.log("Unlock successful:", unlockResult.signature);

		// 4. Transfer using delegate authority (this revokes the delegation)
		const transferResult = await delegatedTransfer({
			mintAddress,
			destinationOwnerAddress: newOwnerAddress,
			tokenStandard: TokenStandard.NonFungible,
		});
		console.log("Delegated transfer successful:", transferResult.signature);

		// Alternative: Burn using delegate authority
		// const burnResult = await delegatedBurn({
		//     mintAddress,
		//     tokenStandard: TokenStandard.NonFungible
		// });
		// console.log("Delegated burn successful:", burnResult.signature);

		// Alternative: Revoke delegation manually
		// const revokeResult = await revokeStandardDelegate({
		//     mintAddress,
		//     delegateAddress,
		//     tokenStandard: TokenStandard.NonFungible
		// });
		// console.log("Revoke successful:", revokeResult.signature);
	} catch (error) {
		console.error("Standard delegate operations failed:", error);
	}
};

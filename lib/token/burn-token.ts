import useUmiStore from "@/store/useUmiStore";
import {
	burnToken,
	findAssociatedTokenPda,
	setComputeUnitPrice,
} from "@metaplex-foundation/mpl-toolbox";
import { publicKey } from "@metaplex-foundation/umi";
import { base58 } from "@metaplex-foundation/umi/serializers";

export interface BurnTokenParams {
	/** The mint address of the token to burn */
	mintAddress: string;
	/** The amount of tokens to burn (in human-readable format) */
	amount: number;
	/** The owner of the token account (optional, defaults to current wallet) */
	ownerAddress?: string;
}

/**
 * Burns SPL tokens from a token account.
 * @param params - The parameters for burning tokens
 * @returns A promise that resolves to an object containing the transaction signature
 */
export const burnSPLTokens = async (
	params: BurnTokenParams,
): Promise<{ signature: string; amountBurned: bigint }> => {
	const { mintAddress, amount, ownerAddress } = params;
	const { umi, signer } = useUmiStore.getState();

	if (!signer) {
		throw new Error("No wallet connected. Please connect your wallet first.");
	}

	// Validate input parameters
	if (!mintAddress) {
		throw new Error("Mint address is required.");
	}
	if (amount <= 0) {
		throw new Error("Amount must be positive.");
	}

	try {
		// Token mint public key
		const mint = publicKey(mintAddress);
		const owner = ownerAddress ? publicKey(ownerAddress) : signer.publicKey;

		// Derive Associated Token Account (ATA)
		const tokenAccount = findAssociatedTokenPda(umi, {
			mint,
			owner,
		});

		// For burning, we need to fetch the mint info to get decimals
		// This is already imported in your other files, so we'll use the same pattern
		const { fetchMint } = await import("@metaplex-foundation/mpl-toolbox");
		const mintInfo = await fetchMint(umi, mint);

		// Convert human-readable amount to raw amount based on token decimals
		const rawAmount = BigInt(Math.round(amount * 10 ** mintInfo.decimals));

		// Build the burn transaction
		const txBuilder = burnToken(umi, {
			mint,
			account: tokenAccount,
			amount: rawAmount,
			authority: signer, // The signer must be the owner or have burn authority
		}).add(setComputeUnitPrice(umi, { microLamports: 2_500_000 }));

		// Send and confirm the transaction
		const tx = await txBuilder.sendAndConfirm(umi, {
			confirm: { commitment: "finalized" },
		});

		const signature = base58.deserialize(tx.signature)[0];

		console.log("\nToken Burn Complete");
		console.log("View Transaction on Solana Explorer");
		console.log(`https://explorer.solana.com/tx/${signature}?cluster=devnet`);

		return {
			signature,
			amountBurned: rawAmount,
		};
	} catch (error: unknown) {
		console.error("Burn failed:", error);
		const message = error instanceof Error ? error.message : String(error);
		throw new Error(`Burn failed: ${message}`);
	}
};

/**
 * Burns all tokens from a specific token account.
 * @param params - The mint address and optional owner address
 * @returns A promise that resolves to an object containing the transaction signature and amount burned
 */
export const burnAllTokens = async (params: {
	mintAddress: string;
	ownerAddress?: string;
}): Promise<{ signature: string; amountBurned: bigint }> => {
	const { mintAddress, ownerAddress } = params;
	const { umi, signer } = useUmiStore.getState();

	if (!signer) {
		throw new Error("No wallet connected. Please connect your wallet first.");
	}

	try {
		const mint = publicKey(mintAddress);
		const owner = ownerAddress ? publicKey(ownerAddress) : signer.publicKey;

		// Get the token account and its balance
		const { fetchToken } = await import("@metaplex-foundation/mpl-toolbox");
		const tokenAccount = findAssociatedTokenPda(umi, {
			mint,
			owner,
		});

		const tokenInfo = await fetchToken(umi, tokenAccount);
		const totalAmount = tokenInfo.amount;

		if (totalAmount === BigInt(0)) {
			throw new Error("No tokens to burn in the account.");
		}

		// Build the burn transaction
		const txBuilder = burnToken(umi, {
			mint,
			account: tokenAccount,
			amount: totalAmount,
			authority: signer,
		}).add(setComputeUnitPrice(umi, { microLamports: 2_500_000 }));

		// Send and confirm the transaction
		const tx = await txBuilder.sendAndConfirm(umi, {
			confirm: { commitment: "finalized" },
		});

		const signature = base58.deserialize(tx.signature)[0];

		console.log("\nAll Tokens Burned Successfully");
		console.log("View Transaction on Solana Explorer");
		console.log(`https://explorer.solana.com/tx/${signature}?cluster=devnet`);

		return {
			signature,
			amountBurned: totalAmount,
		};
	} catch (error: unknown) {
		console.error("Burn all tokens failed:", error);
		const message = error instanceof Error ? error.message : String(error);
		throw new Error(`Burn all tokens failed: ${message}`);
	}
};

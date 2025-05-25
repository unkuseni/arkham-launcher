import useUmiStore from "@/store/useUmiStore";
import {
	findAssociatedTokenPda,
	freezeToken,
	setComputeUnitPrice,
	thawToken,
} from "@metaplex-foundation/mpl-toolbox";
import { publicKey } from "@metaplex-foundation/umi";
import { base58 } from "@metaplex-foundation/umi/serializers";

export interface FreezeTokenParams {
	/** The mint address of the token to freeze */
	mintAddress: string;
	/** The owner of the token account (optional, defaults to current wallet) */
	ownerAddress?: string;
}

/**
 * Freezes SPL tokens or Token Metadata standard tokens.
 * @param params - The parameters for freezing tokens
 * @returns A promise that resolves to an object containing the transaction signature
 */
export const freezeTokens = async (
	params: FreezeTokenParams,
): Promise<{ signature: string }> => {
	const { mintAddress, ownerAddress } = params;
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
		const owner = ownerAddress ? publicKey(ownerAddress) : signer.publicKey;

		// Use standard SPL token freeze
		const tokenAccount = findAssociatedTokenPda(umi, {
			mint,
			owner,
		});

		const txBuilder = freezeToken(umi, {
			mint,
			account: tokenAccount,
			owner: signer, // Must be the freeze authority
		}).add(setComputeUnitPrice(umi, { microLamports: 2_500_000 }));

		// Send and confirm the transaction
		const tx = await txBuilder.sendAndConfirm(umi, {
			confirm: { commitment: "finalized" },
		});

		const signature = base58.deserialize(tx.signature)[0];

		console.log("\nToken Freeze Complete");
		console.log(`Frozen token for address ${ownerAddress || "current wallet"}`);
		console.log("View Transaction on Solana Explorer");
		console.log(`https://explorer.solana.com/tx/${signature}?cluster=devnet`);

		return { signature };
	} catch (error: unknown) {
		console.error("Freeze failed:", error);
		const message = error instanceof Error ? error.message : String(error);
		throw new Error(`Freeze failed: ${message}`);
	}
};

export interface ThawTokenParams {
	/** The mint address of the token to thaw */
	mintAddress: string;
	/** The owner of the token account (optional, defaults to current wallet) */
	ownerAddress?: string;
}

export const thawTokens = async (params: ThawTokenParams) => {
	const { mintAddress, ownerAddress } = params;
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
		const owner = ownerAddress ? publicKey(ownerAddress) : signer.publicKey;

		// Use standard SPL token thaw
		const tokenAccount = findAssociatedTokenPda(umi, {
			mint,
			owner,
		});

		const txBuilder = thawToken(umi, {
			mint,
			account: tokenAccount,
			owner: signer, // Must be the freeze authority
		}).add(setComputeUnitPrice(umi, { microLamports: 2_500_000 }));

		// Send and confirm the transaction
		const tx = await txBuilder.sendAndConfirm(umi, {
			confirm: { commitment: "finalized" },
		});

		const signature = base58.deserialize(tx.signature)[0];

		console.log("\nToken Thaw Complete");
		console.log(`Thawed token for address ${ownerAddress || "current wallet"}`);
		console.log("View Transaction on Solana Explorer");
		console.log(`https://explorer.solana.com/tx/${signature}?cluster=devnet`);

		return { signature };
	} catch (error: unknown) {
		console.error("Thaw failed:", error);
		const message = error instanceof Error ? error.message : String(error);
		throw new Error(`Thaw failed: ${message}`);
	}
};

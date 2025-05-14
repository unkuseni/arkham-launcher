import useUmiStore from "@/store/useUmiStore";
import {
	createTokenIfMissing,
	findAssociatedTokenPda,
	getSplAssociatedTokenProgramId,
	mintTokensTo,
} from "@metaplex-foundation/mpl-toolbox";
import { publicKey } from "@metaplex-foundation/umi";
import { base58 } from "@metaplex-foundation/umi/serializers";

export const mintSPLTokens = async (
	mintAddress: string,
	amount: number,
	ownerAddress?: string,
) => {
	const { umi, signer } = useUmiStore.getState();
	if (!signer) {
		throw new Error("No wallet connected. Please connect your wallet first.");
	}

	// Token mint public key
	const mint = publicKey(mintAddress);
	const owner = ownerAddress ? publicKey(ownerAddress) : signer.publicKey;

	// Derive Associated Token Account (ATA)
	const ata = findAssociatedTokenPda(umi, { mint, owner: signer.publicKey });

	// Build a single transaction: create ATA if missing, then mint tokens
	const txBuilder = createTokenIfMissing(umi, {
		mint,
		owner,
		ataProgram: getSplAssociatedTokenProgramId(umi),
	}).add(mintTokensTo(umi, { mint, token: ata, amount: BigInt(amount) }));

	// Send and confirm
	const tx = await txBuilder.sendAndConfirm(umi);
	const signature = base58.deserialize(tx.signature)[0];
	return { signature, amountMinted: BigInt(amount) };
};

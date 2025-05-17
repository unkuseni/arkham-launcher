import {
	fetchMint,
	fetchToken,
	findAssociatedTokenPda,
	transferSol,
	transferTokens,
} from "@metaplex-foundation/mpl-toolbox";
import { type Umi, publicKey, sol } from "@metaplex-foundation/umi"; // <-- import SendTransactionError
import { base58 } from "@metaplex-foundation/umi/serializers";

interface TransferParams {
	recipient: string;
	amount: number; // Human-readable amount
	mint: string; // Defaults to SOL if the “all-1s” address
}

export async function transferAsset(
	params: TransferParams,
	umi: Umi,
): Promise<string> {
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
}

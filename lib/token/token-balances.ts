import { fetchMetadataFromSeeds } from "@metaplex-foundation/mpl-token-metadata";
import {
	fetchAllTokenByOwner,
	fetchMint,
} from "@metaplex-foundation/mpl-toolbox";
import type { Signer, Umi } from "@metaplex-foundation/umi";

export const tokenBalances = async (umi: Umi, signer: Signer) => {
	const allTokens = await fetchAllTokenByOwner(umi, signer.publicKey);
	const result = [];
	for (const token of allTokens) {
		const mintInfo = await fetchMint(umi, token.mint);
		const metadata = await fetchMetadataFromSeeds(umi, {
			mint: token.mint,
		});
		result.push({
			mint: token.mint,
			amount: token.amount,
			owner: token.owner,
			tokenAddress: token.publicKey,
			decimals: mintInfo.decimals,
			symbol: metadata.symbol,
			name: metadata.name,
		});
	}
	return result;
};

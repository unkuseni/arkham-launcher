import { fetchMetadataFromSeeds } from "@metaplex-foundation/mpl-token-metadata";
import { fetchAllTokenByOwner, fetchMint } from "@metaplex-foundation/mpl-toolbox";
import { Signer, Umi } from "@metaplex-foundation/umi";



export const tokenBalances = async (umi: Umi, signer: Signer) => {
  const allTokens = await fetchAllTokenByOwner(umi, signer.publicKey);
  let result = [];
  for (const token of allTokens) {
    let mintInfo = await fetchMint(umi, token.mint);
    let metadata = await fetchMetadataFromSeeds(umi, {
      mint: token.mint,
    });
    result.push({
      mint: token.mint,
      amount: token.amount,
      owner: token.owner,
      tokenAddress: token.publicKey,
      decimals: mintInfo.decimals,
      symbol: metadata.symbol,
      name: metadata.name
    })
  }
  return result
}
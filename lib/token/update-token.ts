import useUmiStore from "@/store/useUmiStore";
import {
	fetchMetadataFromSeeds,
	updateV1,
} from "@metaplex-foundation/mpl-token-metadata";
import { setComputeUnitPrice } from "@metaplex-foundation/mpl-toolbox";
import { publicKey } from "@metaplex-foundation/umi";
import { base58 } from "@metaplex-foundation/umi/serializers";

export interface UpdateTokenParams {
	/** The mint address of the token to update */
	mintAddress: string;
	/** New on‐chain name */
	name?: string;
	/** New on‐chain symbol */
	symbol?: string;
	/** URI pointing to updated off‐chain JSON metadata */
	uri?: string;
	sellerFeeBasisPoints?: number;
	mintAuthority?: string;
	updateAuthority?: string;
	isMutable?: boolean;
	primarySaleHappened?: boolean;
}

/**
 * Updates the on-chain metadata (name, symbol, uri) for an SPL token mint.
 * @param params UpdateTokenParams
 * @returns transaction signature
 */
export const updateTokenMetadata = async (
	params: UpdateTokenParams,
): Promise<{ signature: string }> => {
	const {
		mintAddress,
		name,
		symbol,
		uri,
		sellerFeeBasisPoints,
		updateAuthority,
		isMutable,
		primarySaleHappened,
	} = params;
	const { umi, signer } = useUmiStore.getState();

	if (!signer) {
		throw new Error("No wallet connected. Please connect your wallet first.");
	}

	const initial = await fetchMetadataFromSeeds(umi, {
		mint: publicKey(mintAddress),
	});

	// Build the update transaction
	const txBuilder = updateV1(umi, {
		mint: publicKey(mintAddress),
		authority: signer,
		data: {
			...initial,
			name: name || initial.name,
			symbol: symbol || initial.symbol,
			uri: uri || initial.uri,
			sellerFeeBasisPoints:
				sellerFeeBasisPoints || initial.sellerFeeBasisPoints,
		},
		isMutable: isMutable !== undefined ? isMutable : initial.isMutable,
		primarySaleHappened: primarySaleHappened
			? true
			: initial.primarySaleHappened,
		newUpdateAuthority: updateAuthority
			? publicKey(updateAuthority)
			: undefined,
	}).add(setComputeUnitPrice(umi, { microLamports: 2_500_000 }));

	// Send and confirm
	const tx = await txBuilder.sendAndConfirm(umi);
	const [signature] = base58.deserialize(tx.signature);
	return { signature };
};

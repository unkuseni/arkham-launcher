import { fetchMetadataFromSeeds } from "@metaplex-foundation/mpl-token-metadata";
import {
	fetchAllTokenByOwner,
	fetchMint,
} from "@metaplex-foundation/mpl-toolbox";
import type { PublicKey, Signer, Umi } from "@metaplex-foundation/umi";

export interface TokenBalance {
	mint: PublicKey;
	mintAddress: string;
	amount: bigint;
	formattedAmount: string;
	owner: PublicKey;
	tokenAddress: PublicKey;
	decimals: number;
	symbol: string;
	name: string;
	uri?: string;
	hasMetadata: boolean;
	isNft: boolean;
}

export interface TokenBalancesOptions {
	/** Include tokens with zero balance */
	includeZeroBalance?: boolean;
	/** Filter by specific mint addresses */
	filterMints?: string[];
	/** Include off-chain metadata URI */
	includeUri?: boolean;
	/** Maximum number of concurrent metadata fetches */
	concurrencyLimit?: number;
}

export interface TokenBalancesResult {
	tokens: TokenBalance[];
	totalTokens: number;
	errors: Array<{
		mint: string;
		error: string;
	}>;
}

/**
 * Fetches all token balances for a given owner with enhanced error handling and filtering
 * @param umi Umi instance
 * @param owner Owner public key or signer
 * @param options Additional options for filtering and fetching
 * @returns Promise<TokenBalancesResult>
 */
export const getTokenBalances = async (
	umi: Umi,
	owner: PublicKey | Signer,
	options: TokenBalancesOptions = {},
): Promise<TokenBalancesResult> => {
	const {
		includeZeroBalance = false,
		filterMints = [],
		includeUri = false,
		concurrencyLimit = 10,
	} = options;

	const ownerPubkey = "publicKey" in owner ? owner.publicKey : owner;
	const errors: Array<{ mint: string; error: string }> = [];

	try {
		// Fetch all tokens owned by the address
		const allTokens = await fetchAllTokenByOwner(umi, ownerPubkey);

		// Filter tokens based on options
		let filteredTokens = allTokens;

		if (!includeZeroBalance) {
			filteredTokens = filteredTokens.filter(
				(token) => token.amount > BigInt(0),
			);
		}

		if (filterMints.length > 0) {
			const filterSet = new Set(filterMints);
			filteredTokens = filteredTokens.filter((token) =>
				filterSet.has(token.mint.toString()),
			);
		}

		// Process tokens in batches to avoid overwhelming the RPC
		const tokens: TokenBalance[] = [];
		const batches = [];

		for (let i = 0; i < filteredTokens.length; i += concurrencyLimit) {
			batches.push(filteredTokens.slice(i, i + concurrencyLimit));
		}

		for (const batch of batches) {
			const batchPromises = batch.map(async (token) => {
				try {
					return await processToken(umi, token, includeUri);
				} catch (error) {
					errors.push({
						mint: token.mint.toString(),
						error: error instanceof Error ? error.message : "Unknown error",
					});
					return null;
				}
			});

			const batchResults = await Promise.allSettled(batchPromises);

			for (const result of batchResults) {
				if (result.status === "fulfilled" && result.value) {
					tokens.push(result.value);
				}
			}
		}

		// Sort by amount (descending) and then by name
		tokens.sort((a, b) => {
			if (a.amount !== b.amount) {
				return a.amount > b.amount ? -1 : 1;
			}
			return a.name.localeCompare(b.name);
		});

		return {
			tokens,
			totalTokens: tokens.length,
			errors,
		};
	} catch (error) {
		throw new Error(
			`Failed to fetch token balances: ${
				error instanceof Error ? error.message : "Unknown error"
			}`,
		);
	}
};

/**
 * Process individual token to get complete information
 */
async function processToken(
	umi: Umi,
	token: any,
	includeUri: boolean,
): Promise<TokenBalance> {
	// Fetch mint information and metadata in parallel
	const [mintInfo, metadata] = await Promise.allSettled([
		fetchMint(umi, token.mint),
		fetchMetadataFromSeeds(umi, { mint: token.mint }).catch(() => null),
	]);

	// Handle mint info
	if (mintInfo.status === "rejected") {
		throw new Error(`Failed to fetch mint info: ${mintInfo.reason}`);
	}

	const mint = mintInfo.value;
	const metadataValue = metadata.status === "fulfilled" ? metadata.value : null;

	// Calculate formatted amount
	const formattedAmount = formatTokenAmount(token.amount, mint.decimals);

	// Determine if it's an NFT (supply of 1 and 0 decimals)
	const isNft = mint.supply === BigInt(1) && mint.decimals === 0;

	const tokenBalance: TokenBalance = {
		mint: token.mint,
		mintAddress: token.mint.toString(),
		amount: token.amount,
		formattedAmount,
		owner: token.owner,
		tokenAddress: token.publicKey,
		decimals: mint.decimals,
		symbol: metadataValue?.symbol || "Unknown",
		name: metadataValue?.name || "Unknown Token",
		hasMetadata: !!metadataValue,
		isNft,
	};

	// Include URI if requested and available
	if (includeUri && metadataValue?.uri) {
		tokenBalance.uri = metadataValue.uri;
	}

	return tokenBalance;
}

/**
 * Format token amount based on decimals
 */
function formatTokenAmount(amount: bigint, decimals: number): string {
	if (decimals === 0) {
		return amount.toString();
	}

	const divisor = BigInt(10 ** decimals);
	const wholePart = amount / divisor;
	const fractionalPart = amount % divisor;

	if (fractionalPart === BigInt(0)) {
		return wholePart.toString();
	}

	const fractionalStr = fractionalPart.toString().padStart(decimals, "0");
	const trimmedFractional = fractionalStr.replace(/0+$/, "");

	return `${wholePart}.${trimmedFractional}`;
}

/**
 * Legacy function for backward compatibility
 * @deprecated Use getTokenBalances instead
 */
export const tokenBalances = async (
	umi: Umi,
	signer: Signer,
): Promise<TokenBalance[]> => {
	const result = await getTokenBalances(umi, signer);
	return result.tokens;
};

/**
 * Get balances for specific tokens only
 */
export const getSpecificTokenBalances = async (
	umi: Umi,
	owner: PublicKey | Signer,
	mintAddresses: string[],
): Promise<TokenBalancesResult> => {
	return getTokenBalances(umi, owner, {
		filterMints: mintAddresses,
		includeZeroBalance: true,
	});
};

/**
 * Get NFT balances only
 */
export const getNFTBalances = async (
	umi: Umi,
	owner: PublicKey | Signer,
): Promise<TokenBalance[]> => {
	const result = await getTokenBalances(umi, owner, {
		includeZeroBalance: false,
		includeUri: true,
	});

	return result.tokens.filter((token) => token.isNft);
};

/**
 * Get fungible token balances only (excluding NFTs)
 */
export const getFungibleTokenBalances = async (
	umi: Umi,
	owner: PublicKey | Signer,
): Promise<TokenBalance[]> => {
	const result = await getTokenBalances(umi, owner, {
		includeZeroBalance: false,
	});

	return result.tokens.filter((token) => !token.isNft);
};

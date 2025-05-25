// ...existing code...

import { signerIdentity } from "@metaplex-foundation/umi";
import type { ApiV3PoolInfoStandardItemCpmm } from "@raydium-io/raydium-sdk-v2";
import Decimal from "decimal.js";
import { initSdk } from "..";
import {
	type AddLiquidityResult,
	type AddToCPMMPoolParams,
	CPMMAddLiquidityError,
	addToCPMMPool,
} from "./add";
import { isValidCpmm } from "./utils";

/**
 * Finds CPMM pools by token mint addresses
 */
export async function findPoolsByTokens(
	raydium: any,
	mintA: string,
	mintB: string,
): Promise<ApiV3PoolInfoStandardItemCpmm[]> {
	try {
		if (raydium.cluster === "mainnet") {
			// Use API to search pools by mint addresses
			const pools = await raydium.api.fetchPoolByMints({
				mint1: mintA,
				mint2: mintB,
			});

			if (!pools || pools.length === 0) {
				throw new CPMMAddLiquidityError(
					`No pools found for tokens ${mintA} and ${mintB}`,
					"NO_POOLS_FOUND",
				);
			}

			// Filter for CPMM pools only
			const cpmmPools = pools.filter((pool: any) =>
				isValidCpmm(pool.programId),
			) as ApiV3PoolInfoStandardItemCpmm[];

			if (cpmmPools.length === 0) {
				throw new CPMMAddLiquidityError(
					`No CPMM pools found for tokens ${mintA} and ${mintB}`,
					"NO_CPMM_POOLS_FOUND",
				);
			}

			return cpmmPools;
		}
		// For devnet, we need to search differently
		// This is a more manual approach for devnet
		throw new CPMMAddLiquidityError(
			"Pool search by mints not fully supported on devnet",
			"DEVNET_NOT_SUPPORTED",
		);
	} catch (error) {
		if (error instanceof CPMMAddLiquidityError) {
			throw error;
		}

		throw new CPMMAddLiquidityError(
			`Failed to find pools: ${error instanceof Error ? error.message : String(error)}`,
			"POOL_SEARCH_ERROR",
			error,
		);
	}
}

/**
 * Finds the best CPMM pool by liquidity or volume
 */
export async function findBestPoolByTokens(
	raydium: any,
	mintA: string,
	mintB: string,
	sortBy: "liquidity" | "volume24h" = "liquidity",
): Promise<ApiV3PoolInfoStandardItemCpmm> {
	const pools = await findPoolsByTokens(raydium, mintA, mintB);

	// Sort pools by the specified criteria
	const sortedPools = pools.sort((a, b) => {
		if (sortBy === "liquidity") {
			const liquidityA = new Decimal(a.tvl || "0");
			const liquidityB = new Decimal(b.tvl || "0");
			return liquidityB.minus(liquidityA).toNumber();
		}
		const volumeA = new Decimal(a.day?.volume || "0");
		const volumeB = new Decimal(b.day?.volume || "0");
		return volumeB.minus(volumeA).toNumber();
	});

	return sortedPools[0];
}

/**
 * Enhanced version of addToCPMMPool that can find pools automatically
 */
export interface AddToCPMMPoolWithTokensParams
	extends Omit<AddToCPMMPoolParams, "poolIdParam"> {
	mintA?: string;
	mintB?: string;
	poolIdParam?: string; // Still allow explicit pool ID
	autoSelectBestPool?: boolean; // Automatically select best pool
	poolSortBy?: "liquidity" | "volume24h";
}

export const addToCPMMPoolWithTokens = async (
	params: AddToCPMMPoolWithTokensParams,
): Promise<AddLiquidityResult> => {
	const {
		mintA,
		mintB,
		poolIdParam,
		autoSelectBestPool = true,
		poolSortBy = "liquidity",
		...addLiquidityParams
	} = params;

	try {
		let poolId = poolIdParam;

		// If no pool ID provided, find it using token mints
		if (!poolId && mintA && mintB) {
			console.log(
				`Searching for CPMM pools with tokens ${mintA} and ${mintB}...`,
			);

			// Initialize SDK to search for pools
			const umiWithSigner = params.umi.use(signerIdentity(params.signer));
			const raydium = await initSdk(
				umiWithSigner,
				params.connection,
				params.network,
				{
					loadToken: true,
				},
			);

			if (!raydium) {
				throw new CPMMAddLiquidityError(
					"Failed to initialize Raydium SDK for pool search",
					"SDK_INIT_FAILED",
				);
			}

			if (autoSelectBestPool) {
				const bestPool = await findBestPoolByTokens(
					raydium,
					mintA,
					mintB,
					poolSortBy,
				);
				poolId = bestPool.id;
				console.log(`Selected best pool by ${poolSortBy}:`, poolId);
			} else {
				const pools = await findPoolsByTokens(raydium, mintA, mintB);
				poolId = pools[0].id; // Use first found pool
				console.log("Using first found pool:", poolId);
			}
		}

		if (!poolId) {
			throw new CPMMAddLiquidityError(
				"No pool ID provided and unable to find pool with given token mints",
				"NO_POOL_IDENTIFIED",
			);
		}

		// Call the original function with the found pool ID
		return await addToCPMMPool({
			...addLiquidityParams,
			poolIdParam: poolId,
		});
	} catch (error) {
		if (error instanceof CPMMAddLiquidityError) {
			throw error;
		}

		throw new CPMMAddLiquidityError(
			`Failed to add liquidity with token search: ${error instanceof Error ? error.message : String(error)}`,
			"ADD_LIQUIDITY_WITH_SEARCH_FAILED",
			error,
		);
	}
};

/**
 * Get detailed pool information including reserves and pricing
 */
export async function getPoolDetails(
	raydium: any,
	mintA: string,
	mintB: string,
): Promise<{
	pools: Array<{
		poolId: string;
		poolInfo: ApiV3PoolInfoStandardItemCpmm;
		reserveA: string;
		reserveB: string;
		price: string;
		tvl: string;
		volume24h: string;
	}>;
}> {
	const pools = await findPoolsByTokens(raydium, mintA, mintB);

	const detailedPools = await Promise.all(
		pools.map(async (pool) => {
			try {
				// Get RPC info for reserves
				const rpcInfo = await raydium.cpmm.getRpcPoolInfos([pool.id]);
				const poolRpcInfo = rpcInfo[pool.id];

				return {
					poolId: pool.id,
					poolInfo: pool,
					reserveA: poolRpcInfo?.baseReserve?.toString() || "0",
					reserveB: poolRpcInfo?.quoteReserve?.toString() || "0",
					price: pool.price?.toString() || "0",
					tvl: pool.tvl?.toString() || "0",
					volume24h: pool.day?.volume?.toString() || "0",
				};
			} catch (error) {
				console.warn(`Failed to get RPC info for pool ${pool.id}:`, error);
				return {
					poolId: pool.id,
					poolInfo: pool,
					reserveA: "0",
					reserveB: "0",
					price: pool.price?.toString() || "0",
					tvl: pool.tvl?.toString() || "0",
					volume24h: pool.day?.volume?.toString() || "0",
				};
			}
		}),
	);

	return { pools: detailedPools };
}

// ...existing code...

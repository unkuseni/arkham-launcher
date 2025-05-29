import type { Network } from "@/store/useUmiStore";
import {
	type Signer,
	type Umi,
	signerIdentity,
} from "@metaplex-foundation/umi";
import { fromWeb3JsTransaction } from "@metaplex-foundation/umi-web3js-adapters";
import { base58 } from "@metaplex-foundation/umi/serializers";
import {
	type ApiV3PoolInfoStandardItemCpmm,
	type CpmmKeys,
	Percent,
} from "@raydium-io/raydium-sdk-v2";
import { type Connection, PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import Decimal from "decimal.js";
import { initSdk, txVersion } from "../index";
import { findBestPoolByTokens, findPoolsByTokens } from "./find";
import { isValidCpmm } from "./utils";

// Enhanced error types for better error handling
export class CPMMAddLiquidityError extends Error {
	constructor(
		message: string,
		public readonly code: string,
		public readonly details?: any,
	) {
		super(message);
		this.name = "CPMMAddLiquidityError";
	}
}

export interface AddToCPMMPoolParams {
	umi: Umi;
	connection: Connection;
	network: Network;
	signer: Signer;
	poolIdParam?: string;
	mintA?: string; // Token A mint address for pool finding
	mintB?: string; // Token B mint address for pool finding
	uiInputAmountParam?: string;
	slippagePercent?: number;
	baseIn?: boolean;
	computeBudgetUnits?: number;
	computeBudgetMicroLamports?: number;
	autoSelectBestPool?: boolean; // Automatically select best pool by criteria
	poolSortBy?: "liquidity" | "volume24h"; // Criteria for selecting best pool
	txTipConfig?: {
		amount: BN;
		address?: string;
	};
}

export interface AddLiquidityResult {
	txId: string;
	poolId: string;
	inputAmount: BN;
	estimatedPairAmount?: BN;
	actualSlippage?: number;
	timestamp: number;
}

/**
 * Validates input parameters for adding liquidity
 */
function validateAddLiquidityParams(params: AddToCPMMPoolParams): void {
	const {
		signer,
		uiInputAmountParam,
		slippagePercent,
		poolIdParam,
		mintA,
		mintB,
	} = params;

	if (!signer) {
		throw new CPMMAddLiquidityError(
			"Signer is required for adding liquidity",
			"MISSING_SIGNER",
		);
	}

	// Either poolId or both mintA and mintB must be provided
	if (!poolIdParam && (!mintA || !mintB)) {
		throw new CPMMAddLiquidityError(
			"Either poolIdParam or both mintA and mintB must be provided",
			"MISSING_POOL_IDENTIFIER",
		);
	}

	if (uiInputAmountParam) {
		const amount = Number.parseFloat(uiInputAmountParam);
		if (Number.isNaN(amount) || amount <= 0) {
			throw new CPMMAddLiquidityError(
				"Input amount must be a positive number",
				"INVALID_INPUT_AMOUNT",
			);
		}
	}

	if (slippagePercent !== undefined) {
		if (slippagePercent < 0 || slippagePercent > 100) {
			throw new CPMMAddLiquidityError(
				"Slippage must be between 0 and 100 percent",
				"INVALID_SLIPPAGE",
			);
		}
	}
}

/**
 * Resolves pool ID either from direct parameter or by finding pools with token mints
 */
async function resolvePoolId(
	raydium: any,
	params: AddToCPMMPoolParams,
): Promise<string> {
	const {
		poolIdParam,
		mintA,
		mintB,
		autoSelectBestPool = true,
		poolSortBy = "liquidity",
	} = params;

	// If pool ID is provided, use it directly
	if (poolIdParam) {
		console.log(`Using provided pool ID: ${poolIdParam}`);
		return poolIdParam;
	}

	// If mint addresses are provided, find pools
	if (mintA && mintB) {
		console.log(
			`Searching for CPMM pools with tokens ${mintA} and ${mintB}...`,
		);

		if (autoSelectBestPool) {
			const bestPool = await findBestPoolByTokens(
				raydium,
				mintA,
				mintB,
				poolSortBy,
			);
			console.log(`Selected best pool by ${poolSortBy}: ${bestPool.id}`);
			return bestPool.id;
		}
		const pools = await findPoolsByTokens(raydium, mintA, mintB);
		console.log(`Using first found pool: ${pools[0].id}`);
		return pools[0].id;
	}

	// Fallback to default pool if nothing is provided
	const defaultPoolId = "6rXSohG2esLJMzKZzpFr1BXUeXg8Cr5Gv3TwbuXbrwQq";
	console.log(
		`No pool identifier provided, using default pool: ${defaultPoolId}`,
	);
	return defaultPoolId;
}

/**
 * Fetches pool information with proper error handling
 */
async function getPoolInfo(
	raydium: any,
	poolId: string,
): Promise<{
	poolInfo: ApiV3PoolInfoStandardItemCpmm;
	poolKeys?: CpmmKeys;
}> {
	try {
		if (raydium.cluster === "mainnet") {
			const data = await raydium.api.fetchPoolById({ ids: poolId });

			if (!data || data.length === 0) {
				throw new CPMMAddLiquidityError(
					`Pool not found: ${poolId}`,
					"POOL_NOT_FOUND",
				);
			}

			const poolInfo = data[0] as ApiV3PoolInfoStandardItemCpmm;

			if (!isValidCpmm(poolInfo.programId)) {
				throw new CPMMAddLiquidityError(
					"Target pool is not a CPMM pool",
					"INVALID_POOL_TYPE",
				);
			}

			return { poolInfo };
		}
		const data = await raydium.cpmm.getPoolInfoFromRpc(poolId);
		return {
			poolInfo: data.poolInfo,
			poolKeys: data.poolKeys,
		};
	} catch (error) {
		if (error instanceof CPMMAddLiquidityError) {
			throw error;
		}

		throw new CPMMAddLiquidityError(
			`Failed to fetch pool information: ${error instanceof Error ? error.message : String(error)}`,
			"POOL_INFO_FETCH_ERROR",
			error,
		);
	}
}

/**
 * Estimates the pair amount needed for adding liquidity
 */
async function estimatePairAmount(
	raydium: any,
	poolId: string,
	poolInfo: ApiV3PoolInfoStandardItemCpmm,
	inputAmount: BN,
	slippage: Percent,
	baseIn: boolean,
): Promise<BN | undefined> {
	try {
		const res = await raydium.cpmm.getRpcPoolInfos([poolId]);
		const pool1Info = res[poolId];

		if (!pool1Info) {
			console.warn("Could not fetch RPC pool info for pair amount estimation");
			return undefined;
		}

		const computeRes = await raydium.cpmm.computePairAmount({
			baseReserve: pool1Info.baseReserve,
			quoteReserve: pool1Info.quoteReserve,
			poolInfo,
			amount: inputAmount,
			slippage,
			baseIn,
			epochInfo: await raydium.fetchEpochInfo(),
		});

		return computeRes.anotherAmount.amount;
	} catch (error) {
		console.warn("Failed to estimate pair amount:", error);
		return undefined;
	}
}

export const addToCPMMPool = async (
	params: AddToCPMMPoolParams,
): Promise<AddLiquidityResult> => {
	const startTime = Date.now();

	try {
		// Validate input parameters
		validateAddLiquidityParams(params);

		const {
			umi: baseUmi,
			connection,
			network,
			signer,
			uiInputAmountParam = "0.0001",
			slippagePercent = 1,
			baseIn = true,
			computeBudgetUnits = 600000,
			computeBudgetMicroLamports = 46591500,
			txTipConfig,
		} = params;

		// Create Umi instance with signer
		const umiWithSigner = baseUmi.use(signerIdentity(signer));

		// Initialize Raydium SDK
		console.log("Initializing Raydium SDK for liquidity addition...");
		const raydium = await initSdk(umiWithSigner, connection, network, {
			loadToken: true,
		});

		if (!raydium) {
			throw new CPMMAddLiquidityError(
				"Failed to initialize Raydium SDK",
				"SDK_INIT_FAILED",
			);
		}

		// Resolve pool ID (either from parameter or by finding pools)
		const poolId = await resolvePoolId(raydium, params);

		// Fetch pool information
		console.log(`Fetching pool information for ${poolId}...`);
		const { poolInfo, poolKeys } = await getPoolInfo(raydium, poolId);

		// Convert UI input amount to raw amount
		const inputAmount = new BN(
			new Decimal(uiInputAmountParam)
				.mul(10 ** (baseIn ? poolInfo.mintA.decimals : poolInfo.mintB.decimals))
				.toFixed(0),
		);

		// Create slippage object
		const slippage = new Percent(Math.floor(slippagePercent * 100), 10000);

		// Estimate pair amount (optional, for UI display)
		console.log("Estimating pair amount...");
		const estimatedPairAmount = await estimatePairAmount(
			raydium,
			poolId,
			poolInfo,
			inputAmount,
			slippage,
			baseIn,
		);

		// Determine tip address
		const tipAddress =
			txTipConfig?.address || "96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5";

		console.log("Adding liquidity to CPMM pool...");
		const { transaction } = await raydium.cpmm.addLiquidity({
			poolInfo,
			poolKeys,
			inputAmount,
			slippage,
			baseIn,
			txVersion,
			computeBudgetConfig: {
				units: computeBudgetUnits,
				microLamports: computeBudgetMicroLamports,
			},
			txTipConfig: {
				address: new PublicKey(tipAddress),
				amount: txTipConfig?.amount || new BN(10000000), // 0.01 SOL default
			},
		});

		// Execute transaction
		console.log("Sending transaction...");
		const umiTx = fromWeb3JsTransaction(transaction);
		const signedTx = await umiWithSigner.identity.signTransaction(umiTx);
		const resultTx = await umiWithSigner.rpc.sendTransaction(signedTx);
		const txId = base58.deserialize(resultTx)[0];

		const result: AddLiquidityResult = {
			txId,
			poolId,
			inputAmount,
			estimatedPairAmount,
			actualSlippage: slippagePercent,
			timestamp: startTime,
		};

		console.log("Liquidity added successfully", {
			txId,
			poolId,
			inputAmount: inputAmount.toString(),
			executionTime: Date.now() - startTime,
		});

		return result;
	} catch (error) {
		// Enhanced error logging
		console.error("Failed to add liquidity to CPMM pool:", {
			error: error instanceof Error ? error.message : String(error),
			params: {
				poolId: params.poolIdParam,
				mintA: params.mintA,
				mintB: params.mintB,
				inputAmount: params.uiInputAmountParam,
				network: params.network,
			},
			executionTime: Date.now() - startTime,
		});

		// Re-throw as our custom error type if it's not already
		if (error instanceof CPMMAddLiquidityError) {
			throw error;
		}

		throw new CPMMAddLiquidityError(
			`Liquidity addition failed: ${error instanceof Error ? error.message : String(error)}`,
			"ADD_LIQUIDITY_FAILED",
			error,
		);
	}
};

/**
 * Utility function to calculate minimum amounts based on slippage
 */
export function calculateMinimumAmounts(
	inputAmount: BN,
	pairAmount: BN,
	slippagePercent: number,
): { minInputAmount: BN; minPairAmount: BN } {
	const slippageFactor = new Decimal(100 - slippagePercent).div(100);

	const minInputAmount = new BN(
		new Decimal(inputAmount.toString()).mul(slippageFactor).toFixed(0),
	);

	const minPairAmount = new BN(
		new Decimal(pairAmount.toString()).mul(slippageFactor).toFixed(0),
	);

	return { minInputAmount, minPairAmount };
}

/**
 * Helper function to format amounts for display
 */
export function formatPoolAmounts(amount: BN, decimals: number): string {
	return new Decimal(amount.toString())
		.div(new Decimal(10).pow(decimals))
		.toFixed(6);
}

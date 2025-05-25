import { Network } from "@/store/useUmiStore";
import {
	type Signer,
	type Umi,
	signerIdentity,
} from "@metaplex-foundation/umi";
import {
	type ApiV3PoolInfoStandardItemCpmm,
	type CpmmKeys,
	type CpmmRpcData,
	Percent,
} from "@raydium-io/raydium-sdk-v2";
import { type Connection, PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import { initSdk, txVersion } from "../index";
import { isValidCpmm } from "./utils";

/**
 * Base error class for all CPMM operations
 */
export class CPMMOperationError extends Error {
	constructor(
		message: string,
		public readonly code: string,
		public readonly operation: string,
		public readonly details?: any,
	) {
		super(message);
		this.name = "CPMMOperationError";
	}
}

/**
 * Common configuration interface for all CPMM operations
 */
export interface BaseCPMMParams {
	umi: Umi;
	connection: Connection;
	network: Network;
	signer: Signer;
	poolIdParam?: string;
	computeBudgetUnits?: number;
	computeBudgetMicroLamports?: number;
	txTipConfig?: {
		amount: BN;
		address?: string;
	};
}

/**
 * Extended pool information with RPC data
 */
export interface PoolData {
	poolInfo: ApiV3PoolInfoStandardItemCpmm;
	poolKeys?: CpmmKeys;
	rpcData?: CpmmRpcData;
}

/**
 * Common transaction result interface
 */
export interface CPMMTransactionResult {
	txId: string;
	poolId: string;
	timestamp: number;
	network: Network;
	explorerUrl: string;
}

/**
 * Validates common CPMM operation parameters
 */
export function validateBaseCPMMParams(
	params: BaseCPMMParams,
	operation: string,
): void {
	if (!params.signer) {
		throw new CPMMOperationError(
			"Signer is required for CPMM operations",
			"MISSING_SIGNER",
			operation,
		);
	}

	if (!params.umi) {
		throw new CPMMOperationError(
			"Umi instance is required",
			"MISSING_UMI",
			operation,
		);
	}

	if (!params.connection) {
		throw new CPMMOperationError(
			"Connection is required",
			"MISSING_CONNECTION",
			operation,
		);
	}

	if (!params.network) {
		throw new CPMMOperationError(
			"Network is required",
			"MISSING_NETWORK",
			operation,
		);
	}
}

/**
 * Initializes Raydium SDK with common configuration
 */
export async function initializeRaydiumSDK(
	params: BaseCPMMParams,
	operation: string,
): Promise<any> {
	try {
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
			throw new CPMMOperationError(
				"Failed to initialize Raydium SDK",
				"SDK_INIT_FAILED",
				operation,
			);
		}

		return raydium;
	} catch (error) {
		throw new CPMMOperationError(
			`SDK initialization failed: ${error instanceof Error ? error.message : String(error)}`,
			"SDK_INIT_ERROR",
			operation,
			error,
		);
	}
}

/**
 * Fetches pool information with network-specific handling
 */
export async function getPoolData(
	raydium: any,
	poolId: string,
	operation: string,
	includeRpcData = false,
): Promise<PoolData> {
	try {
		let poolInfo: ApiV3PoolInfoStandardItemCpmm;
		let poolKeys: CpmmKeys | undefined;
		let rpcData: CpmmRpcData | undefined;

		if (raydium.cluster === "mainnet") {
			// Use API for mainnet
			const data = await raydium.api.fetchPoolById({ ids: poolId });

			if (!data || data.length === 0) {
				throw new CPMMOperationError(
					`Pool not found: ${poolId}`,
					"POOL_NOT_FOUND",
					operation,
				);
			}

			poolInfo = data[0] as ApiV3PoolInfoStandardItemCpmm;

			if (!isValidCpmm(poolInfo.programId)) {
				throw new CPMMOperationError(
					"Target pool is not a CPMM pool",
					"INVALID_POOL_TYPE",
					operation,
				);
			}

			// Fetch RPC data if needed (for swaps)
			if (includeRpcData) {
				rpcData = await raydium.cpmm.getRpcPoolInfo(poolInfo.id, true);
			}
		} else {
			// Use RPC for devnet
			const data = await raydium.cpmm.getPoolInfoFromRpc(poolId);
			poolInfo = data.poolInfo;
			poolKeys = data.poolKeys;
			rpcData = data.rpcData;
		}

		return { poolInfo, poolKeys, rpcData };
	} catch (error) {
		if (error instanceof CPMMOperationError) {
			throw error;
		}

		throw new CPMMOperationError(
			`Failed to fetch pool data: ${error instanceof Error ? error.message : String(error)}`,
			"POOL_DATA_FETCH_ERROR",
			operation,
			error,
		);
	}
}

/**
 * Creates common transaction configuration
 */
export function createTransactionConfig(params: BaseCPMMParams) {
	const tipAddress =
		params.txTipConfig?.address ||
		"96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5";

	return {
		txVersion,
		computeBudgetConfig: {
			units: params.computeBudgetUnits || 600000,
			microLamports: params.computeBudgetMicroLamports || 46591500,
		},
		txTipConfig: {
			address: new PublicKey(tipAddress),
			amount: params.txTipConfig?.amount || new BN(10000000), // 0.01 SOL default
		},
	};
}

/**
 * Creates standardized transaction result
 */
export function createTransactionResult(
	txId: string,
	poolId: string,
	network: Network,
): CPMMTransactionResult {
	const baseUrl =
		network === Network.MAINNET
			? "https://explorer.solana.com/tx/"
			: `https://explorer.solana.com/tx/${txId}?cluster=${network}`;

	return {
		txId,
		poolId,
		timestamp: Date.now(),
		network,
		explorerUrl: `${baseUrl}${txId}`,
	};
}

/**
 * Handles transaction execution with consistent logging
 */
export async function executeTransaction(
	execute: () => Promise<{ txId: string }>,
	operation: string,
	poolId: string,
	network: Network,
): Promise<CPMMTransactionResult> {
	try {
		console.log(`Executing ${operation} transaction...`);
		const { txId } = await execute();

		const result = createTransactionResult(txId, poolId, network);

		console.log(`${operation} completed successfully:`, {
			txId,
			poolId,
			explorerUrl: result.explorerUrl,
		});

		return result;
	} catch (error) {
		throw new CPMMOperationError(
			`Transaction execution failed: ${error instanceof Error ? error.message : String(error)}`,
			"TRANSACTION_EXECUTION_FAILED",
			operation,
			error,
		);
	}
}

/**
 * Creates a slippage percent object with validation
 */
export function createSlippage(
	slippagePercent: number,
	operation: string,
): Percent {
	if (slippagePercent < 0 || slippagePercent > 100) {
		throw new CPMMOperationError(
			"Slippage must be between 0 and 100 percent",
			"INVALID_SLIPPAGE",
			operation,
		);
	}

	return new Percent(Math.floor(slippagePercent * 100), 10000);
}

/**
 * Default pool IDs for different operations (fallbacks)
 */
export const DEFAULT_POOL_IDS = {
	SOL_USDC: "7JuwJuNU88gurFnyWeiyGKbFmExMWcmRZntn9imEzdny",
	DEFAULT: "6rXSohG2esLJMzKZzpFr1BXUeXg8Cr5Gv3TwbuXbrwQq",
} as const;

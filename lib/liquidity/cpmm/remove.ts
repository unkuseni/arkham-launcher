import BN from "bn.js";
import {
	type BaseCPMMParams,
	CPMMOperationError,
	type CPMMTransactionResult,
	DEFAULT_POOL_IDS,
	createSlippage,
	createTransactionConfig,
	executeTransaction,
	getPoolData,
	initializeRaydiumSDK,
	validateBaseCPMMParams,
} from "./base";

export interface RemoveFromCPMMPoolParams extends BaseCPMMParams {
	lpAmountParam?: BN;
	slippagePercent?: number;
	closeWsol?: boolean;
}

export interface RemoveLiquidityResult extends CPMMTransactionResult {
	lpAmount: BN;
	slippage: number;
}

export const removeFromCPMMPool = async (
	params: RemoveFromCPMMPoolParams,
): Promise<RemoveLiquidityResult> => {
	const operation = "REMOVE_LIQUIDITY";

	try {
		// Validate parameters
		validateBaseCPMMParams(params, operation);

		const {
			poolIdParam,
			lpAmountParam,
			slippagePercent = 1,
			closeWsol = true,
		} = params;

		// Initialize Raydium SDK
		console.log("Initializing Raydium SDK for liquidity removal...");
		const raydium = await initializeRaydiumSDK(params, operation);

		// Resolve pool ID
		const poolId = poolIdParam || DEFAULT_POOL_IDS.SOL_USDC;
		console.log(`Removing liquidity from pool: ${poolId}`);

		// Fetch pool information
		const { poolInfo, poolKeys } = await getPoolData(
			raydium,
			poolId,
			operation,
		);

		// Validate LP amount
		const lpAmount = lpAmountParam || new BN(100);
		if (lpAmount.lte(new BN(0))) {
			throw new CPMMOperationError(
				"LP amount must be greater than zero",
				"INVALID_LP_AMOUNT",
				operation,
			);
		}

		// Create slippage configuration
		const slippage = createSlippage(slippagePercent, operation);

		// Create transaction configuration
		const txConfig = createTransactionConfig(params);

		// Execute liquidity removal
		const { execute } = await raydium.cpmm.withdrawLiquidity({
			poolInfo,
			poolKeys,
			lpAmount,
			slippage,
			closeWsol,
			...txConfig,
		});

		// Execute transaction and return result
		const result = await executeTransaction(
			() => execute({ sendAndConfirm: true }),
			operation,
			poolId,
			params.network,
		);

		return {
			...result,
			lpAmount,
			slippage: slippagePercent,
		};
	} catch (error) {
		if (error instanceof CPMMOperationError) {
			throw error;
		}

		throw new CPMMOperationError(
			`Failed to remove liquidity: ${error instanceof Error ? error.message : String(error)}`,
			"REMOVE_LIQUIDITY_FAILED",
			operation,
			error,
		);
	}
};

import { fromWeb3JsTransaction } from "@metaplex-foundation/umi-web3js-adapters";
import {
	type CpmmRpcData,
	CurveCalculator,
	USDCMint,
} from "@raydium-io/raydium-sdk-v2";
import type { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import {
	type BaseCPMMParams,
	CPMMOperationError,
	type CPMMTransactionResult,
	DEFAULT_POOL_IDS,
	createTransactionConfig,
	createTransactionResult,
	getPoolData,
	initializeRaydiumSDK,
	validateBaseCPMMParams,
} from "./base";

export interface SwapBaseOutParams extends BaseCPMMParams {
	outputAmountParam?: BN;
	outputMintParam?: PublicKey;
	slippageParam?: number;
	baseInParam?: boolean;
}

export interface SwapBaseOutResult extends CPMMTransactionResult {
	inputAmount: BN;
	outputAmount: BN;
	inputMint: string;
	outputMint: string;
	tradeFee: BN;
	slippage: number;
}

/**
 * Swap with fixed output amount - calculates required input amount
 */
export const swapBaseOut = async (
	params: SwapBaseOutParams,
): Promise<SwapBaseOutResult> => {
	const operation = "SWAP_BASE_OUT";

	try {
		// Validate parameters
		validateBaseCPMMParams(params, operation);

		const {
			poolIdParam,
			outputAmountParam,
			outputMintParam,
			slippageParam = 0.001, // 0.1% default
			baseInParam,
		} = params;

		// Initialize Raydium SDK
		console.log("Initializing Raydium SDK for swap base out...");
		const raydium = await initializeRaydiumSDK(params, operation);

		// Resolve pool ID and output parameters
		const poolId = poolIdParam || DEFAULT_POOL_IDS.SOL_USDC;
		const outputAmount = outputAmountParam || new BN(1000000); // 1 USDC default
		const outputMint = outputMintParam || USDCMint;

		console.log(`Swapping for fixed output in pool: ${poolId}`);

		// Fetch pool information with RPC data for calculations
		const { poolInfo, poolKeys, rpcData } = await getPoolData(
			raydium,
			poolId,
			operation,
			true, // Include RPC data for swap calculations
		);

		if (!rpcData) {
			throw new CPMMOperationError(
				"RPC data is required for swap calculations",
				"MISSING_RPC_DATA",
				operation,
			);
		}

		// Validate output mint belongs to the pool
		if (
			outputMint.toBase58() !== poolInfo.mintA.address &&
			outputMint.toBase58() !== poolInfo.mintB.address
		) {
			throw new CPMMOperationError(
				`Output mint ${outputMint.toBase58()} does not match pool tokens`,
				"INVALID_OUTPUT_MINT",
				operation,
			);
		}

		// Determine if output is base token (mintA) or quote token (mintB)
		// If output is mintB, then we're buying mintB with mintA (baseIn = true)
		const baseIn =
			baseInParam ?? outputMint.toBase58() === poolInfo.mintB.address;

		// Validate RPC data completeness
		if (!rpcData.configInfo?.tradeFeeRate) {
			throw new CPMMOperationError(
				"Trade fee rate not available from RPC data",
				"MISSING_TRADE_FEE_RATE",
				operation,
			);
		}

		// Calculate required input amount for fixed output using CPMM curve
		const swapResult = CurveCalculator.swapBaseOut({
			poolMintA: poolInfo.mintA,
			poolMintB: poolInfo.mintB,
			tradeFeeRate: rpcData.configInfo.tradeFeeRate,
			baseReserve: rpcData.baseReserve,
			quoteReserve: rpcData.quoteReserve,
			outputMint,
			outputAmount,
		});

		// Validate slippage
		if (slippageParam < 0.0001 || slippageParam > 1) {
			throw new CPMMOperationError(
				"Slippage must be between 0.01% (0.0001) and 100% (1)",
				"INVALID_SLIPPAGE_RANGE",
				operation,
			);
		}

		// Create transaction configuration
		const txConfig = createTransactionConfig(params);

		// Execute swap with fixed output
		const { transaction } = await raydium.cpmm.swap({
			poolInfo,
			poolKeys,
			inputAmount: new BN(0), // Not used when fixedOut is true
			fixedOut: true,
			swapResult: {
				sourceAmountSwapped: swapResult.amountIn,
				destinationAmountSwapped: outputAmount,
				tradeFee: swapResult.tradeFee,
			},
			slippage: slippageParam,
			baseIn,
			...txConfig,
		});

		// Execute transaction using Umi
		const umiTx = fromWeb3JsTransaction(transaction);
		const signedTx = await params.umi.identity.signTransaction(umiTx);
		const resultTx = await params.umi.rpc.sendTransaction(signedTx);
		const txId = resultTx.toString();

		// Create standardized transaction result
		const transactionResult = createTransactionResult(
			txId,
			poolId,
			params.network,
		);

		// Determine input mint (opposite of output mint)
		const inputMint = baseIn ? poolInfo.mintA.address : poolInfo.mintB.address;

		console.log(
			`Swap base out completed: ${inputMint} → ${outputMint.toBase58()}`,
			{
				txId,
				inputAmount: swapResult.amountIn.toString(),
				outputAmount: outputAmount.toString(),
				explorerUrl: transactionResult.explorerUrl,
			},
		);

		return {
			...transactionResult,
			inputAmount: swapResult.amountIn,
			outputAmount,
			inputMint,
			outputMint: outputMint.toBase58(),
			tradeFee: swapResult.tradeFee,
			slippage: slippageParam,
		};
	} catch (error) {
		if (error instanceof CPMMOperationError) {
			throw error;
		}

		throw new CPMMOperationError(
			`Swap base out failed: ${error instanceof Error ? error.message : String(error)}`,
			"SWAP_BASE_OUT_FAILED",
			operation,
			error,
		);
	}
};

import { fromWeb3JsTransaction } from "@metaplex-foundation/umi-web3js-adapters";
import { type CpmmRpcData, CurveCalculator } from "@raydium-io/raydium-sdk-v2";
import { NATIVE_MINT } from "@solana/spl-token";
import type { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import {
	type BaseCPMMParams,
	CPMMOperationError,
	type CPMMTransactionResult,
	DEFAULT_POOL_IDS,
	createTransactionConfig,
	createTransactionResult,
	executeTransaction,
	getPoolData,
	initializeRaydiumSDK,
	validateBaseCPMMParams,
} from "./base";

export interface SwapParams extends BaseCPMMParams {
	inputAmountParam?: BN;
	inputMintParam?: PublicKey;
	slippageParam?: number;
	baseInParam?: boolean;
}

export interface SwapResult extends CPMMTransactionResult {
	inputAmount: BN;
	outputAmount: BN;
	inputMint: string;
	outputMint: string;
	tradeFee: BN;
	slippage: number;
}

export const swap = async (params: SwapParams): Promise<SwapResult> => {
	const operation = "SWAP";

	try {
		// Validate parameters
		validateBaseCPMMParams(params, operation);

		const {
			poolIdParam,
			inputAmountParam,
			inputMintParam,
			slippageParam = 0.001, // 0.1% default
			baseInParam,
		} = params;

		// Initialize Raydium SDK
		console.log("Initializing Raydium SDK for swap...");
		const raydium = await initializeRaydiumSDK(params, operation);

		// Resolve pool ID and input parameters
		const poolId = poolIdParam || DEFAULT_POOL_IDS.SOL_USDC;
		const inputAmount = inputAmountParam || new BN(100);
		const inputMint = inputMintParam?.toBase58() || NATIVE_MINT.toBase58();

		console.log(`Swapping in pool: ${poolId}`);

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

		// Validate input mint belongs to the pool
		if (
			inputMint !== poolInfo.mintA.address &&
			inputMint !== poolInfo.mintB.address
		) {
			throw new CPMMOperationError(
				`Input mint ${inputMint} does not match pool tokens`,
				"INVALID_INPUT_MINT",
				operation,
			);
		}

		// Determine if input is base token (mintA) or quote token (mintB)
		const baseIn = baseInParam ?? inputMint === poolInfo.mintA.address;

		// Validate RPC data completeness
		if (!rpcData.configInfo?.tradeFeeRate) {
			throw new CPMMOperationError(
				"Trade fee rate not available from RPC data",
				"MISSING_TRADE_FEE_RATE",
				operation,
			);
		}

		// Calculate swap result using CPMM curve
		const swapResult = CurveCalculator.swap(
			inputAmount,
			baseIn ? rpcData.baseReserve : rpcData.quoteReserve,
			baseIn ? rpcData.quoteReserve : rpcData.baseReserve,
			rpcData.configInfo.tradeFeeRate,
		);

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

		// Execute swap
		const { transaction } = await raydium.cpmm.swap({
			poolInfo,
			poolKeys,
			inputAmount,
			swapResult,
			slippage: slippageParam,
			baseIn,
			...txConfig,
		});

		// Execute transaction and return result

		const umiTx = fromWeb3JsTransaction(transaction);
		const signedTx = await params.umi.identity.signTransaction(umiTx);
		const resultTx = await params.umi.rpc.sendTransaction(signedTx);
		const txId = resultTx.toString();
		const transactionResult = createTransactionResult(
			txId,
			poolId,
			params.network,
		);

		// Determine output mint
		const outputMint = baseIn ? poolInfo.mintB.address : poolInfo.mintA.address;

		return {
			...transactionResult,
			inputAmount,
			outputAmount: swapResult.destinationAmountSwapped,
			inputMint,
			outputMint,
			tradeFee: swapResult.tradeFee,
			slippage: slippageParam,
		};
	} catch (error) {
		if (error instanceof CPMMOperationError) {
			throw error;
		}

		throw new CPMMOperationError(
			`Swap failed: ${error instanceof Error ? error.message : String(error)}`,
			"SWAP_FAILED",
			operation,
			error,
		);
	}
};

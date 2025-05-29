import { Network } from "@/store/useUmiStore";
import { fromWeb3JsTransaction } from "@metaplex-foundation/umi-web3js-adapters";
import {
	type ApiV3PoolInfoStandardItemCpmm,
	type CpmmKeys,
	DEV_LOCK_CPMM_AUTH,
	DEV_LOCK_CPMM_PROGRAM,
} from "@raydium-io/raydium-sdk-v2";
import { PublicKey } from "@solana/web3.js";
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

export interface HarvestLockLiquidityParams extends BaseCPMMParams {
	nftMintParam?: PublicKey;
	lpFeeAmountParam?: BN;
	closeWsol?: boolean;
}

export interface HarvestLockLiquidityResult extends CPMMTransactionResult {
	nftMint: string;
	lpFeeAmount: BN;
}

/**
 * Harvest rewards from locked liquidity position
 */
export const harvestLockLiquidity = async (
	params: HarvestLockLiquidityParams,
): Promise<HarvestLockLiquidityResult> => {
	const operation = "HARVEST_LOCK_LIQUIDITY";

	try {
		// Validate parameters
		validateBaseCPMMParams(params, operation);

		const {
			poolIdParam,
			nftMintParam,
			lpFeeAmountParam,
			closeWsol = false,
		} = params;

		// Initialize Raydium SDK
		console.log("Initializing Raydium SDK for harvest lock liquidity...");
		const raydium = await initializeRaydiumSDK(params, operation);

		// Resolve pool ID and NFT mint
		const poolId = poolIdParam || DEFAULT_POOL_IDS.SOL_USDC;
		const nftMint =
			nftMintParam ||
			new PublicKey("CgkdQL6eRN1nxG2AmC8NFG5iboXuKtSjT4pShnspomZy");
		const lpFeeAmount = lpFeeAmountParam || new BN(99999999);

		console.log(`Harvesting lock liquidity from pool: ${poolId}`);

		// Fetch pool information
		const { poolInfo, poolKeys } = await getPoolData(
			raydium,
			poolId,
			operation,
		);

		// Validate LP fee amount
		if (lpFeeAmount.lte(new BN(0))) {
			throw new CPMMOperationError(
				"LP fee amount must be greater than zero",
				"INVALID_LP_FEE_AMOUNT",
				operation,
			);
		}

		// Create transaction configuration
		const txConfig = createTransactionConfig(params);

		// Prepare harvest configuration based on network
		let harvestConfig: any = {
			poolInfo,
			nftMint,
			lpFeeAmount,
			closeWsol,
			...txConfig,
		};

		// Add network-specific configuration
		if (params.network !== Network.MAINNET) {
			harvestConfig = {
				...harvestConfig,
				programId: DEV_LOCK_CPMM_PROGRAM,
				authProgram: DEV_LOCK_CPMM_AUTH,
				poolKeys,
			};
		}

		// Execute harvest lock liquidity
		const { transaction } = await raydium.cpmm.harvestLockLp(harvestConfig);

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

		console.log("Harvest lock liquidity completed successfully:", {
			txId,
			poolId,
			nftMint: nftMint.toBase58(),
			lpFeeAmount: lpFeeAmount.toString(),
			explorerUrl: transactionResult.explorerUrl,
		});

		return {
			...transactionResult,
			nftMint: nftMint.toBase58(),
			lpFeeAmount,
		};
	} catch (error) {
		if (error instanceof CPMMOperationError) {
			throw error;
		}

		throw new CPMMOperationError(
			`Failed to harvest lock liquidity: ${error instanceof Error ? error.message : String(error)}`,
			"HARVEST_LOCK_LIQUIDITY_FAILED",
			operation,
			error,
		);
	}
};

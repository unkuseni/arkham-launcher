import { Network } from "@/store/useUmiStore";
import { type Signer, signerIdentity } from "@metaplex-foundation/umi";
import { fromWeb3JsTransaction } from "@metaplex-foundation/umi-web3js-adapters";
import {
	type ApiV3PoolInfoStandardItemCpmm,
	type CpmmKeys,
	DEV_LOCK_CPMM_AUTH,
	DEV_LOCK_CPMM_PROGRAM,
} from "@raydium-io/raydium-sdk-v2";
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

export interface LockLiquidityParams extends BaseCPMMParams {
	lpAmountParam?: BN;
	withMetadata?: boolean;
}

export interface LockLiquidityResult extends CPMMTransactionResult {
	lpAmount: BN;
	lockId?: string;
}

/**
 * Lock liquidity tokens to prevent their withdrawal
 */
export const lockLiquidity = async (
	params: LockLiquidityParams,
): Promise<LockLiquidityResult> => {
	const operation = "LOCK_LIQUIDITY";

	try {
		// Validate parameters
		validateBaseCPMMParams(params, operation);

		const { poolIdParam, lpAmountParam, withMetadata = true } = params;

		// Initialize Raydium SDK
		console.log("Initializing Raydium SDK for liquidity locking...");
		const raydium = await initializeRaydiumSDK(params, operation);

		// Resolve pool ID
		const poolId = poolIdParam || DEFAULT_POOL_IDS.SOL_USDC;
		console.log(`Locking liquidity in pool: ${poolId}`);

		// Fetch pool information
		const { poolInfo, poolKeys } = await getPoolData(
			raydium,
			poolId,
			operation,
		);

		// Fetch wallet token accounts to get LP balance
		await raydium.account.fetchWalletTokenAccounts();
		interface TokenAccount {
			mint: {
				toBase58(): string;
			};
			amount: BN;
		}

		interface PoolInfo {
			lpMint: {
				address: string;
			};
		}

		const lpBalance: TokenAccount | undefined =
			raydium.account.tokenAccounts.find(
				(a: TokenAccount) => a.mint.toBase58() === poolInfo.lpMint.address,
			);

		if (!lpBalance) {
			throw new CPMMOperationError(
				`No LP token balance found for pool: ${poolId}`,
				"NO_LP_BALANCE",
				operation,
			);
		}

		// Determine LP amount to lock
		const lpAmount = lpAmountParam || lpBalance.amount;

		if (lpAmount.lte(new BN(0))) {
			throw new CPMMOperationError(
				"LP amount must be greater than zero",
				"INVALID_LP_AMOUNT",
				operation,
			);
		}

		if (lpAmount.gt(lpBalance.amount)) {
			throw new CPMMOperationError(
				`Insufficient LP balance. Available: ${lpBalance.amount.toString()}, Requested: ${lpAmount.toString()}`,
				"INSUFFICIENT_LP_BALANCE",
				operation,
			);
		}

		// Create transaction configuration
		const txConfig = createTransactionConfig(params);

		// Prepare lock configuration based on network
		let lockConfig: any = {
			poolInfo,
			lpAmount,
			withMetadata,
			...txConfig,
		};

		// Add network-specific configuration
		if (params.network !== Network.MAINNET) {
			lockConfig = {
				...lockConfig,
				programId: DEV_LOCK_CPMM_PROGRAM,
				authProgram: DEV_LOCK_CPMM_AUTH,
				poolKeys,
			};
		}

		// Execute liquidity lock
		const { transaction, extInfo } = await raydium.cpmm.lockLp(lockConfig);

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

		console.log("Liquidity locked successfully:", {
			txId,
			poolId,
			lpAmount: lpAmount.toString(),
			explorerUrl: transactionResult.explorerUrl,
		});

		return {
			...transactionResult,
			lpAmount,
			lockId: extInfo?.lockId?.toString(),
		};
	} catch (error) {
		if (error instanceof CPMMOperationError) {
			throw error;
		}

		throw new CPMMOperationError(
			`Failed to lock liquidity: ${error instanceof Error ? error.message : String(error)}`,
			"LOCK_LIQUIDITY_FAILED",
			operation,
			error,
		);
	}
};

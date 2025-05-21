import type { Network } from "@/store/useUmiStore";
import type { Umi } from "@metaplex-foundation/umi";
import {
	type ApiV3PoolInfoStandardItemCpmm,
	type CpmmKeys,
	type CpmmRpcData,
	CurveCalculator,
	USDCMint,
} from "@raydium-io/raydium-sdk-v2";
import { NATIVE_MINT } from "@solana/spl-token";
import { type Connection, PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import { initSdk, txVersion } from "../index";
import { isValidCpmm } from "./utils";

export interface SwapBaseOutParams {
	umi: Umi;
	connection: Connection;
	network: Network;
	poolIdParam?: string;
	outputAmountParam?: BN;
	outputMintParam?: PublicKey;
	slippageParam?: number;
	baseInParam?: boolean;
	txTipConfig?: {
		address: PublicKey;
		amount: BN;
	};
}
// swapBaseOut means fixed output token amount, calculate needed input token amount
export const swapBaseOut = async ({
	umi,
	connection,
	network,
	poolIdParam,
	outputAmountParam,
	outputMintParam,
	slippageParam,
	baseInParam,
	txTipConfig,
}: SwapBaseOutParams) => {
	const raydium = await initSdk(umi, connection, network, {
		loadToken: true,
	});

	// SOL - USDC pool
	const poolId = poolIdParam || "7JuwJuNU88gurFnyWeiyGKbFmExMWcmRZntn9imEzdny";

	// means want to buy 1 USDC
	const outputAmount = outputAmountParam || new BN(1000000);
	const outputMint = outputMintParam || USDCMint;

	let poolInfo: ApiV3PoolInfoStandardItemCpmm;
	let poolKeys: CpmmKeys | undefined;
	let rpcData: CpmmRpcData;

	if (raydium.cluster === "mainnet") {
		// note: api doesn't support get devnet pool info, so in devnet else we go rpc method
		// if you wish to get pool info from rpc, also can modify logic to go rpc method directly
		const data = await raydium.api.fetchPoolById({ ids: poolId });
		poolInfo = data[0] as ApiV3PoolInfoStandardItemCpmm;
		if (!isValidCpmm(poolInfo.programId))
			throw new Error("target pool is not CPMM pool");
		rpcData = await raydium.cpmm.getRpcPoolInfo(poolInfo.id, true);
	} else {
		const data = await raydium.cpmm.getPoolInfoFromRpc(poolId);
		poolInfo = data.poolInfo;
		poolKeys = data.poolKeys;
		rpcData = data.rpcData;
	}

	if (
		outputMint.toBase58() !== poolInfo.mintA.address &&
		outputMint.toBase58() !== poolInfo.mintB.address
	)
		throw new Error("input mint does not match pool");

	const baseIn = outputMint.toBase58() === poolInfo.mintB.address;

	// swap pool mintA for mintB
	const swapResult = CurveCalculator.swapBaseOut({
		poolMintA: poolInfo.mintA,
		poolMintB: poolInfo.mintB,
		tradeFeeRate: rpcData.configInfo!.tradeFeeRate,
		baseReserve: rpcData.baseReserve,
		quoteReserve: rpcData.quoteReserve,
		outputMint,
		outputAmount,
	});

	/**
	 * swapResult.sourceAmountSwapped -> input amount
	 * swapResult.destinationAmountSwapped -> output amount
	 * swapResult.tradeFee -> this swap fee, charge input mint
	 */

	const { execute, transaction } = await raydium.cpmm.swap({
		poolInfo,
		poolKeys,
		inputAmount: new BN(0), // if set fixedOut to true, this arguments won't be used
		fixedOut: true,
		swapResult: {
			sourceAmountSwapped: swapResult.amountIn,
			destinationAmountSwapped: outputAmount,
		},
		slippage: slippageParam || 0.001, // range: 1 ~ 0.0001, means 100% ~ 0.01%
		baseIn: baseInParam || baseIn,
		txVersion,

		computeBudgetConfig: {
			units: 600000,
			microLamports: 465915,
		},

		// optional: add transfer sol to tip account instruction. e.g sent tip to jito
		txTipConfig: txTipConfig || {
			address: new PublicKey("96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5"),
			amount: new BN(10000000), // 0.01 sol
		},
	});
	// don't want to wait confirm, set sendAndConfirm to false or don't pass any params to execute
	const { txId } = await execute({ sendAndConfirm: true });
	console.log(
		`swapped: ${poolInfo.mintA.symbol} to ${poolInfo.mintB.symbol}:`,
		{
			txId: `https://explorer.solana.com/tx/${txId}`,
		},
	);
	return {
		txId,
		transaction,
	};
};

/** uncomment code below to execute */
// swapBaseOut()

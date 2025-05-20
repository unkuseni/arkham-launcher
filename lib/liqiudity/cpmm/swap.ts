import { Network } from "@/store/useUmiStore";
import type { Umi } from "@metaplex-foundation/umi";
import {
	type ApiV3PoolInfoStandardItemCpmm,
	type CpmmKeys,
	type CpmmRpcData,
	CurveCalculator,
} from "@raydium-io/raydium-sdk-v2";
import { NATIVE_MINT } from "@solana/spl-token";
import { type Connection, PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import { initSdk } from "../index";
import { isValidCpmm } from "./utils";

export interface SwapParams {
	umi: Umi;
	connection: Connection;
	network: Network;
	poolIdParam?: string;
	inputAmountParam?: BN;
	inputMintParam?: string;
	slippageParam?: number;
	baseInParam?: boolean;
	txTipConfig?: {
		address: PublicKey;
		amount: BN;
	};
}

export const swap = async ({
	umi: baseUmi,
	connection,
	network,
	poolIdParam,
	inputAmountParam,
	inputMintParam,
	slippageParam,
	baseInParam,
	txTipConfig,
}: SwapParams) => {
	const raydium = await initSdk(baseUmi, connection, network, {
		loadToken: true,
	});

	// SOL - USDC pool
	const poolId = "7JuwJuNU88gurFnyWeiyGKbFmExMWcmRZntn9imEzdny";
	const inputAmount = new BN(100);
	const inputMint = NATIVE_MINT.toBase58();

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
		inputMint !== poolInfo.mintA.address &&
		inputMint !== poolInfo.mintB.address
	)
		throw new Error("input mint does not match pool");

	const baseIn = inputMint === poolInfo.mintA.address;

	// swap pool mintA for mintB
	const swapResult = CurveCalculator.swap(
		inputAmount,
		baseIn ? rpcData.baseReserve : rpcData.quoteReserve,
		baseIn ? rpcData.quoteReserve : rpcData.baseReserve,
		rpcData.configInfo!.tradeFeeRate,
	);

	/**
	 * swapResult.sourceAmountSwapped -> input amount
	 * swapResult.destinationAmountSwapped -> output amount
	 * swapResult.tradeFee -> this swap fee, charge input mint
	 */

	const { execute } = await raydium.cpmm.swap({
		poolInfo,
		poolKeys,
		inputAmount,
		swapResult,
		slippage: 0.001, // range: 1 ~ 0.0001, means 100% ~ 0.01%
		baseIn,
		// optional: set up priority fee here
		computeBudgetConfig: {
			units: 600000,
			microLamports: 2500000,
		},

		// optional: add transfer sol to tip account instruction. e.g sent tip to jito
		txTipConfig: {
			address: new PublicKey("96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5"),
			amount: new BN(5000000), // 0.01 sol
		},
	});

	// don't want to wait confirm, set sendAndConfirm to false or don't pass any params to execute
	const { txId } = await execute({ sendAndConfirm: true });
	if (network === Network.MAINNET) {
		console.log(
			`swapped: ${poolInfo.mintA.symbol} to ${poolInfo.mintB.symbol}:`,
			{
				txId: `https://explorer.solana.com/tx/${txId}`,
			},
		);
	} else {
		console.log(
			`swapped: ${poolInfo.mintA.symbol} to ${poolInfo.mintB.symbol}:`,
			{
				txId: `https://explorer.solana.com/tx/${txId}?cluster=${network}`,
			},
		);
	}
	return txId;
};

/** uncomment code below to execute */
// swap()

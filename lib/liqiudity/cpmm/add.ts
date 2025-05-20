import type { Network } from "@/store/useUmiStore"; // Added Network import
import {
	type Signer,
	type Umi,
	signerIdentity,
} from "@metaplex-foundation/umi"; // Added Umi and Signer imports
import {
	type ApiV3PoolInfoStandardItemCpmm,
	type CpmmKeys,
	Percent,
} from "@raydium-io/raydium-sdk-v2";
import type { Connection } from "@solana/web3.js"; // Added Connection import
import BN from "bn.js";
import Decimal from "decimal.js";
import { initSdk, txVersion } from "../index";
import { isValidCpmm } from "./utils";

export interface AddToCPMMPoolParams {
	umi: Umi;
	connection: Connection;
	network: Network;
	signer: Signer;
	poolIdParam?: string;
	uiInputAmountParam?: string; // To allow customizing the input amount
}

export const addToCPMMPool = async ({
	umi: baseUmi,
	connection,
	network,
	signer,
	poolIdParam,
	uiInputAmountParam,
}: AddToCPMMPoolParams) => {
	// Removed: const { umi, connection: getConnection, network } = useUmiStore.getState();

	if (!signer) {
		const errorMessage = "Signer not provided.";
		console.error(errorMessage);
		throw new Error(errorMessage);
	}

	const umiWithSigner = baseUmi.use(signerIdentity(signer));

	const raydium = await initSdk(umiWithSigner, connection, network, {
		loadToken: true, // Necessary for poolInfo.mintA.decimals
	});

	if (!raydium) {
		console.error("Failed to initialize Raydium SDK");
		throw new Error("Failed to initialize Raydium SDK");
	}

	// SOL - USDC pool
	const poolId = poolIdParam || "6rXSohG2esLJMzKZzpFr1BXUeXg8Cr5Gv3TwbuXbrwQq";
	let poolInfo: ApiV3PoolInfoStandardItemCpmm;
	let poolKeys: CpmmKeys | undefined;

	if (raydium.cluster === "mainnet") {
		// note: api doesn't support get devnet pool info, so in devnet else we go rpc method
		// if you wish to get pool info from rpc, also can modify logic to go rpc method directly
		const data = await raydium.api.fetchPoolById({ ids: poolId });
		poolInfo = data[0] as ApiV3PoolInfoStandardItemCpmm;
		if (!isValidCpmm(poolInfo.programId))
			throw new Error("target pool is not CPMM pool");
	} else {
		const data = await raydium.cpmm.getPoolInfoFromRpc(poolId);
		poolInfo = data.poolInfo;
		poolKeys = data.poolKeys;
	}

	const uiInputAmount = uiInputAmountParam || "0.0001"; // Use param or default
	const inputAmount = new BN(
		new Decimal(uiInputAmount).mul(10 ** poolInfo.mintA.decimals).toFixed(0),
	);
	const slippage = new Percent(1, 100); // 1%
	const baseIn = true;

	// computePairAmount is not necessary, addLiquidity will compute automatically,
	// just for ui display
	/*
	const res = await raydium.cpmm.getRpcPoolInfos([poolId]);
	const pool1Info = res[poolId];

	const computeRes = await raydium.cpmm.computePairAmount({
		baseReserve: pool1Info.baseReserve,
		quoteReserve: pool1Info.quoteReserve,
		poolInfo,
		amount: uiInputAmount,
		slippage,
		baseIn,
		epochInfo: await raydium.fetchEpochInfo()
	});

	computeRes.anotherAmount.amount -> pair amount needed to add liquidity
	computeRes.anotherAmount.fee -> token2022 transfer fee, might be undefined if isn't token2022 program
	*/

	const { execute } = await raydium.cpmm.addLiquidity({
		poolInfo,
		poolKeys,
		inputAmount,
		slippage,
		baseIn,
		txVersion,
		computeBudgetConfig: {
			units: 600000,
			microLamports: 46591500,
		},

		// optional: add transfer sol to tip account instruction. e.g sent tip to jito
		// txTipConfig: {
		//   address: new PublicKey('96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5'),
		//   amount: new BN(10000000), // 0.01 sol
		// },
	});
	// don't want to wait confirm, set sendAndConfirm to false or don't pass any params to execute
	// const { txId } = await execute({ sendAndConfirm: true })
	// console.log('pool deposited', { txId: `https://explorer.solana.com/tx/${txId}` })
	// process.exit() // if you don't want to end up node execution, comment this line
};

/**
 * Example of how to call this function.
 * You would typically call this from a part of your application
 * where the Umi store is confirmed to be initialized (e.g., after wallet connection).
 */
// async function exampleAddLiquidityUsage() {
//   try {
//     // Ensure Umi store is ready before calling
//     // For example, in a React component after wallet connection:
//     // if (useUmiStore.getState().umi) {
//     //   await addToCPMMPool("6rXSohG2esLJMzKZzpFr1BXUeXg8Cr5Gv3TwbuXbrwQq"); // Example with a specific pool
//     //   await addToCPMMPool(); // Example using the default poolId in the function
//     // }
//   } catch (error) {
//     console.error("Failed to add liquidity in example:", error);
//   }
// }

// The direct call below might cause issues if the Umi store is not yet initialized
// when this module is loaded. It's generally better to call such functions
// from a context where initialization is guaranteed.
// addToCPMMPool();

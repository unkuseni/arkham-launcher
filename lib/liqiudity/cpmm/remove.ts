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
import { type Connection, PublicKey } from "@solana/web3.js"; // Added Connection import
import BN from "bn.js";
import { initSdk, txVersion } from "../index";
import { isValidCpmm } from "./utils";

export interface RemoveFromCPMMPoolParams {
	umi: Umi;
	connection: Connection;
	network: Network;
	signer: Signer;
	poolIdParam?: string;
	lpAmountParam?: BN;
}

export const removeFromCPMMPool = async ({
	umi: baseUmi,
	connection,
	network,
	signer,
	poolIdParam,
	lpAmountParam,
}: RemoveFromCPMMPoolParams) => {
	if (!signer) {
		const errorMessage = "Signer not provided.";
		console.error(errorMessage);
		throw new Error(errorMessage);
	}

	const umiWithSigner = baseUmi.use(signerIdentity(signer));

	const raydium = await initSdk(umiWithSigner, connection, network, {
		loadToken: true, // Pool info fetching might need token details
	});

	if (!raydium) {
		console.error("Failed to initialize Raydium SDK");
		throw new Error("Failed to initialize Raydium SDK");
	}

	// SOL - USDC pool
	const poolId = poolIdParam || "7JuwJuNU88gurFnyWeiyGKbFmExMWcmRZntn9imEzdny";
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

	const slippage = new Percent(1, 100); // 1%
	const lpAmount = lpAmountParam || new BN(100); // Use parameter or default

	const { execute } = await raydium.cpmm.withdrawLiquidity({
		poolInfo,
		poolKeys,
		lpAmount,
		txVersion,
		slippage,

		// closeWsol: false, // default if true, if you want use wsol, you need set false

		computeBudgetConfig: {
			units: 600000,
			microLamports: 46591500,
		},
		txTipConfig: {
			address: new PublicKey("96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5"),
			amount: new BN(10000000), // 0.01 sol
		},
	});

	// don't want to wait confirm, set sendAndConfirm to false or don't pass any params to execute
	const { txId } = await execute({ sendAndConfirm: true });
	// console.log('pool withdraw:', {
	// 	txId: `https://explorer.solana.com/tx/${txId}`,
	// });
	// process.exit(); // if you don't want to end up node execution, comment this line
};

/** uncomment code below to execute */
// async function exampleWithdrawUsage() {
//   try {
//     // Ensure Umi store is ready before calling
//     // For example, in a React component after wallet connection:
//     // if (useUmiStore.getState().umi) {
//     //   await removeFromCPMMPool("7JuwJuNU88gurFnyWeiyGKbFmExMWcmRZntn9imEzdny", new BN(50)); // Example
//     //   await removeFromCPMMPool(); // Example using defaults
//     // }
//   }
//   catch (error) {
//     console.error("Failed to withdraw liquidity in example:", error);
//   }
// }
// exampleWithdrawUsage(); // Call the example usage function if needed for testing

import { Network } from "@/store/useUmiStore";
import type { Umi } from "@metaplex-foundation/umi";
import {
	type ApiV3PoolInfoStandardItemCpmm,
	type CpmmKeys,
	DEV_LOCK_CPMM_AUTH,
	DEV_LOCK_CPMM_PROGRAM,
} from "@raydium-io/raydium-sdk-v2";
import { type Connection, PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import { initSdk, txVersion } from "../index";
import { isValidCpmm } from "./utils";

export interface HarvestLockLiquidityParams {
	umi: Umi;
	connection: Connection;
	network: Network;
	poolIdParam?: string;
	lpAmountParam?: BN;
	txTipConfig?: {
		address: PublicKey;
		amount: BN;
	};
}

export const harvestLockLiquidity = async ({
	umi,
	connection,
	network,
	poolIdParam,
	lpAmountParam,
	txTipConfig,
}: HarvestLockLiquidityParams) => {
	const raydium = await initSdk(umi, connection, network, {
		loadToken: true,
	});

	const poolId = poolIdParam || "2umXxGh6jY63wDHHQ4yDv8BJbjzLNnKgYDwRqas75nnt";

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

	if (Network.MAINNET === network) {
		const { execute, transaction } = await raydium.cpmm.harvestLockLp({
			poolInfo,
			nftMint: new PublicKey("CgkdQL6eRN1nxG2AmC8NFG5iboXuKtSjT4pShnspomZy"), // locked nft mint
			lpFeeAmount: new BN(99999999),
			txVersion,

			// closeWsol: false, // default if true, if you want use wsol, you need set false

			// optional: add transfer sol to tip account instruction. e.g sent tip to jito
			txTipConfig: {
				address: new PublicKey("96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5"),
				amount: new BN(10000000), // 0.01 sol
			},
		});

		const { txId } = await execute({ sendAndConfirm: true });
		console.log("lp locked", {
			txId: `https://explorer.solana.com/tx/${txId}`,
		});
		return { txId };
	}
	// devnet
	const { execute, transaction } = await raydium.cpmm.harvestLockLp({
		programId: DEV_LOCK_CPMM_PROGRAM,
		authProgram: DEV_LOCK_CPMM_AUTH,
		poolKeys,
		poolInfo,
		nftMint: new PublicKey("CgkdQL6eRN1nxG2AmC8NFG5iboXuKtSjT4pShnspomZy"), // locked nft mint
		lpFeeAmount: new BN(99999999),
		txVersion,
		closeWsol: false, // default if true, if you want use wsol, you need set false
		txTipConfig: {
			address: new PublicKey("96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5"),
			amount: new BN(10000000), // 0.01 sol
		},
	});
	const { txId } = await execute({ sendAndConfirm: true });
	console.log("lp locked", {
		txId: `https://explorer.solana.com/tx/${txId}?cluster=${raydium.cluster}`,
	});
	return { txId };
};

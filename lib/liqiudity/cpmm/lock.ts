import { Network } from "@/store/useUmiStore";
import type { Umi } from "@metaplex-foundation/umi";
import {
	type ApiV3PoolInfoStandardItemCpmm,
	type CpmmKeys,
	DEV_LOCK_CPMM_AUTH,
	DEV_LOCK_CPMM_PROGRAM,
} from "@raydium-io/raydium-sdk-v2";
import type { Connection, PublicKey } from "@solana/web3.js";
import type BN from "bn.js";
import { initSdk, txVersion } from "../index";
import { isValidCpmm } from "./utils";

export interface LockLiquidityParams {
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

export const lockLiquidity = async ({
	umi,
	connection,
	network,
	poolIdParam,
	lpAmountParam,
}: LockLiquidityParams) => {
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

	/** if you know about how much liquidity amount can lock, you can skip code below to fetch account balance */
	await raydium.account.fetchWalletTokenAccounts();
	const lpBalance = raydium.account.tokenAccounts.find(
		(a) => a.mint.toBase58() === poolInfo.lpMint.address,
	);
	if (!lpBalance) throw new Error(`you do not have balance in pool: ${poolId}`);
	if (Network.MAINNET === network) {
		const { execute, extInfo } = await raydium.cpmm.lockLp({
			// programId: DEV_LOCK_CPMM_PROGRAM, // devnet
			// authProgram: DEV_LOCK_CPMM_AUTH, // devnet
			// poolKeys, // devnet
			poolInfo,
			lpAmount: lpAmountParam || lpBalance.amount,
			withMetadata: true,
			txVersion,
		});
		const { txId } = await execute({ sendAndConfirm: true });
		if (network === Network.MAINNET) {
			console.log("Liquidity locked:", {
				txId: `https://explorer.solana.com/tx/${txId}`,
			});
		} else {
			console.log("Liquidity locked:", {
				txId: `https://explorer.solana.com/tx/${txId}?cluster=${network}`,
			});
		}
		return txId;
	}
	const { execute } = await raydium.cpmm.lockLp({
		programId: DEV_LOCK_CPMM_PROGRAM,
		authProgram: DEV_LOCK_CPMM_AUTH,
		poolKeys,
		poolInfo,
		lpAmount: lpBalance.amount,
		withMetadata: true,
		txVersion,
	});
	const { txId } = await execute({ sendAndConfirm: true });
	console.log("Liquidity locked:", {
		txId: `https://explorer.solana.com/tx/${txId}?cluster=${network}`,
	});
	return txId;
};

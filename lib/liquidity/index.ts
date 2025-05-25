import { Network } from "@/store/useUmiStore";
import type { Umi } from "@metaplex-foundation/umi";
import { toWeb3JsPublicKey } from "@metaplex-foundation/umi-web3js-adapters";
import {
	Raydium,
	TxVersion,
	parseTokenAccountResp,
} from "@raydium-io/raydium-sdk-v2";
import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
	type Connection,
	type PublicKey as Web3JsPublicKey,
	clusterApiUrl,
} from "@solana/web3.js";

export const txVersion = TxVersion.V0; // or TxVersion.LEGACY

let raydium: Raydium | undefined;
export const initSdk = async (
	appUmi: Umi,
	appConnection: Connection,
	appNetwork: Network,
	params?: { loadToken?: boolean },
) => {
	if (raydium) return raydium;

	const owner = toWeb3JsPublicKey(appUmi.identity.publicKey);
	const cluster = appNetwork === Network.MAINNET ? "mainnet" : "devnet";

	if (appUmi.rpc.getEndpoint() === clusterApiUrl("mainnet-beta"))
		console.warn(
			"using free rpc node might cause unexpected error, strongly suggest uses paid rpc node",
		);
	console.info(`Connected to rpc ${appUmi.rpc.getEndpoint()} in ${cluster}`);
	raydium = await Raydium.load({
		owner,
		connection: appConnection, // Use passed-in appConnection
		cluster,
		disableFeatureCheck: true,
		disableLoadToken: !params?.loadToken,
		blockhashCommitment: "finalized",
		// urlConfigs: {
		//   BASE_HOST: '<API_HOST>', // api url configs, currently api doesn't support devnet
		// },
	});

	/**
	 * By default: sdk will automatically fetch token account data when need it or any sol balace changed.
	 * if you want to handle token account by yourself, set token account data after init sdk
	 * code below shows how to do it.
	 * note: after call raydium.account.updateTokenAccount, raydium will not automatically fetch token account
	 */

	/*  
  raydium.account.updateTokenAccount(await fetchTokenAccountData())
  connection.onAccountChange(owner.publicKey, async () => {
    raydium!.account.updateTokenAccount(await fetchTokenAccountData())
  })
  */

	return raydium;
};

export const fetchTokenAccountData = async (
	appConnection: Connection,
	appOwnerPublicKey: Web3JsPublicKey,
) => {
	const solAccountResp = await appConnection.getAccountInfo(appOwnerPublicKey);
	const tokenAccountResp = await appConnection.getTokenAccountsByOwner(
		appOwnerPublicKey,
		{ programId: TOKEN_PROGRAM_ID },
	);
	const token2022Req = await appConnection.getTokenAccountsByOwner(
		appOwnerPublicKey,
		{ programId: TOKEN_2022_PROGRAM_ID },
	);
	const tokenAccountData = parseTokenAccountResp({
		owner: appOwnerPublicKey,
		solAccountResp,
		tokenAccountResp: {
			context: tokenAccountResp.context,
			value: [...tokenAccountResp.value, ...token2022Req.value],
		},
	});
	return tokenAccountData;
};

export const grpcUrl = "<YOUR_GRPC_URL>";
export const grpcToken = "<YOUR_GRPC_TOKEN>";

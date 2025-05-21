// Top-level imports
import type { Network } from "@/store/useUmiStore"; // Added Network import
import {
	type Signer,
	type Umi,
	signerIdentity,
} from "@metaplex-foundation/umi"; // Added Umi and Signer imports
import {
	type ApiCpmmConfigInfo,
	DEVNET_PROGRAM_ID,
	CREATE_CPMM_POOL_FEE_ACC as MAINNET_CREATE_CPMM_POOL_FEE_ACC,
	CREATE_CPMM_POOL_PROGRAM as MAINNET_CREATE_CPMM_POOL_PROGRAM,
	getCpmmPdaAmmConfigId,
} from "@raydium-io/raydium-sdk-v2";
import type { Connection } from "@solana/web3.js"; // Added Connection import
import BN from "bn.js";
import { initSdk, txVersion } from "..";

const feeConfigCache: Record<string, ApiCpmmConfigInfo[]> = {}; // Corrected type for cache value

export interface CreateCPMMPoolParams {
	umi: Umi;
	connection: Connection;
	network: Network;
	signer: Signer;

	mintAAddress: string;
	mintBAddress: string;
	mintAAmount: BN;
	mintBAmount: BN;
	startTime?: BN;
}

export const createCPMMPool = async ({
	umi: baseUmi, // Renamed for clarity
	connection,
	network,
	signer,
	mintAAddress,
	mintBAddress,
	mintAAmount,
	mintBAmount,
	startTime,
}: CreateCPMMPoolParams) => {
	// Removed: const { umi: baseUmi, connection, network, signer } = useUmiStore.getState();

	if (!signer) {
		const errorMessage = "Signer not provided."; // Updated error message
		console.error(errorMessage);
		throw new Error(errorMessage);
	}

	// Ensure the Umi instance uses the actual signer from the wallet
	const umiWithSigner = baseUmi.use(signerIdentity(signer));

	// Initialize Raydium SDK
	const raydium = await initSdk(umiWithSigner, connection, network, {
		// Use umiWithSigner and passed-in connection, network
		loadToken: true,
	});

	if (!raydium) {
		const errorMessage = "Failed to initialize Raydium SDK";
		console.error(errorMessage);
		throw new Error(errorMessage);
	}

	// Fetch token details
	// The SDK's getTokenInfo can take string or PublicKey (from Raydium's perspective, not Umi's)
	// For simplicity, we'll assume string addresses are passed and let getTokenInfo handle them.
	// If Umi's PublicKey is passed, it would need conversion if getTokenInfo doesn't handle it.
	const mintA = await raydium.token.getTokenInfo(mintAAddress);
	const mintB = await raydium.token.getTokenInfo(mintBAddress);

	// Cache logic for feeConfigs
	const cluster = raydium.cluster;
	let feeConfigsToUse: ApiCpmmConfigInfo[];

	if (feeConfigCache[cluster]) {
		console.log(`Using cached CPMM fee configurations for ${cluster}.`);
		feeConfigsToUse = feeConfigCache[cluster];
	} else {
		console.log(`Fetching CPMM fee configurations for ${cluster}...`);
		const fetchedConfigs = await raydium.api.getCpmmConfigs();
		if (cluster === "devnet" && fetchedConfigs) {
			for (const config of fetchedConfigs) {
				config.id = getCpmmPdaAmmConfigId(
					DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_PROGRAM,
					config.index,
				).publicKey.toBase58();
			}
		}
		feeConfigCache[cluster] = fetchedConfigs || [];
		feeConfigsToUse = feeConfigCache[cluster];
	}

	const currentCreateCpmmPoolProgram =
		raydium.cluster === "devnet"
			? DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_PROGRAM
			: MAINNET_CREATE_CPMM_POOL_PROGRAM;
	const currentCreateCpmmPoolFeeAcc =
		raydium.cluster === "devnet"
			? DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_FEE_ACC
			: MAINNET_CREATE_CPMM_POOL_FEE_ACC;

	if (!feeConfigsToUse || feeConfigsToUse.length === 0) {
		// Use feeConfigsToUse
		const errorMessage = `No CPMM fee configurations found for ${cluster}.`; // Use feeConfigsToUse
		console.error(errorMessage);
		throw new Error(errorMessage);
	}

	const { execute, extInfo } = await raydium.cpmm.createPool({
		programId: currentCreateCpmmPoolProgram,
		poolFeeAccount: currentCreateCpmmPoolFeeAcc,
		mintA,
		mintB,
		mintAAmount,
		mintBAmount,
		startTime: startTime ?? new BN(0),
		feeConfig: feeConfigsToUse[0], // Use feeConfigsToUse
		associatedOnly: false,
		ownerInfo: {
			useSOLBalance: true, // Assumes the owner (signer) will pay with SOL if needed
		},
		txVersion,
		computeBudgetConfig: { units: 600000, microLamports: 46591500 },
	});

	try {
		// Set sendAndConfirm to true to wait for confirmation
		const { txId } = await execute({ sendAndConfirm: true });
		console.log("CPMM Pool created", {
			txId,
			poolKeys: Object.keys(extInfo.address).reduce(
				(acc, cur) => {
					acc[cur] =
						extInfo.address[cur as keyof typeof extInfo.address].toString();
					return acc;
				},
				{} as Record<string, string>,
			),
		});
		return { txId, extInfo };
	} catch (error) {
		console.error("Failed to create CPMM pool or send transaction:", error);
		throw error; // Re-throw the error to be handled by the caller
	}
};

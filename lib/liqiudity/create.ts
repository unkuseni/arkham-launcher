// Top-level imports
import useUmiStore from "@/store/useUmiStore";
import {
	CREATE_CPMM_POOL_FEE_ACC as MAINNET_CREATE_CPMM_POOL_FEE_ACC,
	CREATE_CPMM_POOL_PROGRAM as MAINNET_CREATE_CPMM_POOL_PROGRAM, // Alias to avoid confusion
	DEVNET_PROGRAM_ID,
	getCpmmPdaAmmConfigId,
} from "@raydium-io/raydium-sdk-v2";
import { signerIdentity } from "@metaplex-foundation/umi";
import BN from "bn.js";
import { initSdk, txVersion } from "./config"; // Corrected path

export interface CreateCPMMPoolParams {
  mintAAddress: string;
  mintBAddress: string;
	mintAAmount: BN;
	mintBAmount: BN;
	startTime?: BN;
	// Optional: Add a way to pass specific feeConfig if needed, or logic to select one
}

export const createCPMMPool = async ({
	mintAAddress,
	mintBAddress,
	mintAAmount,
	mintBAmount,
	startTime,
}: CreateCPMMPoolParams) => {
	const {
		umi: baseUmi,
		connection,
		network,
		signer,
	} = useUmiStore.getState();

	if (!signer) {
		const errorMessage = "Wallet not connected. Signer is undefined.";
		console.error(errorMessage);
		throw new Error(errorMessage);
	}

	// Ensure the Umi instance uses the actual signer from the wallet
	const umi = baseUmi.use(signerIdentity(signer));

	// Initialize Raydium SDK
	const raydium = await initSdk(umi, connection(), network, {
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

	const feeConfigs = await raydium.api.getCpmmConfigs();

	if (raydium.cluster === "devnet") {
		feeConfigs.forEach((config) => {
			config.id = getCpmmPdaAmmConfigId(
				DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_PROGRAM,
				config.index,
			).publicKey.toBase58();
		});
	}

	const currentCreateCpmmPoolProgram =
		raydium.cluster === "devnet"
			? DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_PROGRAM
			: MAINNET_CREATE_CPMM_POOL_PROGRAM;
	const currentCreateCpmmPoolFeeAcc =
		raydium.cluster === "devnet"
			? DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_FEE_ACC
			: MAINNET_CREATE_CPMM_POOL_FEE_ACC;

	if (!feeConfigs || feeConfigs.length === 0) {
		const errorMessage = "No CPMM fee configurations found.";
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
		feeConfig: feeConfigs[0], // Using the first available fee config
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
    console.log('CPMM Pool created', {
      txId,
      poolKeys: Object.keys(extInfo.address).reduce(
        (acc, cur) => ({
          ...acc,
          [cur]: extInfo.address[cur as keyof typeof extInfo.address].toString(),
        }),
        {}
      ),
    });
		return { txId, extInfo };
	} catch (error) {
		console.error("Failed to create CPMM pool or send transaction:", error);
		throw error; // Re-throw the error to be handled by the caller
	}
};

export const createCLMMPool = async () => {
	// TODO: Implement CLMM pool creation using initSdk from config.ts
	// Similar structure:
	// 1. Get umi, connection, network, signer from useUmiStore.
	// 2. Ensure signer exists and update baseUmi with signerIdentity.
	// 3. Call initSdk(umi, connection(), network, { loadToken: true }).
	// 4. Fetch token infos, CLMM configs (e.g., await raydium.api.getClmmConfigs()).
	// 5. Prepare parameters for raydium.clmm.createPool (e.g., price range, initial amounts).
	//    Note: CLMM pool creation is more complex and requires defining a price range (tickLower, tickUpper).
	//    const { execute, extInfo, transaction } = await raydium.clmm.createPool({
	//      programId: CLMM_PROGRAM_ID, // Check Raydium SDK for correct CLMM program ID
	//      mintA: mintAInfo,
	//      mintB: mintBInfo,
	//      ammConfig: clmmConfigs[0], // Select appropriate config
	//      initAmountA: new BN(1000000), // Example amount
	//      initAmountB: new BN(1000000), // Example amount
	//      tickLower, // Calculated based on desired price range
	//      tickUpper, // Calculated based on desired price range
	//      startTime: new BN(Math.floor(Date.now() / 1000)) // Optional start time
	//      txVersion,
	//      ownerInfo: { useSOLBalance: true }
	//    });
	// 6. Execute transaction and handle response/errors.
	console.warn("createCLMMPool is not yet implemented.");
};

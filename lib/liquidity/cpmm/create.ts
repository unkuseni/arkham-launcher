import type { Network } from "@/store/useUmiStore";
import {
	findAssociatedTokenPda,
	transferSol,
} from "@metaplex-foundation/mpl-toolbox";
import {
	type Signer,
	type Umi,
	publicKey,
	signerIdentity,
	sol,
	transactionBuilder,
} from "@metaplex-foundation/umi";
import { fromWeb3JsTransaction } from "@metaplex-foundation/umi-web3js-adapters";
import { base58 } from "@metaplex-foundation/umi/serializers";
import {
	type ApiCpmmConfigInfo,
	DEVNET_PROGRAM_ID,
	CREATE_CPMM_POOL_FEE_ACC as MAINNET_CREATE_CPMM_POOL_FEE_ACC,
	CREATE_CPMM_POOL_PROGRAM as MAINNET_CREATE_CPMM_POOL_PROGRAM,
	type TokenInfo,
	getCpmmPdaAmmConfigId,
} from "@raydium-io/raydium-sdk-v2";
import type { Connection } from "@solana/web3.js";
import BN from "bn.js";
import { initSdk, txVersion } from "..";

const SOL_MINT_ADDRESS = "So11111111111111111111111111111111111111112"; // Wrapped SOL mint
const NATIVE_SOL_MINT = "11111111111111111111111111111111";

// Enhanced error types for better error handling
export class CPMMPoolCreationError extends Error {
	constructor(
		message: string,
		public readonly code: string,
		public readonly details?: any,
	) {
		super(message);
		this.name = "CPMMPoolCreationError";
	}
}

// Fee config cache with TTL for freshness
interface CachedFeeConfig {
	configs: ApiCpmmConfigInfo[];
	timestamp: number;
	ttl: number; // Time to live in milliseconds
}

const feeConfigCache: Record<string, CachedFeeConfig> = {};
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

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
	feeConfigIndex?: number; // Allow custom fee config selection
	computeBudgetUnits?: number; // Configurable compute budget
	computeBudgetMicroLamports?: number;
}

export interface CreateCPMMPoolResult {
	txId: string;
	poolId: string;
	poolKeys: Record<string, string>;
	mintA: TokenInfo;
	mintB: TokenInfo;
	timestamp: number;
}

/**
 * Validates the input parameters for pool creation
 */
function validateParams(params: CreateCPMMPoolParams): void {
	const { mintAAddress, mintBAddress, mintAAmount, mintBAmount, signer } =
		params;

	if (!signer) {
		throw new CPMMPoolCreationError(
			"Signer is required for pool creation",
			"MISSING_SIGNER",
		);
	}

	if (!mintAAddress || !mintBAddress) {
		throw new CPMMPoolCreationError(
			"Both mint addresses are required",
			"INVALID_MINT_ADDRESSES",
		);
	}

	if (mintAAddress === mintBAddress) {
		throw new CPMMPoolCreationError(
			"Mint addresses must be different",
			"DUPLICATE_MINT_ADDRESSES",
		);
	}

	if (mintAAmount.lte(new BN(0)) || mintBAmount.lte(new BN(0))) {
		throw new CPMMPoolCreationError(
			"Token amounts must be greater than zero",
			"INVALID_AMOUNTS",
		);
	}
}

/**
 * Gets fee configurations with caching and TTL
 */
async function getFeeConfigs(
	raydium: any,
	cluster: string,
): Promise<ApiCpmmConfigInfo[]> {
	const now = Date.now();
	const cached = feeConfigCache[cluster];

	// Check if cache is valid and not expired
	if (cached && now - cached.timestamp < cached.ttl) {
		console.log(`Using cached CPMM fee configurations for ${cluster}`);
		return cached.configs;
	}

	console.log(`Fetching fresh CPMM fee configurations for ${cluster}...`);

	try {
		const fetchedConfigs = await raydium.api.getCpmmConfigs();

		if (!fetchedConfigs || fetchedConfigs.length === 0) {
			throw new CPMMPoolCreationError(
				`No CPMM fee configurations available for ${cluster}`,
				"NO_FEE_CONFIGS",
			);
		}

		// Handle devnet-specific ID generation
		if (cluster === "devnet") {
			for (const config of fetchedConfigs) {
				config.id = getCpmmPdaAmmConfigId(
					DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_PROGRAM,
					config.index,
				).publicKey.toBase58();
			}
		}

		// Cache the configs with TTL
		feeConfigCache[cluster] = {
			configs: fetchedConfigs,
			timestamp: now,
			ttl: CACHE_TTL,
		};
		console.log(fetchedConfigs);
		return fetchedConfigs;
	} catch (error) {
		throw new CPMMPoolCreationError(
			`Failed to fetch fee configurations: ${error instanceof Error ? error.message : String(error)}`,
			"FEE_CONFIG_FETCH_ERROR",
			error,
		);
	}
}

/**
 * Fetches token information with error handling
 */
async function getTokenInfo(
	raydium: any,
	mintAddress: string,
	tokenLabel: string,
): Promise<TokenInfo> {
	try {
		const tokenInfo = await raydium.token.getTokenInfo(mintAddress);

		if (!tokenInfo) {
			throw new CPMMPoolCreationError(
				`Token information not found for ${tokenLabel}`,
				"TOKEN_INFO_NOT_FOUND",
			);
		}

		return tokenInfo;
	} catch (error) {
		throw new CPMMPoolCreationError(
			`Failed to fetch ${tokenLabel} token info: ${error instanceof Error ? error.message : String(error)}`,
			"TOKEN_INFO_FETCH_ERROR",
			{ mintAddress, error },
		);
	}
}

export const createCPMMPool = async (
	params: CreateCPMMPoolParams,
): Promise<CreateCPMMPoolResult> => {
	const startTime = Date.now();

	try {
		// Validate all input parameters
		validateParams(params);

		const {
			umi: baseUmi,
			connection,
			network,
			signer,
			mintAAddress,
			mintBAddress,
			mintAAmount,
			mintBAmount,
			startTime: poolStartTime,
			feeConfigIndex = 0,
			computeBudgetUnits = 600000,
			computeBudgetMicroLamports = 46591500,
		} = params;

		// Create Umi instance with signer
		const umiWithSigner = baseUmi.use(signerIdentity(signer));

		// Initialize Raydium SDK
		console.log("Initializing Raydium SDK...");
		const raydium = await initSdk(umiWithSigner, connection, network, {
			loadToken: true,
		});

		if (!raydium) {
			throw new CPMMPoolCreationError(
				"Failed to initialize Raydium SDK",
				"SDK_INIT_FAILED",
			);
		}

		// Fetch token information concurrently
		console.log("Fetching token information...");
		const [mintA, mintB] = await Promise.all([
			getTokenInfo(raydium, mintAAddress, "Token A"),
			getTokenInfo(raydium, mintBAddress, "Token B"),
		]);

		// Get fee configurations
		const cluster = raydium.cluster;
		const feeConfigs = await getFeeConfigs(raydium, cluster);

		if (feeConfigIndex >= feeConfigs.length) {
			throw new CPMMPoolCreationError(
				`Fee config index ${feeConfigIndex} is out of range (0-${feeConfigs.length - 1})`,
				"INVALID_FEE_CONFIG_INDEX",
			);
		}

		// Determine program IDs based on cluster
		const currentCreateCpmmPoolProgram =
			cluster === "devnet"
				? DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_PROGRAM
				: MAINNET_CREATE_CPMM_POOL_PROGRAM;

		const currentCreateCpmmPoolFeeAcc =
			cluster === "devnet"
				? DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_FEE_ACC
				: MAINNET_CREATE_CPMM_POOL_FEE_ACC;

		console.log("Creating CPMM pool...");

		if (mintBAddress === "11111111111111111111111111111111") {
			const normalAmount = mintBAmount.toNumber() / 10 ** 9;
			const wrapSolTx = transactionBuilder().add(
				transferSol(umiWithSigner, {
					destination: findAssociatedTokenPda(umiWithSigner, {
						mint: publicKey(SOL_MINT_ADDRESS),
						owner: signer.publicKey,
					}),
					amount: sol(normalAmount),
				}),
			);
			await wrapSolTx.sendAndConfirm(umiWithSigner);
		} else if (mintAAddress === NATIVE_SOL_MINT) {
			const normalAmount = mintAAmount.toNumber() / 10 ** 9;
			const wrapSolTx = transactionBuilder().add(
				transferSol(umiWithSigner, {
					destination: findAssociatedTokenPda(umiWithSigner, {
						mint: publicKey(SOL_MINT_ADDRESS),
						owner: signer.publicKey,
					}),
					amount: sol(normalAmount),
				}),
			);
			await wrapSolTx.sendAndConfirm(umiWithSigner);
		}

		const { extInfo, transaction } = await raydium.cpmm.createPool({
			programId: currentCreateCpmmPoolProgram,
			poolFeeAccount: currentCreateCpmmPoolFeeAcc,
			mintA,
			mintB,
			mintAAmount,
			mintBAmount,
			startTime: poolStartTime ?? new BN(0),
			feeConfig:
				feeConfigs.find((feeConfig) => feeConfig.index === feeConfigIndex) ||
				feeConfigs[feeConfigIndex],
			associatedOnly: false,
			ownerInfo: {
				useSOLBalance: true,
			},
			txVersion,
			computeBudgetConfig: {
				units: computeBudgetUnits,
				microLamports: computeBudgetMicroLamports,
			},
		});

		// Execute transaction with confirmation
		console.log("Sending transaction...");
		const umiTx = fromWeb3JsTransaction(transaction);
		const signedTx = await umiWithSigner.identity.signTransaction(umiTx);
		const resultTx = await umiWithSigner.rpc.sendTransaction(signedTx);
		const txId = base58.deserialize(resultTx)[0];

		// Transform pool keys for easier consumption
		const poolKeys = Object.keys(extInfo.address).reduce(
			(acc, key) => {
				acc[key] =
					extInfo.address[key as keyof typeof extInfo.address].toString();
				return acc;
			},
			{} as Record<string, string>,
		);

		const result: CreateCPMMPoolResult = {
			txId,
			poolId: poolKeys.id || "", // Assuming 'id' is the pool ID
			poolKeys,
			mintA,
			mintB,
			timestamp: startTime,
		};

		console.log("CPMM Pool created successfully", {
			txId,
			poolId: result.poolId,
			executionTime: Date.now() - startTime,
		});

		return result;
	} catch (error) {
		// Enhanced error logging
		console.error("Failed to create CPMM pool:", {
			error: error instanceof Error ? error.message : String(error),
			params: {
				mintAAddress: params.mintAAddress,
				mintBAddress: params.mintBAddress,
				network: params.network,
			},
			executionTime: Date.now() - startTime,
		});

		// Re-throw as our custom error type if it's not already
		if (error instanceof CPMMPoolCreationError) {
			throw error;
		}

		throw new CPMMPoolCreationError(
			`Pool creation failed: ${error instanceof Error ? error.message : String(error)}`,
			"POOL_CREATION_FAILED",
			error,
		);
	}
};

/**
 * Utility function to clear fee config cache (useful for testing or manual refresh)
 */
export function clearFeeConfigCache(cluster?: string): void {
	if (cluster) {
		delete feeConfigCache[cluster];
		console.log(`Cleared fee config cache for ${cluster}`);
	} else {
		for (const key of Object.keys(feeConfigCache)) {
			delete feeConfigCache[key];
		}
		console.log("Cleared all fee config cache");
	}
}

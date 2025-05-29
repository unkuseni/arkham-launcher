import type { Network } from "@/store/useUmiStore";
import {
	type Signer,
	type Umi,
	signerIdentity,
} from "@metaplex-foundation/umi";
import {
	type ApiClmmConfigInfo,
	CLMM_PROGRAM_ID,
	DEVNET_PROGRAM_ID,
	type Raydium,
	type TokenInfo,
} from "@raydium-io/raydium-sdk-v2";
import { type Connection, PublicKey } from "@solana/web3.js";
import Decimal from "decimal.js";
import { initSdk, txVersion } from "..";

// Enhanced error types for better error handling
export class CLMMPoolCreationError extends Error {
	constructor(
		message: string,
		public readonly code: string,
		public readonly details?: unknown,
	) {
		super(message);
		this.name = "CLMMPoolCreationError";
	}
}

// Config cache with TTL for freshness
interface CachedClmmConfig {
	configs: ApiClmmConfigInfo[];
	timestamp: number;
	ttl: number; // Time to live in milliseconds
}

const clmmConfigCache: Record<string, CachedClmmConfig> = {};
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export interface CreateCLMMPoolParams {
	umi: Umi;
	connection: Connection;
	network: Network;
	signer: Signer;
	mint1Address: string;
	mint2Address: string;
	initialPrice: number | string | Decimal;
	ammConfigIndex?: number; // Allow custom AMM config selection
	fundOwner?: string; // Pool fund owner
	description?: string; // Pool description
	computeBudgetUnits?: number; // Configurable compute budget
	computeBudgetMicroLamports?: number;
}

export interface CreateCLMMPoolResult {
	txId: string;
	poolId: string;
	poolKeys: Record<string, string>;
	mint1: TokenInfo;
	mint2: TokenInfo;
	initialPrice: Decimal;
	timestamp: number;
}

/**
 * Validates the input parameters for CLMM pool creation
 */
function validateParams(params: CreateCLMMPoolParams): void {
	const { mint1Address, mint2Address, initialPrice, signer } = params;

	if (!signer) {
		throw new CLMMPoolCreationError(
			"Signer is required for pool creation",
			"MISSING_SIGNER",
		);
	}

	if (!mint1Address || !mint2Address) {
		throw new CLMMPoolCreationError(
			"Both mint addresses are required",
			"INVALID_MINT_ADDRESSES",
		);
	}

	if (mint1Address === mint2Address) {
		throw new CLMMPoolCreationError(
			"Mint addresses must be different",
			"DUPLICATE_MINT_ADDRESSES",
		);
	}

	const price = new Decimal(initialPrice.toString());
	if (price.lte(0)) {
		throw new CLMMPoolCreationError(
			"Initial price must be greater than zero",
			"INVALID_INITIAL_PRICE",
		);
	}
}

/**
 * Gets CLMM configurations with caching and TTL
 */
async function getClmmConfigs(
	raydium: Raydium,
	cluster: string,
): Promise<ApiClmmConfigInfo[]> {
	const now = Date.now();
	const cached = clmmConfigCache[cluster];

	// Check if cache is valid and not expired
	if (cached && now - cached.timestamp < cached.ttl) {
		console.log(`Using cached CLMM configurations for ${cluster}`);
		return cached.configs;
	}

	console.log(`Fetching fresh CLMM configurations for ${cluster}...`);

	try {
		const fetchedConfigs = await raydium.api.getClmmConfigs();

		if (!fetchedConfigs || fetchedConfigs.length === 0) {
			throw new CLMMPoolCreationError(
				`No CLMM configurations available for ${cluster}`,
				"NO_CLMM_CONFIGS",
			);
		}

		// For devnet, configs may need special handling but we don't have the equivalent
		// of getCpmmPdaAmmConfigId for CLMM, so we'll use them as-is

		// Cache the configs with TTL
		clmmConfigCache[cluster] = {
			configs: fetchedConfigs,
			timestamp: now,
			ttl: CACHE_TTL,
		};

		return fetchedConfigs;
	} catch (error) {
		throw new CLMMPoolCreationError(
			`Failed to fetch CLMM configurations: ${error instanceof Error ? error.message : String(error)}`,
			"CLMM_CONFIG_FETCH_ERROR",
			error,
		);
	}
}

/**
 * Fetches token information with error handling
 */
async function getTokenInfo(
	raydium: Raydium,
	mintAddress: string,
	tokenLabel: string,
): Promise<TokenInfo> {
	try {
		const tokenInfo = await raydium.token.getTokenInfo(mintAddress);

		if (!tokenInfo) {
			throw new CLMMPoolCreationError(
				`Token information not found for ${tokenLabel}`,
				"TOKEN_INFO_NOT_FOUND",
			);
		}

		// Transform ApiV3Token to TokenInfo by adding required properties
		return {
			...tokenInfo,
			priority: 0,
			userAdded: false,
			type: "token",
		};
	} catch (error) {
		throw new CLMMPoolCreationError(
			`Failed to fetch ${tokenLabel} token info: ${error instanceof Error ? error.message : String(error)}`,
			"TOKEN_INFO_FETCH_ERROR",
			{ mintAddress, error },
		);
	}
}

export const createCLMMPool = async (
	params: CreateCLMMPoolParams,
): Promise<CreateCLMMPoolResult> => {
	const startTime = Date.now();

	try {
		// Validate all input parameters
		validateParams(params);

		const {
			umi: baseUmi,
			connection,
			network,
			signer,
			mint1Address,
			mint2Address,
			initialPrice,
			ammConfigIndex = 0,
			fundOwner = "",
			description = "",
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
			throw new CLMMPoolCreationError(
				"Failed to initialize Raydium SDK",
				"SDK_INIT_FAILED",
			);
		}

		// Fetch token information concurrently
		console.log("Fetching token information...");
		const [mint1, mint2] = await Promise.all([
			getTokenInfo(raydium, mint1Address, "Mint 1"),
			getTokenInfo(raydium, mint2Address, "Mint 2"),
		]);

		// Get CLMM configurations
		const cluster = raydium.cluster;
		const clmmConfigs = await getClmmConfigs(raydium, cluster);

		if (ammConfigIndex >= clmmConfigs.length) {
			throw new CLMMPoolCreationError(
				`AMM config index ${ammConfigIndex} is out of range (0-${clmmConfigs.length - 1})`,
				"INVALID_AMM_CONFIG_INDEX",
			);
		}

		// Determine program ID based on cluster
		const currentClmmProgram =
			cluster === "devnet" ? DEVNET_PROGRAM_ID.CLMM : CLMM_PROGRAM_ID;

		// Prepare AMM config
		const selectedConfig = clmmConfigs[ammConfigIndex];
		const ammConfig = {
			...selectedConfig,
			id: new PublicKey(selectedConfig.id),
			fundOwner,
			description,
		};

		// Convert initial price to Decimal
		const priceDecimal = new Decimal(initialPrice.toString());

		console.log("Creating CLMM pool...");
		const { execute, extInfo } = await raydium.clmm.createPool({
			programId: currentClmmProgram,
			mint1,
			mint2,
			ammConfig,
			initialPrice: priceDecimal,
			txVersion,
			computeBudgetConfig: {
				units: computeBudgetUnits,
				microLamports: computeBudgetMicroLamports,
			},
		});

		// Execute transaction with confirmation
		console.log("Sending transaction...");
		const { txId } = await execute({ sendAndConfirm: true });

		// Transform pool keys for easier consumption
		const poolKeys: Record<string, string> = {};
		if (extInfo?.address) {
			for (const key of Object.keys(extInfo.address)) {
				const value = extInfo.address[key as keyof typeof extInfo.address];
				if (value) {
					poolKeys[key] = value.toString();
				}
			}
		}

		const result: CreateCLMMPoolResult = {
			txId,
			poolId: poolKeys.id || poolKeys.poolId || "", // Try different possible keys
			poolKeys,
			mint1,
			mint2,
			initialPrice: priceDecimal,
			timestamp: startTime,
		};

		console.log("CLMM Pool created successfully", {
			txId,
			poolId: result.poolId,
			initialPrice: priceDecimal.toString(),
			executionTime: Date.now() - startTime,
		});

		return result;
	} catch (error) {
		// Enhanced error logging
		console.error("Failed to create CLMM pool:", {
			error: error instanceof Error ? error.message : String(error),
			params: {
				mint1Address: params.mint1Address,
				mint2Address: params.mint2Address,
				initialPrice: params.initialPrice.toString(),
				network: params.network,
			},
			executionTime: Date.now() - startTime,
		});

		// Re-throw as our custom error type if it's not already
		if (error instanceof CLMMPoolCreationError) {
			throw error;
		}

		throw new CLMMPoolCreationError(
			`Pool creation failed: ${error instanceof Error ? error.message : String(error)}`,
			"POOL_CREATION_FAILED",
			error,
		);
	}
};

/**
 * Utility function to clear CLMM config cache (useful for testing or manual refresh)
 */
export function clearClmmConfigCache(cluster?: string): void {
	if (cluster) {
		delete clmmConfigCache[cluster];
		console.log(`Cleared CLMM config cache for ${cluster}`);
	} else {
		for (const key of Object.keys(clmmConfigCache)) {
			delete clmmConfigCache[key];
		}
		console.log("Cleared all CLMM config cache");
	}
}

/**
 * Legacy function for backward compatibility
 * @deprecated Use createCLMMPool instead
 */
export const createPool = async () => {
	console.warn(
		"createPool() is deprecated. Use createCLMMPool() with proper parameters instead.",
	);

	// This is kept for backward compatibility but should not be used in production
	throw new CLMMPoolCreationError(
		"Legacy createPool function is deprecated. Use createCLMMPool with proper Umi framework integration.",
		"DEPRECATED_FUNCTION",
	);
};

/** Export the new function as the main interface */
export { createCLMMPool as default };

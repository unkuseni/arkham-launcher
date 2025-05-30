import {
	type CreateCPMMPoolParams,
	type CreateCPMMPoolResult,
	createCPMMPool,
} from "@/lib/liquidity/cpmm/create";
import { createSPLTokens, type formSchema } from "@/lib/token/create-token";
import useUmiStore from "@/store/useUmiStore";
import BN from "bn.js";
import type { z } from "zod";

const SOL_MINT_ADDRESS = "So11111111111111111111111111111111111111112"; // Wrapped SOL

export interface CreateTokenWithPoolParams {
	// Token creation parameters (from your form schema)
	tokenData: z.infer<typeof formSchema>;
	metadataUri: string; // Pre-uploaded metadata URI

	// Pool creation parameters
	solAmount: number; // Amount of SOL to pair with the token
	tokenAmountForPool?: number; // Optional: specific amount of tokens for pool (defaults to 80% of supply)

	// Optional pool configuration
	feeConfigIndex?: number;
	computeBudgetUnits?: number;
	computeBudgetMicroLamports?: number;
	startTime?: BN; // When the pool should become active
}

export interface CreateTokenWithPoolResult {
	// Token creation results
	token: {
		signature: string;
		mintAddress: string;
		tokenAddress: string;
	};

	// Pool creation results
	pool: CreateCPMMPoolResult;

	// Combined metadata
	totalExecutionTime: number;
	explorerLinks: {
		tokenTransaction: string;
		poolTransaction: string;
		tokenMint: string;
		poolAddress: string;
	};
}

export const createTokenWithPool = async (
	params: CreateTokenWithPoolParams,
): Promise<CreateTokenWithPoolResult> => {
	const startTime = Date.now();

	try {
		const { umi, signer, connection, network } = useUmiStore.getState();

		if (!signer || !connection) {
			throw new Error("Wallet not connected or connection not available");
		}

		const newConnection = connection();

		// Add connection validation
		if (!newConnection) {
			throw new Error("Failed to establish connection");
		}

		const {
			tokenData,
			metadataUri,
			solAmount,
			tokenAmountForPool,
			feeConfigIndex = 0,
			computeBudgetUnits = 600000,
			computeBudgetMicroLamports = 46591500,
			startTime: poolStartTime,
		} = params;

		// Step 1: Create the SPL Token
		console.log("Step 1: Creating SPL Token...");
		const tokenResult = await createSPLTokens({
			name: tokenData.name,
			decimals: tokenData.decimals,
			supply: tokenData.supply,
			metadataUri,
			symbol: tokenData.ticker,
			revokeMint: tokenData.revokeMint ?? false,
			revokeUpdate: tokenData.revokeUpdate ?? false,
			revokeFreeze: tokenData.revokeFreeze ?? false,
		});

		console.log("Token created successfully:", tokenResult.mintAddress);

		// Step 2: Calculate token amount for pool (default to 80% of total supply)
		const tokenPoolAmount =
			tokenAmountForPool ?? Math.floor(tokenData.supply * 0.8);

		// Better precision handling for token amounts
		const tokenAmountBN = new BN(tokenPoolAmount.toString()).mul(
			new BN(10).pow(new BN(tokenData.decimals)),
		);
		const solAmountBN = new BN(solAmount.toString()).mul(
			new BN(10).pow(new BN(9)),
		); // SOL has 9 decimals

		// Step 3: Create the CPMM Pool
		console.log("Step 2: Creating CPMM Pool...");
		const poolParams: CreateCPMMPoolParams = {
			umi,
			connection: newConnection,
			network,
			signer,
			mintAAddress: tokenResult.mintAddress, // Your new token
			mintBAddress: SOL_MINT_ADDRESS, // Paired with SOL
			mintAAmount: tokenAmountBN,
			mintBAmount: solAmountBN,
			startTime: poolStartTime,
			feeConfigIndex,
			computeBudgetUnits,
			computeBudgetMicroLamports,
		};

		const poolResult = await createCPMMPool(poolParams);

		console.log("Pool created successfully:", poolResult.poolId);

		// Step 4: Prepare result with explorer links
		const clusterParam =
			network === "mainnet-beta" ? "" : `?cluster=${network}`;

		const result: CreateTokenWithPoolResult = {
			token: tokenResult,
			pool: poolResult,
			totalExecutionTime: Date.now() - startTime,
			explorerLinks: {
				tokenTransaction: `https://explorer.solana.com/tx/${tokenResult.signature}${clusterParam}`,
				poolTransaction: `https://explorer.solana.com/tx/${poolResult.txId}${clusterParam}`,
				tokenMint: `https://explorer.solana.com/address/${tokenResult.mintAddress}${clusterParam}`,
				poolAddress: `https://explorer.solana.com/address/${poolResult.poolId}${clusterParam}`,
			},
		};

		console.log("✅ Token and Pool creation completed successfully!");
		console.log("📊 Results:", {
			tokenMint: result.token.mintAddress,
			poolId: result.pool.poolId,
			executionTime: `${result.totalExecutionTime}ms`,
		});

		return result;
	} catch (error) {
		console.error("❌ Failed to create token with pool:", error);
		throw new Error(
			error instanceof Error
				? `Token and pool creation failed: ${error.message}`
				: "Unknown error occurred during token and pool creation",
		);
	}
};

// ...rest of existing code...
// Utility function for common use case: create token with default pool settings
export const createTokenWithDefaultPool = async (
	tokenData: z.infer<typeof formSchema>,
	metadataUri: string,
	solAmount: number,
) => {
	return createTokenWithPool({
		tokenData,
		metadataUri,
		solAmount,
		// Uses defaults for pool configuration
	});
};

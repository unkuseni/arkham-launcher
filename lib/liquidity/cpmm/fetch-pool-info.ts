import useUmiStore from "@/store/useUmiStore"; // Import the Umi store
import { initSdk } from "../index";

export const fetchRpcPoolInfo = async (poolId?: string) => {
	// Get necessary details from the Umi store
	const { umi, connection, network } = useUmiStore.getState();

	// Ensure Umi is initialized (wallet connected, etc.)
	if (!umi) {
		console.error(
			"Umi instance is not available. Ensure wallet is connected and store is initialized.",
		);
		throw new Error("Umi instance not available for initializing Raydium SDK.");
	}

	const raydium = await initSdk(umi, connection(), network, {
		loadToken: true, // Assuming you might need token info, adjust if not
	});

	if (!raydium) {
		console.error("Failed to initialize Raydium SDK");
		throw new Error("Failed to initialize Raydium SDK");
	}

	// Use the provided poolId or a default one
	const targetPoolId = poolId || "4y81XN75NGct6iUYkBp2ixQKtXdrQxxMVgFbFF9w5n4u"; // Default SOL-RAY pool

	try {
		const poolInfos = await raydium.cpmm.getRpcPoolInfos([targetPoolId]);
		const poolInfo = poolInfos[targetPoolId];

		if (poolInfo) {
			console.log(`Pool info for ${targetPoolId}:`, poolInfo);
			console.log(`Price for ${targetPoolId}:`, poolInfo.poolPrice);
			return poolInfo;
		}
		console.warn(`Pool info not found for ID: ${targetPoolId}`);
		return undefined;
	} catch (error) {
		console.error(`Error fetching RPC pool info for ${targetPoolId}:`, error);
		throw error;
	}
};

/**
 * Example of how to call this function.
 * You would typically call this from a part of your application
 * where the Umi store is confirmed to be initialized (e.g., after wallet connection).
 */
// async function exampleUsage() {
//   try {
//     // Ensure Umi store is ready before calling
//     // For example, in a React component after wallet connection:
//     // if (useUmiStore.getState().umi) {
//     //   const solRayPoolInfo = await fetchRpcPoolInfo("4y81XN75NGct6iUYkBp2ixQKtXdrQxxMVgFbFF9w5n4u");
//     //   if (solRayPoolInfo) {
//     //     // Do something with the pool info
//     //   }
//     //
//     //   const anotherPoolInfo = await fetchRpcPoolInfo("ANOTHER_POOL_ID_HERE");
//     //   if (anotherPoolInfo) {
//     //     // Do something
//     //   }
//     // }
//   } catch (error) {
//     console.error("Failed to fetch pool info in example:", error);
//   }
// }

// The direct call below might cause issues if the Umi store is not yet initialized
// when this module is loaded. It's generally better to call such functions
// from a context where initialization is guaranteed.
// fetchRpcPoolInfo();

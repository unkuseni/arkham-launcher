import type {
	Transaction,
	TransactionBuilder,
	Umi,
} from "@metaplex-foundation/umi";
import { base64 } from "@metaplex-foundation/umi/serializers";

export const getPriorityFee = async (
	umi: Umi,
	transaction: TransactionBuilder,
): Promise<number> => {
	// Step 1: Get unique writable accounts involved in the transaction
	// We only care about writable accounts since they affect priority fees
	const distinctPublicKeys = new Set<string>();

	for (const item of transaction.items) {
		for (const key of item.instruction.keys) {
			if (key.isWritable) {
				distinctPublicKeys.add(key.pubkey.toString());
			}
		}
	}

	// Step 2: Query recent prioritization fees for these accounts from the RPC
	const response = await fetch(umi.rpc.getEndpoint(), {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			jsonrpc: "2.0",
			id: 1,
			method: "getRecentPrioritizationFees",
			params: [Array.from(distinctPublicKeys)],
		}),
	});

	if (!response.ok) {
		throw new Error(`Failed to fetch priority fees: ${response.status}`);
	}

	const data = (await response.json()) as {
		result: { prioritizationFee: number; slot: number }[];
	};

	// Step 3: Calculate average of top 100 fees to get a competitive rate
	const fees = data.result?.map((entry) => entry.prioritizationFee) || [];
	const topFees = fees.sort((a, b) => b - a).slice(0, 100);
	const averageFee =
		topFees.length > 0
			? Math.ceil(topFees.reduce((sum, fee) => sum + fee, 0) / topFees.length)
			: 0;
	return averageFee;
};

export const getRequiredCU = async (
	umi: Umi,
	transaction: Transaction, // Step 1: pass the transaction
): Promise<number> => {
	// Default values if estimation fails
	const DEFAULT_COMPUTE_UNITS = 800_000; // Standard safe value
	const BUFFER_FACTOR = 1.1; // Add 10% safety margin

	// Step 2: Simulate the transaction to get actual compute units needed
	const response = await fetch(umi.rpc.getEndpoint(), {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			jsonrpc: "2.0",
			id: 1,
			method: "simulateTransaction",
			params: [
				base64.deserialize(umi.transactions.serialize(transaction))[0],
				{
					encoding: "base64",
					replaceRecentBlockhash: true,
					sigVerify: false,
				},
			],
		}),
	});

	if (!response.ok) {
		throw new Error(`Failed to simulate transaction: ${response.status}`);
	}

	const data = await response.json();
	const unitsConsumed = data.result?.value?.unitsConsumed;

	// Fallback to default if simulation doesn't provide compute units
	if (!unitsConsumed) {
		console.log("Simulation didn't return compute units, using default value");
		return DEFAULT_COMPUTE_UNITS;
	}

	// Add safety buffer to estimated compute units
	return Math.ceil(unitsConsumed * BUFFER_FACTOR); // Step 3: use the buffer
};

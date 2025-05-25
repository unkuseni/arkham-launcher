import { supabase } from "@/lib/supabaseClient";
import useUmiStore from "@/store/useUmiStore";
import {
	type Keypair,
	type Umi,
	generateSigner,
	publicKey,
} from "@metaplex-foundation/umi";
import { uploadJsonToCloudflareR2 } from "./s3-bucket";

export interface KeypairCreationOptions {
	/** Number of keypairs to generate */
	count?: number;
	/** Whether to encrypt the secret keys before upload */
	encrypt?: boolean;
	/** Custom prefix for the filename */
	filePrefix?: string;
	/** Whether to include metadata like creation timestamp */
	includeMetadata?: boolean;
	/** Maximum concurrent uploads */
	concurrencyLimit?: number;
}

export interface KeypairResult {
	publicKey: string;
	url?: string;
	error?: string;
	createdAt?: string;
	index?: number;
	supabaseId?: string; // Optional Supabase ID for tracking
}

export interface CreateKeypairsResult {
	success: KeypairResult[];
	failed: KeypairResult[];
	totalCreated: number;
	totalFailed: number;
}

export interface StoredKeypairData {
	creatorPublicKey: string;
	publicKey: string;
	secretKey: number[];
	createdAt: string;
	version: string;
	encrypted?: boolean;
}

/**
 * Creates multiple keypairs and uploads them to Cloudflare R2
 * @param userPublicKey The creator's public key
 * @param options Configuration options
 * @returns Promise<CreateKeypairsResult>
 */
export const createKeypairAndUpload = async (
	userPublicKey: string,
	options: KeypairCreationOptions = {},
): Promise<CreateKeypairsResult> => {
	const {
		count = 1,
		encrypt = true,
		filePrefix = "keypair",
		includeMetadata = true,
		concurrencyLimit = 5,
	} = options;

	// Input validation
	if (!userPublicKey?.trim()) {
		throw new Error("User public key is required");
	}
	if (count <= 0 || count > 100) {
		throw new Error("Count must be between 1 and 100");
	}

	const { umi } = useUmiStore.getState();
	if (!umi) {
		throw new Error("Umi instance not available");
	}

	const success: KeypairResult[] = [];
	const failed: KeypairResult[] = [];

	try {
		// Generate all keypairs first
		const keypairs: Array<{ keypair: Keypair; index: number }> = [];
		for (let i = 0; i < count; i++) {
			try {
				const keypair = generateSigner(umi) as Keypair;
				keypairs.push({ keypair, index: i });
			} catch (error) {
				failed.push({
					publicKey: "unknown",
					error: `Failed to generate keypair: ${error instanceof Error ? error.message : "Unknown error"}`,
					index: i,
				});
			}
		}

		// Process uploads in batches
		const batches = [];
		for (let i = 0; i < keypairs.length; i += concurrencyLimit) {
			batches.push(keypairs.slice(i, i + concurrencyLimit));
		}

		for (const batch of batches) {
			const uploadPromises = batch.map(({ keypair, index }) =>
				processKeypairUpload(keypair, userPublicKey, index, {
					encrypt,
					filePrefix,
					includeMetadata,
				}),
			);

			const results = await Promise.allSettled(uploadPromises);

			results.forEach((result, batchIndex) => {
				const globalIndex = batch[batchIndex].index;
				if (result.status === "fulfilled") {
					success.push({ ...result.value, index: globalIndex });
				} else {
					failed.push({
						publicKey: batch[batchIndex].keypair.publicKey.toString(),
						error:
							result.reason instanceof Error
								? result.reason.message
								: "Upload failed",
						index: globalIndex,
					});
				}
			});

			// Small delay between batches to avoid overwhelming the service
			if (batches.length > 1) {
				await new Promise((resolve) => setTimeout(resolve, 100));
			}
		}

		console.log(
			`Keypair creation completed: ${success.length} successful, ${failed.length} failed`,
		);

		return {
			success,
			failed,
			totalCreated: success.length,
			totalFailed: failed.length,
		};
	} catch (error) {
		throw new Error(
			`Keypair creation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
		);
	}
};

/**
 * Process individual keypair upload
 */
// ...existing code...

async function processKeypairUpload(
	keypair: Keypair,
	userPublicKey: string,
	index: number,
	options: {
		encrypt: boolean;
		filePrefix: string;
		includeMetadata: boolean;
	},
): Promise<KeypairResult> {
	const { encrypt, filePrefix, includeMetadata } = options;
	const publicKeyString = keypair.publicKey.toString();
	const createdAt = new Date().toISOString();

	// Prepare keypair data
	let secretKeyData = Array.from(keypair.secretKey);

	// Simple encryption (in production, use proper encryption)
	if (encrypt) {
		secretKeyData = secretKeyData.map((byte) => byte ^ 0x42); // XOR encryption (demo only)
	}

	const keypairData: StoredKeypairData = {
		creatorPublicKey: userPublicKey,
		publicKey: publicKeyString,
		secretKey: secretKeyData,
		createdAt,
		version: "1.0",
		encrypted: encrypt,
	};

	// Generate filename
	const timestamp = includeMetadata ? `_${Date.now()}` : "";
	const fileName = `${filePrefix}_${publicKeyString.slice(0, 8)}${timestamp}.json`;

	try {
		// Upload to R2
		const url = await uploadJsonToCloudflareR2(
			keypairData,
			fileName,
			userPublicKey,
		);

		if (!url) {
			throw new Error("Upload returned null URL");
		}

		// Save keypair metadata to Supabase
		const { supabase } = await import("@/lib/supabaseClient");
		let supabaseId: string | undefined;

		if (supabase) {
			const { data, error } = await supabase
				.from("keypairs")
				.insert([
					{
						creator_wallet_address: userPublicKey,
						keypair_public_key: publicKeyString,
						r2_url: url,
						r2_key: fileName,
						encrypted: encrypt,
					},
				])
				.select("id");

			if (error) {
				console.error("Error saving keypair metadata to Supabase:", error);
				// You might want to still return success for R2 upload
			} else if (data && data.length > 0) {
				supabaseId = data[0].id;
				console.log("Keypair metadata saved to Supabase:", data[0]);
			}
		}

		const result: KeypairResult = {
			publicKey: publicKeyString,
			url,
			supabaseId,
		};

		if (includeMetadata) {
			result.createdAt = createdAt;
		}

		return result;
	} catch (error) {
		throw new Error(
			`Failed to upload keypair: ${error instanceof Error ? error.message : "Unknown error"}`,
		);
	}
}

/**
 * Retrieves and reconstructs a keypair from a URL
 * @param url The URL to fetch the keypair from
 * @param decrypt Whether to decrypt the secret key
 * @returns Promise<Keypair | null>
 */
export const getKeypairFromUrl = async (
	url: string,
	decrypt = true,
): Promise<Keypair | null> => {
	if (!url?.trim()) {
		console.error("URL is required");
		return null;
	}

	try {
		const response = await fetch(url, {
			method: "GET",
			headers: {
				"Content-Type": "application/json",
			},
		});

		if (!response.ok) {
			console.error(`HTTP ${response.status}: ${response.statusText}`);
			return null;
		}

		const keypairData = (await response.json()) as StoredKeypairData;

		// Validate data structure
		if (!isValidKeypairData(keypairData)) {
			console.error("Invalid keypair data format");
			return null;
		}

		// Reconstruct public key
		const reconstructedPublicKey = publicKey(keypairData.publicKey);

		// Reconstruct secret key
		let secretKeyArray = keypairData.secretKey;

		// Decrypt if needed
		if (keypairData.encrypted && decrypt) {
			secretKeyArray = secretKeyArray.map((byte) => byte ^ 0x42); // XOR decryption (demo only)
		}

		const reconstructedSecretKey = new Uint8Array(secretKeyArray);

		// Validate key pair integrity
		if (reconstructedSecretKey.length !== 64) {
			console.error("Invalid secret key length");
			return null;
		}

		const reconstructedKeypair: Keypair = {
			publicKey: reconstructedPublicKey,
			secretKey: reconstructedSecretKey,
		};

		return reconstructedKeypair;
	} catch (error) {
		console.error("Error retrieving keypair:", error);
		return null;
	}
};

/**
 * Validates keypair data structure
 */
function isValidKeypairData(data: any): data is StoredKeypairData {
	return (
		data &&
		typeof data === "object" &&
		typeof data.publicKey === "string" &&
		typeof data.secretKey === "object" &&
		Array.isArray(data.secretKey) &&
		data.secretKey.length === 64 &&
		data.secretKey.every(
			(byte: any) => typeof byte === "number" && byte >= 0 && byte <= 255,
		) &&
		typeof data.creatorPublicKey === "string"
	);
}

/**
 * Batch retrieve multiple keypairs from URLs
 * @param urls Array of URLs to fetch keypairs from
 * @param concurrencyLimit Maximum concurrent fetches
 * @returns Promise with successful and failed results
 */
export const getMultipleKeypairsFromUrls = async (
	urls: string[],
	concurrencyLimit = 5,
): Promise<{
	success: Array<{ url: string; keypair: Keypair }>;
	failed: Array<{ url: string; error: string }>;
}> => {
	const success: Array<{ url: string; keypair: Keypair }> = [];
	const failed: Array<{ url: string; error: string }> = [];

	// Process in batches
	const batches = [];
	for (let i = 0; i < urls.length; i += concurrencyLimit) {
		batches.push(urls.slice(i, i + concurrencyLimit));
	}

	for (const batch of batches) {
		const promises = batch.map(async (url) => {
			try {
				const keypair = await getKeypairFromUrl(url);
				if (keypair) {
					return { success: true, url, keypair };
				}
				return { success: false, url, error: "Failed to retrieve keypair" };
			} catch (error) {
				return {
					success: false,
					url,
					error: error instanceof Error ? error.message : "Unknown error",
				};
			}
		});

		const results = await Promise.allSettled(promises);

		for (const result of results) {
			if (result.status === "fulfilled") {
				if (result.value.success && result.value.keypair) {
					success.push({
						url: result.value.url,
						keypair: result.value.keypair,
					});
				} else {
					failed.push({
						url: result.value.url,
						error: result.value.error || "Failed to retrieve keypair",
					});
				}
			} else {
				failed.push({
					url: "unknown",
					error:
						result.reason instanceof Error
							? result.reason.message
							: "Promise rejected",
				});
			}
		}
	}

	return { success, failed };
};

/**
 * Utility function to validate a public key string
 * @param publicKeyString The public key string to validate
 * @returns boolean indicating if the public key is valid
 */
export const validatePublicKey = (publicKeyString: string): boolean => {
	try {
		publicKey(publicKeyString);
		return true;
	} catch {
		return false;
	}
};

// ...existing code...

/**
 * Retrieves all keypairs created by a specific wallet
 * @param userPublicKey The creator's public key
 * @returns Promise with keypair metadata
 */
export const getKeypairsByWallet = async (
	userPublicKey: string,
): Promise<{
	keypairs: Array<{
		id: string;
		keypair_public_key: string;
		r2_url: string;
		r2_key: string;
		encrypted: boolean;
		created_at: string;
	}>;
	count: number;
} | null> => {
	if (!userPublicKey?.trim()) {
		console.error("User public key is required");
		return null;
	}

	try {
		const response = await fetch(
			`/api/supabase/getUploads?userPublicKey=${encodeURIComponent(userPublicKey)}`,
			{
				method: "GET",
				headers: {
					"Content-Type": "application/json",
				},
			},
		);

		if (!response.ok) {
			console.error(`HTTP ${response.status}: ${response.statusText}`);
			return null;
		}

		const data = await response.json();
		return {
			keypairs: data.keypairs || [],
			count: data.count || 0,
		};
	} catch (error) {
		console.error("Error retrieving keypairs by wallet:", error);
		return null;
	}
};

/**
 * Retrieves keypairs and reconstructs them from URLs
 * @param userPublicKey The creator's public key
 * @param decrypt Whether to decrypt the secret keys
 * @returns Promise with reconstructed keypairs
 */
export const getAndReconstructKeypairsByWallet = async (
	userPublicKey: string,
	decrypt = true,
): Promise<{
	success: Array<{ id: string; publicKey: string; keypair: Keypair }>;
	failed: Array<{ id: string; url: string; error: string }>;
} | null> => {
	const keypairData = await getKeypairsByWallet(userPublicKey);

	if (!keypairData) {
		return null;
	}

	const success: Array<{ id: string; publicKey: string; keypair: Keypair }> =
		[];
	const failed: Array<{ id: string; url: string; error: string }> = [];

	for (const kp of keypairData.keypairs) {
		try {
			const keypair = await getKeypairFromUrl(kp.r2_url, decrypt);
			if (keypair) {
				success.push({
					id: kp.id,
					publicKey: kp.keypair_public_key,
					keypair,
				});
			} else {
				failed.push({
					id: kp.id,
					url: kp.r2_url,
					error: "Failed to reconstruct keypair",
				});
			}
		} catch (error) {
			failed.push({
				id: kp.id,
				url: kp.r2_url,
				error: error instanceof Error ? error.message : "Unknown error",
			});
		}
	}

	return { success, failed };
};

// ...existing code...

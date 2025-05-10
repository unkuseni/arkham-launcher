const PINATA_API_KEY = process.env.PINATA_API_KEY;
const PINATA_SECRET_API_KEY = process.env.PINATA_SECRET_API_KEY;

if (!PINATA_API_KEY || !PINATA_SECRET_API_KEY) {
	console.error(
		"Pinata API Key or Secret API Key environment variable is not set.",
	);
	// Consider throwing an error or handling this more gracefully depending on application flow
}

export interface Attribute {
	trait_type: string;
	value: string;
}

export interface MetadataFile {
	uri: string;
	type: string; // e.g., "image/png"
}

export interface MetadataProperties {
	files: MetadataFile[];
	category: string; // e.g., "image"
	// You can add other properties like creators here if needed
	// creators?: { address: string; share: number }[];
}

export interface TokenMetadata {
	name: string;
	symbol: string;
	description: string;
	image: string; // URL to the image (e.g., from Cloudflare R2)
	attributes?: Attribute[];
	properties?: MetadataProperties;
	seller_fee_basis_points?: number; // Optional: For royalties
	// Add any other fields relevant to your metadata standard
}

export async function uploadMetadataToPinata(
	metadata: TokenMetadata,
): Promise<string | null> {
	if (!PINATA_API_KEY || !PINATA_SECRET_API_KEY) {
		console.error(
			"Pinata API keys are not configured. Cannot upload metadata.",
		);
		return null;
	}

	const url = "https://api.pinata.cloud/pinning/pinJSONToIPFS";

	try {
		const response = await fetch(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				pinata_api_key: PINATA_API_KEY,
				pinata_secret_api_key: PINATA_SECRET_API_KEY,
			},
			body: JSON.stringify({
				pinataContent: metadata,
				pinataOptions: {
					cidVersion: 1, // Use CID version 1 for wider compatibility
				},
			}),
		});

		if (!response.ok) {
			const errorData = await response.json();
			console.error(
				"Error uploading JSON to Pinata:",
				response.status,
				errorData,
			);
			return null;
		}

		const result = await response.json();
		console.log("Metadata uploaded to Pinata. IPFS Hash:", result.IpfsHash);
		return result.IpfsHash;
	} catch (error) {
		console.error("Error in uploadMetadataToPinata:", error);
		return null;
	}
}

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
	website?: string;
	telegram?: string;
	discord?: string;
	twitter?: string;
	reddit?: string;
}

export interface TokenMetadata {
	name: string;
	symbol: string;
	description: string;
	image: string; // URL to the image (e.g., from Cloudflare R2)
	attributes?: Attribute[];
	extensions?: MetadataProperties;
	seller_fee_basis_points?: number; // Optional: For royalties
}

export async function uploadMetadataToPinata(
	metadata: TokenMetadata,
): Promise<string | null> {
	// Call internal API route to handle Pinata upload
	try {
		const response = await fetch('/api/pinata/pinJSON', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(metadata),
		});

		if (!response.ok) {
			const errorData = await response.json().catch(() => null);
			console.error('Error uploading JSON via internal API:', response.status, errorData);
			return null;
		}

		const result = await response.json();
		const hash = result.IpfsHash;
		console.log('Metadata uploaded via internal API. IPFS Hash:', hash);
		// Return gateway URL
		return `https://gateway.pinata.cloud/ipfs/${hash}`;
	} catch (error) {
		console.error("Error in uploadMetadataToPinata:", error);
		return null;
	}
}

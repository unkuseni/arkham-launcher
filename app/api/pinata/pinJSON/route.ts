import type { TokenMetadata } from "@/lib/pinata";
import { type NextRequest, NextResponse } from "next/server";

const PINATA_API_KEY = process.env.PINATA_API_KEY;
const PINATA_SECRET_API_KEY = process.env.PINATA_SECRET_API_KEY;

if (!PINATA_API_KEY || !PINATA_SECRET_API_KEY) {
	console.error(
		"Pinata API Key or Secret API Key environment variable is not set.",
	);
}

export async function POST(req: NextRequest) {
	if (!PINATA_API_KEY || !PINATA_SECRET_API_KEY) {
		return NextResponse.json(
			{ error: "Pinata keys not configured" },
			{ status: 500 },
		);
	}

	const metadata: TokenMetadata = await req.json();
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
				pinataOptions: { cidVersion: 1 },
			}),
		});

		if (!response.ok) {
			const errorData = await response.json();
			console.error(
				"Error uploading JSON to Pinata:",
				response.status,
				errorData,
			);
			return NextResponse.json(
				{ error: "Failed to upload metadata to Pinata" },
				{ status: response.status },
			);
		}

		const result = await response.json();
		return NextResponse.json({ IpfsHash: result.IpfsHash });
	} catch (error) {
		console.error("Error in API route uploadMetadataToPinata:", error);
		return NextResponse.json(
			{ error: "Exception during Pinata upload" },
			{ status: 500 },
		);
	}
}

import { supabase } from "@/lib/supabaseClient";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { type NextRequest, NextResponse } from "next/server";

const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CLOUDFLARE_ACCESS_KEY_ID = process.env.CLOUDFLARE_ACCESS_KEY_ID;
const CLOUDFLARE_SECRET_ACCESS_KEY = process.env.CLOUDFLARE_SECRET_ACCESS_KEY;
const CLOUDFLARE_BUCKET_NAME = process.env.CLOUDFLARE_BUCKET_NAME;
const CLOUDFLARE_PUBLIC_R2_URL = process.env.CLOUDFLARE_PUBLIC_R2_URL;

if (
	!CLOUDFLARE_ACCOUNT_ID ||
	!CLOUDFLARE_ACCESS_KEY_ID ||
	!CLOUDFLARE_SECRET_ACCESS_KEY ||
	!CLOUDFLARE_BUCKET_NAME ||
	!CLOUDFLARE_PUBLIC_R2_URL
) {
	console.error(
		"Cloudflare R2 env variables are not fully set for uploadJson API",
	);
	// Consider throwing an error or returning a specific response if config is missing
}

const s3 = new S3Client({
	region: "auto",
	endpoint: `https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
	credentials: {
		accessKeyId: CLOUDFLARE_ACCESS_KEY_ID || "",
		secretAccessKey: CLOUDFLARE_SECRET_ACCESS_KEY || "",
	},
});

export async function POST(req: NextRequest) {
	try {
		const body = await req.json();
		const { fileName, data, userPublicKey } = body; // Destructure userPublicKey

		if (!fileName || typeof fileName !== "string") {
			return NextResponse.json(
				{ error: "File name is required and must be a string." },
				{ status: 400 },
			);
		}
		if (!data) {
			return NextResponse.json(
				{ error: "No JSON data provided." },
				{ status: 400 },
			);
		}
		if (!userPublicKey || typeof userPublicKey !== "string") {
			// Validate userPublicKey
			return NextResponse.json(
				{ error: "User public key is required and must be a string." },
				{ status: 400 },
			);
		}

		// Ensure filename ends with .json, or append it.
		const key = fileName.endsWith(".json") ? fileName : `${fileName}.json`;

		await s3.send(
			new PutObjectCommand({
				Bucket: CLOUDFLARE_BUCKET_NAME,
				Key: key,
				Body: JSON.stringify(data), // Convert JSON object to string for upload
				ContentType: "application/json",
			}),
		);

		const url = `${CLOUDFLARE_PUBLIC_R2_URL}/${key}`;

		if (supabase) {
			const { data: supabaseData, error: supabaseError } = await supabase
				.from("r2_uploads") // Replace "r2_uploads" with your actual table name
				.insert([
					{
						key: key,
						url: url,
						uploaded_at: new Date().toISOString(),
						creator_wallet_address: userPublicKey,
					},
				]); // Add user_wallet_address

			if (supabaseError) {
				console.error("Error saving metadata to Supabase:", supabaseError);
				// Decide how to handle this error. For now, we'll just log it.
				// You might still return success for the R2 upload, or return an error.
			} else {
				console.log("Metadata saved to Supabase:", supabaseData);
			}
		} else {
			console.warn(
				"Supabase client is not initialized. Skipping metadata recording.",
			);
		}

		return NextResponse.json({ url });
	} catch (err) {
		console.error("Error in uploadJson API:", err);
		if (err instanceof SyntaxError) {
			// Handle errors from req.json()
			return NextResponse.json(
				{ error: "Invalid JSON payload." },
				{ status: 400 },
			);
		}
		return NextResponse.json(
			{ error: "Upload failed. Please check server logs." },
			{ status: 500 },
		);
	}
}

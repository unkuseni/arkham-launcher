import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { type NextRequest, NextResponse } from "next/server";
import { v4 as uuidV4 } from "uuid";

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
		"Cloudflare R2 env variables are not fully set for uploadImage API",
	);
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
		const formData = await req.formData();
		const file = formData.get("file") as File | null;
		if (!file) {
			return NextResponse.json({ error: "No file provided" }, { status: 400 });
		}
		const arrayBuffer = await file.arrayBuffer();
		const fileExtension = file.name.split(".").pop() || "png";
		const filename = `${uuidV4()}.${fileExtension}`;

		await s3.send(
			new PutObjectCommand({
				Bucket: CLOUDFLARE_BUCKET_NAME,
				Key: filename,
				Body: new Uint8Array(arrayBuffer),
				ContentType: file.type || "application/octet-stream",
			}),
		);

		const url = `${CLOUDFLARE_PUBLIC_R2_URL}/${filename}`;
		return NextResponse.json({ url });
	} catch (err) {
		console.error("Error in uploadImage API:", err);
		return NextResponse.json({ error: "Upload failed" }, { status: 500 });
	}
}

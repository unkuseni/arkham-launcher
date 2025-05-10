import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { randomUUIDv7 } from "bun";

const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CLOUDFLARE_ACCESS_KEY_ID = process.env.CLOUDFLARE_ACCESS_KEY_ID;
const CLOUDFLARE_SECRET_ACCESS_KEY = process.env.CLOUDFLARE_SECRET_ACCESS_KEY;
const CLOUDFLARE_BUCKET_NAME = process.env.CLOUDFLARE_BUCKET_NAME;
const CLOUDFLARE_PUBLIC_R2_URL = process.env.CLOUDFLARE_PUBLIC_R2_URL;

const s3Client = (() => {
	if (
		!CLOUDFLARE_ACCOUNT_ID ||
		!CLOUDFLARE_ACCESS_KEY_ID ||
		!CLOUDFLARE_SECRET_ACCESS_KEY ||
		!CLOUDFLARE_BUCKET_NAME ||
		!CLOUDFLARE_PUBLIC_R2_URL
	) {
		console.error("Cloudflare R2 environment variables are not fully set.");
		return null;
	}

	return new S3Client({
		region: "auto",
		endpoint: `https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
		credentials: {
			accessKeyId: CLOUDFLARE_ACCESS_KEY_ID,
			secretAccessKey: CLOUDFLARE_SECRET_ACCESS_KEY,
		},
	});
})();

/**
 * Uploads a given image file to Cloudflare R2.
 *
 * @param imageFile The image file to upload.
 * @returns The public URL of the uploaded image, or null if an error occurs.
 */
export async function uploadImageToCloudflareR2(
	imageFile: File,
): Promise<string | null> {
	if (!s3Client) {
		console.error("S3 client is not initialized. Cannot upload image.");
		return null;
	}

	if (!CLOUDFLARE_BUCKET_NAME || !CLOUDFLARE_PUBLIC_R2_URL) {
		console.error(
			"Bucket name or public URL for R2 is not configured. Cannot upload image.",
		);
		return null;
	}

	console.log("Uploading image to Cloudflare R2...");
	try {
		const arrayBuffer = await imageFile.arrayBuffer();
		const fileExtension = imageFile.name.split(".").pop() || "png";
		const uniqueFilename = `${randomUUIDv7()}.${fileExtension}`;

		await s3Client.send(
			new PutObjectCommand({
				Bucket: CLOUDFLARE_BUCKET_NAME,
				Key: uniqueFilename,
				Body: new Uint8Array(arrayBuffer),
				ContentType: imageFile.type || "image/png",
				ACL: "public-read",
			}),
		);

		const imageUrl = `${CLOUDFLARE_PUBLIC_R2_URL}/${uniqueFilename}`;
		console.log("Image uploaded to Cloudflare R2:", imageUrl);
		return imageUrl;
	} catch (error) {
		console.error("Error uploading image to Cloudflare R2:", error);
		return null;
	}
}

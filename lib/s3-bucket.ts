/**
 * Uploads an image file to Cloudflare R2 via an internal Next.js API route.
 * @param imageFile The image file to upload.
 * @returns The public URL of the uploaded image, or null if an error occurs.
 */
export async function uploadImageToCloudflareR2(
	imageFile: File,
): Promise<string | null> {
	try {
		const formData = new FormData();
		formData.append("file", imageFile);
		const res = await fetch("/api/r2/uploadImage", {
			method: "POST",
			body: formData,
		});
		const data = await res.json();
		if (!res.ok || typeof data.url !== "string") {
			console.error("Error uploading image via API:", data.error || data);
			return null;
		}
		return data.url;
	} catch (err) {
		console.error("uploadImageToCloudflareR2 error:", err);
		return null;
	}
}

/**
 * Uploads a JSON object to Cloudflare R2 via an internal Next.js API route.
 * @param jsonData The JSON object to upload.
 * @param fileName The desired file name for the JSON file on R2 (e.g., "data.json").
 * @param userPublicKey The public key of the user creating the keypair.
 * @returns The public URL of the uploaded JSON, or null if an error occurs.
 */
export async function uploadJsonToCloudflareR2(
	jsonData: object,
	fileName: string,
	userPublicKey: string, // Added userPublicKey parameter
): Promise<string | null> {
	try {
		const res = await fetch("/api/r2/uploadJson", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ fileName, data: jsonData, userPublicKey }), // Send filename, data, and userPublicKey
		});
		const responseData = await res.json();
		if (!res.ok || typeof responseData.url !== "string") {
			console.error(
				"Error uploading JSON via API:",
				responseData.error || responseData,
			);
			return null;
		}
		return responseData.url;
	} catch (err) {
		console.error("uploadJsonToCloudflareR2 error:", err);
		return null;
	}
}

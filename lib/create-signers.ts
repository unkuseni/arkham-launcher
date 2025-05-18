import useUmiStore from "@/store/useUmiStore";
import { type Keypair, generateSigner } from "@metaplex-foundation/umi"; // Changed Signer to Keypair if generateSigner returns a Keypair
import { uploadJsonToCloudflareR2 } from "./s3-bucket"; // Ensure this path is correct

export const createKeypairAndUpload = async (
	userPublicKey: string,
	number = 1,
) => {
	const { umi } = useUmiStore();
	const results = [];

	for (let i = 0; i < number; i++) {
		// Assuming generateSigner returns a Keypair object that includes secretKey
		// If Signer is the correct type and it's meant to be opaque, this approach needs rethinking
		const keypair = generateSigner(umi) as Keypair; // Explicitly treat as Keypair or use appropriate type
		const publicKeyString = keypair.publicKey.toString();

		// Prepare the data for JSON upload
		// Storing raw secret keys needs careful security consideration.
		// This example converts Uint8Array to number[] for JSON serialization.
		const keypairData = {
			creatorPublicKey: userPublicKey, // Added creator's public key
			publicKey: publicKeyString,
			// Ensure keypair object actually has secretKey. This is a common pattern but might vary.
			secretKey: Array.from(keypair.secretKey), // Converts Uint8Array to number[]
		};

		const fileName = `${publicKeyString}_keypair.json`; // Using public key in filename for uniqueness

		try {
			// Pass userPublicKey to the upload function
			const url = await uploadJsonToCloudflareR2(
				keypairData,
				fileName,
				userPublicKey,
			);
			if (url) {
				console.log(
					`Keypair ${i + 1}/${number} uploaded to: ${url}. Public Key: ${publicKeyString}`,
				);
				results.push({ publicKey: publicKeyString, url });
			} else {
				console.error(`Failed to upload keypair ${i + 1}/${number} to R2.`);
				// Optionally, you could push an error object or null for this iteration
				results.push({
					publicKey: publicKeyString,
					url: null,
					error: "Failed to upload",
				});
			}
		} catch (error) {
			console.error(
				`Error in createKeypairAndUpload for keypair ${i + 1}/${number}:`,
				error,
			);
			results.push({
				publicKey: publicKeyString,
				url: null,
				error: (error as Error).message,
			});
		}
	}

	if (results.length === 0 && number > 0) {
		console.error("No keypairs were successfully uploaded.");
		return null; // Or an empty array, depending on how you want to handle complete failure
	}

	return results;
};

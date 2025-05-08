import useUmiStore from "@/store/useUmiStore";
import { signerIdentity } from "@metaplex-foundation/umi";
import { base58 } from "@metaplex-foundation/umi/serializers";

export interface PolicyAgreement {
	user: string; // wallet pubkey as base58
	policyId: string; // e.g. "terms-v1"
	timestamp: number; // ms since epoch
	terms: string; // full text
}

export const signPolicy = async (
	policy: PolicyAgreement,
): Promise<[string, number]> => {
	const { umi, signer } = useUmiStore.getState();
	if (!signer) {
		throw new Error("No wallet connected. Please connect your wallet first.");
	}

	// tell UMI which signer to use
	umi.use(signerIdentity(signer));

	try {
		// UTF-8 encode the JSON policy
		const message = new TextEncoder().encode(JSON.stringify(policy));
		// ask the wallet to sign it
		const signatureBytes = await umi.identity.signMessage(message);
		// return base58 string
		return base58.deserialize(signatureBytes);
	} catch (err: any) {
		throw new Error(`Failed to sign policy: ${err.message || err}`);
	}
};

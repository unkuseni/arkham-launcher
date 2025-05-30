import useUmiStore from "@/store/useUmiStore";
import {
	TokenStandard,
	createV1,
} from "@metaplex-foundation/mpl-token-metadata";
import {
	AuthorityType,
	SPL_TOKEN_PROGRAM_ID,
	createMintWithAssociatedToken,
	findAssociatedTokenPda,
	setAuthority,
	setComputeUnitPrice,
} from "@metaplex-foundation/mpl-toolbox";
import {
	type TransactionBuilder,
	generateSigner,
	percentAmount,
	some,
} from "@metaplex-foundation/umi";
import { base58 } from "@metaplex-foundation/umi/serializers";

import { z } from "zod";

export const formSchema = z.object({
	name: z
		.string()
		.min(3, "Name must be at least 3 characters long.")
		.max(32, "Name must be at most 32 characters long."),
	ticker: z
		.string()
		.min(3, "Ticker must be at least 3 characters long.")
		.max(8, "Ticker must be at most 8 characters long."),
	decimals: z.number().min(0).max(12, "Decimals must be at most 12."),
	supply: z
		.number()
		.min(1, "Supply must be at least 1.")
		.max(100000000000, "Supply must be at most 100,000,000,000."),
	description: z
		.string()
		.min(3, "Description must be at least 3 characters long."),
	image: z
		.instanceof(File, { message: "Please upload an image file." })
		.refine((file) => file.size <= 5000000, "Max file size is 5MB.") // Example: 5MB max size
		.refine(
			(file) =>
				["image/jpeg", "image/png", "image/webp", "image/gif"].includes(
					file.type,
				),
			"Only .jpg, .jpeg, .png, .webp and .gif formats are supported.",
		)
		.optional(),
	// social links and tags: website, telegram, discord, twitter, reddit
	socialLinks: z
		.object({
			website: z
				.string()
				.url("Must be a valid URL.")
				.or(z.literal(""))
				.optional(),
			telegram: z
				.string()
				.url("Must be a valid URL.")
				.or(z.literal(""))
				.optional(),
			discord: z
				.string()
				.url("Must be a valid URL.")
				.or(z.literal(""))
				.optional(),
			twitter: z
				.string()
				.url("Must be a valid URL.")
				.or(z.literal(""))
				.optional(),
			reddit: z
				.string()
				.url("Must be a valid URL.")
				.or(z.literal(""))
				.optional(),
		})
		.optional(),
	tags: z
		.array(
			z.object({
				value: z
					.string()
					.min(1, "Tag cannot be empty when provided.")
					.or(z.literal("")),
			}),
		)
		.optional(),
	customAddress: z
		.string()
		.min(2)
		.max(5, "Custom address must be at most 5 characters long.")
		.optional(),
	customAddressPosition: z
		.enum(["prefix", "suffix"], {
			description: "Whether custom address is a prefix or suffix",
		})
		.default("prefix")
		.optional(),
	revokeMint: z.boolean().optional().default(false),
	revokeUpdate: z.boolean().optional().default(false),
	revokeFreeze: z.boolean().optional().default(false),
	// modify creator info
	//custom address generator
	// airdrop tokens
	//dextool profile and banner
	// dexscreener profile and banner
});

export const createSPLTokens = async (mintinfo: {
	name: string;
	decimals: number;
	supply: number;
	metadataUri: string;
	symbol: string;
	revokeMint: boolean;
	revokeUpdate: boolean;
	revokeFreeze: boolean;
}) => {
	if (!mintinfo.name?.trim()) {
		throw new Error("Token name is required");
	}
	if (mintinfo.decimals < 0 || mintinfo.decimals > 12) {
		throw new Error("Decimals must be between 0 and 12");
	}
	if (mintinfo.supply <= 0) {
		throw new Error("Supply must be greater than 0");
	}
	if (!mintinfo.metadataUri?.trim()) {
		throw new Error("Metadata URI is required");
	}

	const { umi, signer } = useUmiStore.getState();
	if (!signer) {
		throw new Error("No wallet connected. Please connect your wallet first.");
	}
	try {
		const mintSigner = generateSigner(umi);
		const {
			name,
			decimals,
			supply,
			metadataUri,
			symbol,
			revokeFreeze,
			revokeMint,
			revokeUpdate,
		} = mintinfo;

		const mintAddress = mintSigner.publicKey;

		let mintIx: TransactionBuilder;
		if (revokeFreeze) {
			mintIx = createMintWithAssociatedToken(umi, {
				mint: mintSigner,
				decimals,
				owner: umi.identity.publicKey,
				amount: BigInt(supply * 10 ** decimals),

				freezeAuthority: null,
			});
		} else {
			mintIx = createMintWithAssociatedToken(umi, {
				mint: mintSigner,
				decimals,
				owner: umi.identity.publicKey,
				amount: BigInt(supply * 10 ** decimals),
				freezeAuthority: some(umi.identity.publicKey),
			});
		}

		const createFungibleIx = createV1(umi, {
			mint: mintSigner,
			updateAuthority: revokeUpdate ? undefined : signer,
			isMutable: true,
			name,
			symbol,
			decimals,
			uri: metadataUri,
			printSupply: {
				__kind: "Limited",
				fields: [supply],
			},
			sellerFeeBasisPoints: percentAmount(0),
			tokenStandard: TokenStandard.Fungible,
			splTokenProgram: SPL_TOKEN_PROGRAM_ID,
		});

		const associatedTokenAccount = findAssociatedTokenPda(umi, {
			mint: mintAddress,
			owner: signer.publicKey,
		});

		let txBuilder = mintIx.add(createFungibleIx);

		if (revokeMint) {
			const revokeMintIx = setAuthority(umi, {
				owned: mintSigner.publicKey,
				owner: umi.identity,
				authorityType: AuthorityType.MintTokens,
				newAuthority: null,
			});
			txBuilder = txBuilder.add(revokeMintIx);
		}
		const tx = await txBuilder
			.add(setComputeUnitPrice(umi, { microLamports: 2_500_000 }))
			.sendAndConfirm(umi, { confirm: { commitment: "finalized" } });

		const signature = base58.deserialize(tx.signature)[0];
		console.log("\nTransaction Complete");
		console.log("View Transaction on Solana Explorer");
		console.log(`https://explorer.solana.com/tx/${signature}?cluster=devnet`);
		console.log("View Token on Solana Explorer");
		console.log(
			`https://explorer.solana.com/address/${mintAddress}?cluster=devnet`, // Use mintAddress
		);
		console.log("View Token Account on Solana Explorer");
		console.log(
			`https://explorer.solana.com/address/${associatedTokenAccount}?cluster=devnet`, // Log the ATA
		);

		return {
			signature,
			mintAddress: mintAddress.toString(),
			tokenAddress: associatedTokenAccount[0].toString(),
		};
	} catch (error) {
		console.error("Failed to create SPL token:", error);
		throw new Error(
			error instanceof Error
				? `Token creation failed: ${error.message}`
				: "Unknown error occurred during token creation",
		);
	}
};

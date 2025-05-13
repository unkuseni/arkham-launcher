import useUmiStore from "@/store/useUmiStore";
import { createFungible } from "@metaplex-foundation/mpl-token-metadata";
import {
	createTokenIfMissing,
	findAssociatedTokenPda,
	getSplAssociatedTokenProgramId,
	mintTokensTo,
} from "@metaplex-foundation/mpl-toolbox";
import {
	generateSigner,
	percentAmount,
	publicKey,
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
		.default("prefix"),
	revokeMint: z.boolean().optional().default(false),
	revokeUpdate: z.boolean().optional().default(false),
	revokeFreeze: z.boolean().optional().default(false),
	// modify creator info
	//custom address generator
	// airdrop tokens
	//dextool profile and banner
	// dexscreener profile and banner
});

export const mintSPLTokens = async (mintinfo: {
	name: string;
	decimals: number;
	totalSupply: number;
	metadataUri: string;
}) => {
	const { umi, signer } = useUmiStore.getState();
	const mintSigner = generateSigner(umi);
	const { name, decimals, totalSupply, metadataUri } = mintinfo;

	const createFungibleIx = createFungible(umi, {
		mint: mintSigner,
		authority: signer,
		updateAuthority: signer,
		name,
		decimals,
		uri: metadataUri,
		printSupply: {
			__kind: "Limited",
			fields: [totalSupply],
		},
		sellerFeeBasisPoints: percentAmount(0),
	});

	const createTokenIx = createTokenIfMissing(umi, {
		mint: mintSigner.publicKey,
		owner: umi.identity.publicKey,
		ataProgram: getSplAssociatedTokenProgramId(umi),
	});

	const mintTokensIx = mintTokensTo(umi, {
		mint: mintSigner.publicKey,
		token: findAssociatedTokenPda(umi, {
			mint: mintSigner.publicKey,
			owner: umi.identity.publicKey,
		}),
		amount: BigInt(totalSupply),
	});

	const tx = await createFungibleIx
		.add(createTokenIx)
		.add(mintTokensIx)
		.sendAndConfirm(umi);

	const signature = base58.deserialize(tx.signature)[0];
	console.log("\nTransaction Complete");
	console.log("View Transaction on Solana Explorer");
	console.log(`https://explorer.solana.com/tx/${signature}?cluster=devnet`);
	console.log("View Token on Solana Explorer");
	console.log(
		`https://explorer.solana.com/address/${mintSigner.publicKey}?cluster=devnet`,
	);

	return signature;
};

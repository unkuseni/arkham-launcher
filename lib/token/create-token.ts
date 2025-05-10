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
	image: z.string().url("Must be a valid URL."),
	// social links and tags: website, telegram, discord, twitter, reddit
	socialLinks: z.array(z.string().url("Must be a valid URL.")).optional(),
	tags: z.array(z.string()).optional(),
	customAddress: z
		.string()
		.min(2)
		.max(5, "Custom address must be at most 5 characters long.")
		.optional(),
	// modify creator info
	//custom address generator
	// airdrop tokens
	//dextool profile and banner
	// dexscreener profile and banner
});

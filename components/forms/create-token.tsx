"use client";
import { z } from "zod";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "../ui/card";

const CreateToken = () => {
	return (
		<div className="font-mono flex flex-col gap-4">
			<article className="mx-auto text-center">
				<h1 className="text-4xl font-bold py-2.5 px-4 capitalize font-inter">
					solana token creator
				</h1>
				<p>
					<span className="capitalize">create</span>{" "}
					<span>your next x1000 solana token effortlessly in seconds.</span>
				</p>
				<p>Reach the world and scale without limits!</p>
			</article>
			<Card>
				<CardHeader>
					<CardTitle>Card Title</CardTitle>
					<CardDescription>Card Description</CardDescription>
				</CardHeader>
				<CardContent>
					<h1 className="text-green-200">create token</h1>
				</CardContent>
				<CardFooter>Card Footer</CardFooter>
			</Card>
		</div>
	);
};
export default CreateToken;

const formSchema = z.object({
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
	// modify creator info
	//custom address generator
	// airdrop tokens
	//dextool profile and banner
	// dexscreener profile and banner
});

const TokenForm = () => {
	return (
		<>
			<div>form</div>
		</>
	);
};

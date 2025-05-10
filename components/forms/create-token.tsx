"use client";
import { formSchema } from "@/lib/token/create-token";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { Button } from "../ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "../ui/card";
import {
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "../ui/form";
import { Input } from "../ui/input";

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
					<CardTitle>Create New Token</CardTitle>
					<CardDescription>
						Fill in the details below to launch your new Solana token.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<TokenForm />
				</CardContent>
			</Card>
		</div>
	);
};
export default CreateToken;

const TokenForm = () => {
	const form = useForm<z.infer<typeof formSchema>>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			name: "",
			ticker: "",
			decimals: 9, // Default to a common value
			supply: 1000000, // Default supply
			description: "",
			image: "",
			socialLinks: [],
			tags: [],
			customAddress: "",
		},
	});

	function onSubmit(values: z.infer<typeof formSchema>) {
		// Do something with the form values.
		// ✅ This will be type-safe and validated.
		console.log(values);
		// Here you would typically make an API call to your backend
		// to create the token with the provided data.
	}

	return (
		<>
			<Form {...form}>
				<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
					<FormField
						control={form.control}
						name="name"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Token Name</FormLabel>
								<FormControl>
									<Input placeholder="e.g. My Awesome Token" {...field} />
								</FormControl>
								<FormDescription>The full name of your token.</FormDescription>
								<FormMessage />
							</FormItem>
						)}
					/>

					<FormField
						control={form.control}
						name="ticker"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Ticker Symbol</FormLabel>
								<FormControl>
									<Input placeholder="e.g. MAT" {...field} />
								</FormControl>
								<FormDescription>
									The short symbol for your token (e.g., SOL, BTC).
								</FormDescription>
								<FormMessage />
							</FormItem>
						)}
					/>

					<FormField
						control={form.control}
						name="decimals"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Decimals</FormLabel>
								<FormControl>
									<Input
										type="number"
										placeholder="e.g. 9"
										{...field}
										onChange={(e) =>
											field.onChange(Number.parseInt(e.target.value, 10))
										}
									/>
								</FormControl>
								<FormDescription>
									The number of decimal places your token will have.
								</FormDescription>
								<FormMessage />
							</FormItem>
						)}
					/>

					<FormField
						control={form.control}
						name="supply"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Total Supply</FormLabel>
								<FormControl>
									<Input
										type="number"
										placeholder="e.g. 1000000"
										{...field}
										onChange={(e) =>
											field.onChange(Number.parseInt(e.target.value, 10))
										}
									/>
								</FormControl>
								<FormDescription>
									The total number of tokens to be created.
								</FormDescription>
								<FormMessage />
							</FormItem>
						)}
					/>

					<FormField
						control={form.control}
						name="description"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Description</FormLabel>
								<FormControl>
									<Input placeholder="Describe your token..." {...field} />
								</FormControl>
								<FormDescription>
									A brief description of your token.
								</FormDescription>
								<FormMessage />
							</FormItem>
						)}
					/>

					<FormField
						control={form.control}
						name="image"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Image URL</FormLabel>
								<FormControl>
									<Input
										placeholder="https://example.com/token.png"
										{...field}
									/>
								</FormControl>
								<FormDescription>
									A direct link to an image for your token.
								</FormDescription>
								<FormMessage />
							</FormItem>
						)}
					/>

					<FormField
						control={form.control}
						name="customAddress"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Custom Address Prefix (Optional)</FormLabel>
								<FormControl>
									<Input placeholder="e.g. MYTKN" {...field} />
								</FormControl>
								<FormDescription>
									A short prefix for a custom token address (if applicable).
								</FormDescription>
								<FormMessage />
							</FormItem>
						)}
					/>

					<Button type="submit">Create Token</Button>
				</form>
			</Form>
		</>
	);
};

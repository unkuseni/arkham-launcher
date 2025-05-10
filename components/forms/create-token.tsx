"use client";
import { formSchema } from "@/lib/token/create-token";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
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
import { Textarea } from "../ui/textarea";

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
	const [imagePreview, setImagePreview] = useState<string | null>(null);
	const form = useForm<z.infer<typeof formSchema>>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			name: "",
			ticker: "",
			decimals: 9, // Default to a common value
			supply: 1000000, // Default supply
			description: "",
			image: undefined, // Changed from "" to undefined for File input
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
					<div className="grid grid-cols-1 md:grid-cols-2 gap-8">
						<FormField
							control={form.control}
							name="name"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Token Name</FormLabel>
									<FormControl>
										<Input placeholder="e.g. My Awesome Token" {...field} />
									</FormControl>
									<FormDescription>
										The full name of your token.
									</FormDescription>
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
					</div>

					<div className="grid grid-cols-1 md:grid-cols-2 gap-8">
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
					</div>

					<div className="grid grid-cols-1 md:grid-cols-2 gap-8">
						<FormField
							control={form.control}
							name="description"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Description</FormLabel>
									<FormControl>
										<Textarea
											placeholder="Describe your token..."
											{...field}
											className="min-h-[100px] md:min-h-[200px]"
										/>
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
									<FormLabel className="flex justify-center">
										Token Image
									</FormLabel>
									<FormControl>
										<div className="flex flex-col items-center space-y-4 py-4">
											{imagePreview ? (
												<img
													src={imagePreview}
													alt="Token preview"
													className="w-40 h-40 object-cover rounded-md border border-gray-300"
												/>
											) : (
												<div className="w-40 h-40 rounded-md border border-dashed border-gray-300 flex flex-col items-center justify-center text-center text-sm text-gray-500 p-4">
													<span>Click to Upload Image</span>
													<span className="mt-1 text-xs">
														1000x1000px recommended
													</span>
												</div>
											)}
											<Input
												type="file"
												accept="image/jpeg,image/png,image/webp,image/gif"
												onChange={(e) => {
													const file = e.target.files
														? e.target.files[0]
														: undefined;
													field.onChange(file); // Inform react-hook-form
													if (file) {
														const reader = new FileReader();
														reader.onloadend = () => {
															setImagePreview(reader.result as string);
														};
														reader.readAsDataURL(file);
													} else {
														setImagePreview(null);
													}
												}}
												className="sr-only"
												id="tokenImageUpload"
											/>
											<label
												htmlFor="tokenImageUpload"
												className="cursor-pointer inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 mt-2"
											>
												{imagePreview ? "Change Image" : "Select Image"}
											</label>
										</div>
									</FormControl>
									<FormDescription className="text-center">
										Max 5MB; JPG, PNG, WEBP, GIF.
									</FormDescription>
									<FormMessage className="text-center" />
								</FormItem>
							)}
						/>
					</div>

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

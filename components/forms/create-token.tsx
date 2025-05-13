"use client";
import { formSchema } from "@/lib/token/create-token";
import { zodResolver } from "@hookform/resolvers/zod";

import { useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
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
import { Checkbox } from "../ui/checkbox";
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
	const [showSocialLinks, setShowSocialLinks] = useState(false);
	const [showTags, setShowTags] = useState(false);

	const form = useForm({
		resolver: zodResolver(formSchema),
		defaultValues: {
			name: "",
			ticker: "",
			decimals: 9, // Default to a common value
			supply: 1000000, // Default supply
			description: "",
			image: undefined, // Changed from "" to undefined for File input
			socialLinks: {
				website: "",
				telegram: "",
				discord: "",
				twitter: "",
				reddit: "",
			},
			tags: [], // Updated to empty array for optional field
			customAddress: "",
			customAddressPosition: "prefix", // Default value for the new field
			revokeMint: false,
			revokeUpdate: false,
			revokeFreeze: false,
		},
	});

	const {
		fields: tagFields,
		append: appendTag,
		remove: removeTag,
	} = useFieldArray({
		control: form.control,
		name: "tags",
	});

	function onSubmit(values: z.infer<typeof formSchema>) {
		// Do something with the form values.
		// ✅ This will be type-safe and validated.
		// Transform socialLinks and tags
		const transformedValues = {
			...values,
			socialLinks: values.socialLinks,
			tags: (values.tags ?? [])
				.filter((tag) => tag.value && tag.value.trim() !== "")
				.map((tag) => tag.value),
		};
		console.log(transformedValues);
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
									<FormLabel>
										Token Name <span className="text-red-500">*</span>
									</FormLabel>
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
									<FormLabel>
										Ticker Symbol <span className="text-red-500">*</span>
									</FormLabel>
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
									<FormLabel>
										Decimals <span className="text-red-500">*</span>
									</FormLabel>
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
									<FormLabel>
										Total Supply <span className="text-red-500">*</span>
									</FormLabel>
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
									<FormLabel>
										Description <span className="text-red-500">*</span>
									</FormLabel>
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

					{/* Social Links Section */}
					<div className="space-y-2">
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => setShowSocialLinks(!showSocialLinks)}
						>
							{showSocialLinks ? "Hide" : "Show"} Social Links
						</Button>
						{showSocialLinks && (
							<div className="space-y-4 p-4 border rounded-md">
								<FormLabel>Social Links</FormLabel>
								<FormField
									control={form.control}
									name="socialLinks.website"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Website</FormLabel>
											<FormControl>
												<Input placeholder="https://example.com" {...field} />
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>
								<FormField
									control={form.control}
									name="socialLinks.telegram"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Telegram</FormLabel>
											<FormControl>
												<Input placeholder="https://t.me/username" {...field} />
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>
								<FormField
									control={form.control}
									name="socialLinks.discord"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Discord</FormLabel>
											<FormControl>
												<Input
													placeholder="https://discord.gg/invite"
													{...field}
												/>
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>
								<FormField
									control={form.control}
									name="socialLinks.twitter"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Twitter</FormLabel>
											<FormControl>
												<Input
													placeholder="https://twitter.com/username"
													{...field}
												/>
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>
								<FormField
									control={form.control}
									name="socialLinks.reddit"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Reddit</FormLabel>
											<FormControl>
												<Input
													placeholder="https://reddit.com/r/subreddit"
													{...field}
												/>
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>
								<FormDescription>
									Add links to your project's website, Twitter, Telegram, etc.
								</FormDescription>
							</div>
						)}
					</div>

					{/* Tags Section */}
					<div className="space-y-2">
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => setShowTags(!showTags)}
							className="mb-2"
						>
							{showTags ? "Hide" : "Show"} Coin Tags
						</Button>
						{showTags && (
							<div className="space-y-4 p-4 border rounded-md">
								<FormLabel>Coin Tags</FormLabel>
								{tagFields.map((field, index) => (
									<FormField
										control={form.control}
										key={field.id}
										name={`tags.${index}`}
										render={({ field: itemField }) => (
											<FormItem className="flex items-center space-x-2">
												<FormControl>
													<Input
														placeholder="e.g. DeFi, Meme, GameFi"
														{...itemField}
														value={itemField.value?.value || ""}
														onChange={(e) =>
															itemField.onChange({ value: e.target.value })
														}
													/>
												</FormControl>
												<Button
													type="button"
													variant="destructive"
													size="sm"
													onClick={() => removeTag(index)}
													disabled={
														tagFields.length === 1 &&
														itemField.value?.value === ""
													}
												>
													Remove
												</Button>
												<FormMessage />
											</FormItem>
										)}
									/>
								))}
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={() => appendTag({ value: "" })}
								>
									Add Tag
								</Button>
								<FormDescription>
									Add relevant tags to categorize your token.
								</FormDescription>
							</div>
						)}
					</div>

					<FormField
						control={form.control}
						name="customAddress"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Custom Address (Optional)</FormLabel>
								<div className="flex space-x-2">
									<FormControl>
										<Input placeholder="e.g. MYTKN" {...field} />
									</FormControl>
									<FormField
										control={form.control}
										name="customAddressPosition"
										render={({ field: posField }) => (
											<FormControl>
												<select
													{...posField}
													className="border rounded px-2 py-1"
												>
													<option value="prefix">Prefix</option>
													<option value="suffix">Suffix</option>
												</select>
											</FormControl>
										)}
									/>
								</div>
								<FormDescription>
									A short prefix or suffix for a custom token address.
								</FormDescription>
								<FormMessage />
							</FormItem>
						)}
					/>
					<div className="space-y-4">
						<FormLabel>Token Permissions</FormLabel>
						<div className="flex items-center justify-between">
							<FormField
								control={form.control}
								name="revokeMint"
								render={({ field }) => (
									<FormItem className="flex items-center space-x-2">
										<FormControl>
											<Checkbox
												checked={field.value}
												onCheckedChange={field.onChange}
											/>
										</FormControl>
										<div>
											<FormLabel>Revoke Mint</FormLabel>
											<FormDescription>
												Revoke the ability to mint the token.
											</FormDescription>
											<FormMessage />
										</div>
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name="revokeUpdate"
								render={({ field }) => (
									<FormItem className="flex items-center space-x-2">
										<FormControl>
											<Checkbox
												checked={field.value}
												onCheckedChange={field.onChange}
											/>
										</FormControl>
										<div>
											<FormLabel>Revoke Update</FormLabel>
											<FormDescription>
												Revoke the ability to update the token.
											</FormDescription>
											<FormMessage />
										</div>
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name="revokeFreeze"
								render={({ field }) => (
									<FormItem className="flex items-center space-x-2">
										<FormControl>
											<Checkbox
												checked={field.value}
												onCheckedChange={field.onChange}
											/>
										</FormControl>
										<div>
											<FormLabel>Revoke Freeze</FormLabel>
											<FormDescription>
												Revoke the ability to freeze the token.
											</FormDescription>
											<FormMessage />
										</div>
									</FormItem>
								)}
							/>
						</div>
					</div>

					<Button type="submit">Create Token</Button>
				</form>
			</Form>
		</>
	);
};

"use client";
import { createSPLTokens, formSchema } from "@/lib/token/create-token";
import { zodResolver } from "@hookform/resolvers/zod";

import TokenSuccessModal, {
	type TokenDetails,
} from "@/components/cards/token-success-modal";
import { uploadImageToCloudflareR2 } from "@/lib/s3-bucket";
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
		<div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-secondary/10 relative overflow-hidden">
			{/* Background decoration */}
			<div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:60px_60px]" />
			<div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-primary/5 via-transparent to-secondary/5" />

			<div className="container mx-auto px-4 py-12 max-w-7xl relative">
				{/* Hero Section */}
				<article className="text-center mb-16">
					<div className="inline-flex items-center justify-center w-24 h-24 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 mb-8 relative">
						<div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary/80 shadow-lg" />
						<div className="absolute inset-0 rounded-2xl bg-primary/5 animate-pulse" />
					</div>
					<h1 className="text-6xl md:text-7xl font-bold bg-gradient-to-r from-primary via-primary/90 to-primary/70 bg-clip-text text-transparent mb-6 tracking-tight">
						Solana Token Creator
					</h1>
					<p className="text-xl md:text-2xl text-muted-foreground mb-3 max-w-3xl mx-auto font-medium">
						Create your next breakthrough token effortlessly in seconds
					</p>
					<p className="text-lg text-muted-foreground/70 max-w-2xl mx-auto">
						Launch on Solana with professional-grade tools • No coding required
					</p>

					{/* Stats or features */}
					<div className="flex flex-wrap justify-center gap-8 mt-12 text-sm text-muted-foreground">
						<div className="flex items-center gap-2">
							<div className="w-2 h-2 rounded-full bg-green-500" />
							<span>Instant deployment</span>
						</div>
						<div className="flex items-center gap-2">
							<div className="w-2 h-2 rounded-full bg-blue-500" />
							<span>Metadata on IPFS</span>
						</div>
						<div className="flex items-center gap-2">
							<div className="w-2 h-2 rounded-full bg-purple-500" />
							<span>SPL Token standard</span>
						</div>
					</div>
				</article>

				{/* Main Form Card */}
				<Card className="shadow-2xl border border-border/50 bg-card/80 backdrop-blur-xl relative overflow-hidden">
					{/* Card decoration */}
					<div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary/50 via-primary to-primary/50" />

					<CardHeader className="text-center pb-12 pt-12">
						<CardTitle className="text-4xl font-bold mb-4 bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
							Create New Token
						</CardTitle>
						<CardDescription className="text-lg text-muted-foreground max-w-2xl mx-auto">
							Fill in the details below to launch your new Solana token on the blockchain.
							All fields marked with * are required.
						</CardDescription>
					</CardHeader>
					<CardContent className="px-8 md:px-12 pb-12">
						<TokenForm />
					</CardContent>
				</Card>
			</div>
		</div>
	);
};
export default CreateToken;

const TokenForm = () => {
	const [imagePreview, setImagePreview] = useState<string | null>(null);
	// URL returned from R2 upload
	const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
	const [showSocialLinks, setShowSocialLinks] = useState(false);
	const [showTags, setShowTags] = useState(false);
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [createdTokenDetails, setCreatedTokenDetails] =
		useState<TokenDetails | null>(null);

	const form = useForm({
		resolver: zodResolver(formSchema),
		defaultValues: {
			name: "",
			ticker: "",
			decimals: 9,
			supply: 1000000000,
			description: "",
			image: undefined,
			socialLinks: {
				website: "",
				telegram: "",
				discord: "",
				twitter: "",
				reddit: "",
			},
			tags: [],
			customAddress: undefined,
			customAddressPosition: "prefix",
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

	async function onSubmit(values: z.infer<typeof formSchema>) {
		try {
			const { name, ticker, description, supply, socialLinks, decimals } =
				values;

			// Image URL should have been set on selection
			const imageUrl = uploadedImageUrl;

			// Prepare metadata
			const token_metadata = {
				name,
				symbol: ticker,
				description,
				image: imageUrl || "",
				extensions: socialLinks,
			};

			// Upload metadata to Pinata via internal API
			const response = await fetch("/api/pinata/pinJSON", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(token_metadata),
			});
			const data = await response.json();
			if (!response.ok || !data.IpfsHash) {
				console.error("Metadata upload error:", data.error || data);
				form.setError("root", {
					type: "manual",
					message: "Failed to upload metadata.",
				});
				return;
			}
			console.log("Metadata uploaded. IPFS Hash:", data.IpfsHash);
			const metadataUri = `https://gateway.pinata.cloud/ipfs/${data.IpfsHash}`;

			// Mint the token
			const mintInfo = { name, decimals, supply, metadataUri };
			const txResult = await createSPLTokens(mintInfo);

			// Show success modal
			setCreatedTokenDetails({
				name,
				ticker,
				decimals,
				supply,
				description,
				imageUrl: uploadedImageUrl || undefined,
				pinataUrl: metadataUri,
				txResult,
			});
			setIsModalOpen(true);
			form.reset();
			setImagePreview(null);
			setUploadedImageUrl(null);
			setShowSocialLinks(false);
			setShowTags(false);
		} catch (error: unknown) {
			console.error("Token creation error:", error);
			const errorMessage = error instanceof Error ? error.message : "Failed to create token.";
			form.setError("root", {
				type: "manual",
				message: errorMessage,
			});
		}
	}

	const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files ? e.target.files[0] : undefined;
		form.setValue("image", file, { shouldValidate: true });
		if (file) {
			// show local preview
			const reader = new FileReader();
			reader.onloadend = () => setImagePreview(reader.result as string);
			reader.readAsDataURL(file);
			// upload to R2
			const url = await uploadImageToCloudflareR2(file);
			console.log("Uploaded image URL:", url);
			if (url) setUploadedImageUrl(url);
		} else {
			setImagePreview(null);
			setUploadedImageUrl(null);
		}
	};

	return (
		<>
			<Form {...form}>
				<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-10">
					{/* Basic Information Section */}
					<div className="space-y-8">
						<div className="flex items-center gap-4 mb-8">
							<div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10">
								<div className="w-5 h-5 rounded-lg bg-gradient-to-br from-primary to-primary/80" />
							</div>
							<div>
								<h2 className="text-2xl font-bold text-foreground">Basic Information</h2>
								<p className="text-sm text-muted-foreground">Essential details for your token</p>
							</div>
						</div>

						<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
							<FormField
								control={form.control}
								name="name"
								render={({ field }) => (
									<FormItem>
										<FormLabel className="text-base font-medium">
											Token Name <span className="text-destructive">*</span>
										</FormLabel>
										<FormControl>
											<Input
												placeholder="e.g. My Awesome Token"
												{...field}
												className="h-12 text-base"
											/>
										</FormControl>
										<FormDescription>
											The full name of your token (3-32 characters)
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
										<FormLabel className="text-base font-medium">
											Ticker Symbol <span className="text-destructive">*</span>
										</FormLabel>
										<FormControl>
											<Input
												placeholder="e.g. MAT"
												{...field}
												className="h-12 text-base uppercase"
												onChange={(e) => field.onChange(e.target.value.toUpperCase())}
											/>
										</FormControl>
										<FormDescription>
											Short symbol for your token (3-8 characters)
										</FormDescription>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>

						<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
							<FormField
								control={form.control}
								name="decimals"
								render={({ field }) => (
									<FormItem>
										<FormLabel className="text-base font-medium">
											Decimals <span className="text-destructive">*</span>
										</FormLabel>
										<FormControl>
											<Input
												type="number"
												placeholder="9"
												{...field}
												value={field.value ?? 9}
												onChange={(e) => {
													const val = e.target.value;
													field.onChange(
														val === "" ? undefined : Number.parseInt(val, 10),
													);
												}}
												className="h-12 text-base"
												min="0"
												max="12"
											/>
										</FormControl>
										<FormDescription>
											Number of decimal places (0-12, typically 9)
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
										<FormLabel className="text-base font-medium">
											Total Supply <span className="text-destructive">*</span>
										</FormLabel>
										<FormControl>
											<Input
												type="text"
												inputMode="numeric"
												placeholder="1,000,000,000"
												value={
													field.value === undefined ||
														field.value === null ||
														Number.isNaN(Number(field.value))
														? ""
														: Number(field.value).toLocaleString()
												}
												onChange={(e) => {
													const inputValue = e.target.value;
													const numericString = inputValue.replace(/[^0-9]/g, "");

													if (numericString === "") {
														field.onChange(undefined);
													} else {
														const numberValue = Number.parseInt(
															numericString,
															10,
														);
														if (!Number.isNaN(numberValue)) {
															field.onChange(numberValue);
														}
													}
												}}
												className="h-12 text-base"
											/>
										</FormControl>
										<FormDescription>
											Total number of tokens to create
										</FormDescription>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>
					</div>

					{/* Description and Image Section */}
					<div className="space-y-8">
						<div className="flex items-center gap-4 mb-8">
							<div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-500/10">
								<div className="w-5 h-5 rounded-lg bg-gradient-to-br from-blue-500 to-blue-500/80" />
							</div>
							<div>
								<h2 className="text-2xl font-bold text-foreground">Description & Media</h2>
								<p className="text-sm text-muted-foreground">Tell your story and showcase your brand</p>
							</div>
						</div>

						<div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
							<FormField
								control={form.control}
								name="description"
								render={({ field }) => (
									<FormItem>
										<FormLabel className="text-base font-medium">
											Description <span className="text-destructive">*</span>
										</FormLabel>
										<FormControl>
											<Textarea
												placeholder="Describe your token's purpose, utility, and vision..."
												{...field}
												className="min-h-[180px] text-base resize-none border-2 border-border/50 focus:border-primary/50 transition-colors"
											/>
										</FormControl>
										<FormDescription>
											Tell the world about your token's mission and use case
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
										<FormLabel className="text-base font-medium text-center block">
											Token Image
										</FormLabel>
										<FormControl>
											<div className="flex flex-col items-center space-y-6">
												<div className="relative group">
													{imagePreview ? (
														<div className="relative">
															<img
																src={imagePreview}
																alt="Token preview"
																className="w-52 h-52 object-cover rounded-2xl border-4 border-border/50 shadow-xl transition-all duration-300 group-hover:scale-105 group-hover:shadow-2xl"
															/>
															<div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center pb-4">
																<span className="text-white text-sm font-medium bg-black/50 px-3 py-1 rounded-full backdrop-blur-sm">
																	Click to change
																</span>
															</div>
														</div>
													) : (
														<div className="w-52 h-52 rounded-2xl border-2 border-dashed border-primary/30 flex flex-col items-center justify-center text-center p-8 hover:border-primary/60 hover:bg-primary/5 transition-all duration-300 cursor-pointer bg-gradient-to-br from-primary/5 to-transparent">
															<div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
																<svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
																	<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
																</svg>
															</div>
															<span className="text-base font-medium text-foreground mb-2">
																Upload Token Image
															</span>
															<span className="text-sm text-muted-foreground">
																1000x1000px • Max 5MB
															</span>
														</div>
													)}
												</div>
												<Input
													type="file"
													accept="image/jpeg,image/png,image/webp,image/gif"
													onChange={handleImageChange}
													className="sr-only"
													id="tokenImageUpload"
												/>
												<label
													htmlFor="tokenImageUpload"
													className="cursor-pointer inline-flex items-center justify-center rounded-xl text-sm font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-105 h-12 px-8 shadow-lg hover:shadow-xl"
												>
													{imagePreview ? "Change Image" : "Select Image"}
												</label>
											</div>
										</FormControl>
										<FormDescription className="text-center">
											Supported formats: JPG, PNG, WEBP, GIF
										</FormDescription>
										<FormMessage className="text-center" />
									</FormItem>
								)}
							/>
						</div>
					</div>

					{/* Social Links Section */}
					<div className="space-y-6">
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-4">
								<div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/10">
									<div className="w-5 h-5 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-500/80" />
								</div>
								<div>
									<h2 className="text-2xl font-bold text-foreground">Social Links</h2>
									<p className="text-sm text-muted-foreground">Connect with your community</p>
								</div>
							</div>
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={() => setShowSocialLinks(!showSocialLinks)}
								className="h-11 px-6 border-2 hover:bg-primary/5 hover:border-primary/30 transition-all duration-200"
							>
								{showSocialLinks ? "Hide Links" : "Add Social Links"}
							</Button>
						</div>

						{showSocialLinks && (
							<Card className="p-8 bg-gradient-to-br from-muted/30 to-muted/10 border-2 border-border/30">
								<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
									<FormField
										control={form.control}
										name="socialLinks.website"
										render={({ field }) => (
											<FormItem>
												<FormLabel className="flex items-center gap-2 text-base font-medium">
													<span className="text-lg">🌐</span> Website
												</FormLabel>
												<FormControl>
													<Input
														placeholder="https://yourtoken.com"
														{...field}
														className="h-12 border-2 border-border/50 focus:border-primary/50 transition-colors"
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
												<FormLabel className="flex items-center gap-2 text-base font-medium">
													<span className="text-lg">🐦</span> Twitter/X
												</FormLabel>
												<FormControl>
													<Input
														placeholder="https://twitter.com/yourtoken"
														{...field}
														className="h-12 border-2 border-border/50 focus:border-primary/50 transition-colors"
													/>
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
												<FormLabel className="flex items-center gap-2 text-base font-medium">
													<span className="text-lg">✈️</span> Telegram
												</FormLabel>
												<FormControl>
													<Input
														placeholder="https://t.me/yourtoken"
														{...field}
														className="h-12 border-2 border-border/50 focus:border-primary/50 transition-colors"
													/>
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
												<FormLabel className="flex items-center gap-2 text-base font-medium">
													<span className="text-lg">💬</span> Discord
												</FormLabel>
												<FormControl>
													<Input
														placeholder="https://discord.gg/yourtoken"
														{...field}
														className="h-12 border-2 border-border/50 focus:border-primary/50 transition-colors"
													/>
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>
								</div>
								<div className="mt-6 p-4 bg-primary/5 rounded-xl border border-primary/10">
									<p className="text-sm text-muted-foreground text-center">
										💡 Adding social links helps build trust and allows your community to find and connect with your project
									</p>
								</div>
							</Card>
						)}
					</div>

					{/* Tags Section */}
					<div className="space-y-8">
						<div className="flex items-center gap-4">
							<div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-500/10">
								<div className="w-5 h-5 rounded-lg bg-gradient-to-br from-purple-500 to-purple-500/80" />
							</div>
							<div className="flex-1">
								<h2 className="text-2xl font-bold text-foreground">Tags & Categories</h2>
								<p className="text-sm text-muted-foreground">Help users discover your token</p>
							</div>
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={() => setShowTags(!showTags)}
								className="h-10 px-4 border-2 border-purple-500/20 hover:border-purple-500/40 hover:bg-purple-500/5 transition-colors"
							>
								{showTags ? (
									<>
										<svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
										</svg>
										Hide Tags
									</>
								) : (
									<>
										<svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
										</svg>
										Add Tags
									</>
								)}
							</Button>
						</div>

						{showTags && (
							<Card className="p-8 backdrop-blur-sm bg-gradient-to-br from-purple-500/5 via-transparent to-transparent border-2 border-purple-500/10 shadow-xl">
								<div className="space-y-6">
									{tagFields.map((field, index) => (
										<FormField
											control={form.control}
											key={field.id}
											name={`tags.${index}`}
											render={({ field: itemField }) => (
												<FormItem>
													<div className="flex items-center gap-4">
														<div className="flex-1">
															<FormControl>
																<Input
																	placeholder="e.g. DeFi, Gaming, Meme, Utility, NFT"
																	{...itemField}
																	value={itemField.value?.value || ""}
																	onChange={(e) =>
																		itemField.onChange({ value: e.target.value })
																	}
																	className="h-12 text-base border-2 border-border/50 focus:border-purple-500/50 bg-background/50 backdrop-blur-sm transition-colors"
																/>
															</FormControl>
														</div>
														<Button
															type="button"
															variant="outline"
															size="sm"
															onClick={() => removeTag(index)}
															disabled={tagFields.length === 1 && itemField.value?.value === ""}
															className="h-12 px-4 border-2 border-destructive/20 text-destructive hover:border-destructive/40 hover:bg-destructive/5 transition-colors"
														>
															<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
																<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
															</svg>
														</Button>
													</div>
													<FormMessage />
												</FormItem>
											)}
										/>
									))}

									<div className="flex justify-center pt-4">
										<Button
											type="button"
											variant="secondary"
											size="sm"
											onClick={() => appendTag({ value: "" })}
											className="h-12 px-6 bg-purple-500/10 hover:bg-purple-500/20 border-2 border-purple-500/20 hover:border-purple-500/30 text-purple-700 dark:text-purple-300 transition-colors"
										>
											<svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
											</svg>
											Add Another Tag
										</Button>
									</div>
								</div>

								<div className="mt-8 p-6 bg-gradient-to-r from-purple-500/10 to-blue-500/10 rounded-xl border border-purple-500/20">
									<div className="flex items-start gap-3">
										<div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
											<svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
											</svg>
										</div>
										<div>
											<p className="text-sm font-medium text-foreground mb-1">Popular Tag Categories</p>
											<p className="text-xs text-muted-foreground">
												DeFi • Gaming • Meme • Utility • NFT • DAO • Staking • Governance • Social • AI • Music • Art
											</p>
										</div>
									</div>
								</div>
							</Card>
						)}
					</div>

					{/* Advanced Options Section */}
					<div className="space-y-8">
						<div className="flex items-center gap-4">
							<div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500/20 to-orange-500/10">
								<div className="w-5 h-5 rounded-lg bg-gradient-to-br from-orange-500 to-orange-500/80" />
							</div>
							<div>
								<h2 className="text-2xl font-bold text-foreground">Advanced Settings</h2>
								<p className="text-sm text-muted-foreground">Customize address and permissions</p>
							</div>
						</div>

						{/* Custom Address */}
						<Card className="p-8 backdrop-blur-sm bg-gradient-to-br from-orange-500/5 via-transparent to-transparent border-2 border-orange-500/10 shadow-xl">
							<div className="mb-6">
								<h3 className="text-lg font-semibold text-foreground mb-2 flex items-center gap-2">
									<svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
									</svg>
									Custom Address Pattern
								</h3>
								<p className="text-sm text-muted-foreground">Generate a vanity address with your preferred pattern</p>
							</div>

							<FormField
								control={form.control}
								name="customAddress"
								render={({ field }) => (
									<FormItem>
										<FormLabel className="text-base font-medium">Pattern Text</FormLabel>
										<div className="flex gap-4">
											<div className="flex-1">
												<FormControl>
													<Input
														placeholder="e.g. MYTKN"
														{...field}
														className="h-12 uppercase text-base border-2 border-border/50 focus:border-orange-500/50 bg-background/50 backdrop-blur-sm transition-colors"
														onChange={(e) => field.onChange(e.target.value.toUpperCase())}
													/>
												</FormControl>
											</div>
											<FormField
												control={form.control}
												name="customAddressPosition"
												render={({ field: posField }) => (
													<FormControl>
														<select
															{...posField}
															className="h-12 px-4 border-2 border-border/50 bg-background/50 backdrop-blur-sm rounded-md text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/50 focus-visible:ring-offset-2 transition-colors min-w-[120px]"
														>
															<option value="prefix">Prefix</option>
															<option value="suffix">Suffix</option>
														</select>
													</FormControl>
												)}
											/>
										</div>
										<FormDescription>
											Add a custom prefix or suffix to your token address (2-5 characters). This may take longer to generate.
										</FormDescription>
										<FormMessage />
									</FormItem>
								)}
							/>
						</Card>

						{/* Token Permissions */}
						<Card className="p-8 backdrop-blur-sm bg-gradient-to-br from-red-500/5 via-transparent to-transparent border-2 border-red-500/10 shadow-xl">
							<div className="mb-8">
								<h3 className="text-lg font-semibold text-foreground mb-2 flex items-center gap-2">
									<svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
									</svg>
									Token Permissions & Security
								</h3>
								<p className="text-sm text-muted-foreground">
									Enhance security and decentralization by revoking authorities. Once revoked, these actions cannot be undone.
								</p>
							</div>

							<div className="grid grid-cols-1 md:grid-cols-3 gap-8">
								<FormField
									control={form.control}
									name="revokeMint"
									render={({ field }) => (
										<FormItem>
											<div className="p-6 rounded-xl border-2 border-border/30 hover:border-green-500/30 bg-gradient-to-br from-green-500/5 to-transparent hover:from-green-500/10 transition-all duration-300 group">
												<div className="flex items-start space-x-4">
													<FormControl>
														<Checkbox
															checked={field.value}
															onCheckedChange={field.onChange}
															className="w-5 h-5 mt-1 border-2 border-green-500/50 data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500"
														/>
													</FormControl>
													<div className="flex-1 space-y-2">
														<FormLabel className="text-base font-semibold text-foreground group-hover:text-green-700 dark:group-hover:text-green-300 transition-colors cursor-pointer">
															🚫 Revoke Mint Authority
														</FormLabel>
														<FormDescription className="text-sm leading-relaxed">
															Permanently prevents creating additional tokens. Ensures fixed supply and builds trust.
														</FormDescription>
													</div>
												</div>
											</div>
											<FormMessage />
										</FormItem>
									)}
								/>

								<FormField
									control={form.control}
									name="revokeUpdate"
									render={({ field }) => (
										<FormItem>
											<div className="p-6 rounded-xl border-2 border-border/30 hover:border-blue-500/30 bg-gradient-to-br from-blue-500/5 to-transparent hover:from-blue-500/10 transition-all duration-300 group">
												<div className="flex items-start space-x-4">
													<FormControl>
														<Checkbox
															checked={field.value}
															onCheckedChange={field.onChange}
															className="w-5 h-5 mt-1 border-2 border-blue-500/50 data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
														/>
													</FormControl>
													<div className="flex-1 space-y-2">
														<FormLabel className="text-base font-semibold text-foreground group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors cursor-pointer">
															🔒 Revoke Update Authority
														</FormLabel>
														<FormDescription className="text-sm leading-relaxed">
															Prevents modifying token metadata. Makes name, symbol, and image immutable.
														</FormDescription>
													</div>
												</div>
											</div>
											<FormMessage />
										</FormItem>
									)}
								/>

								<FormField
									control={form.control}
									name="revokeFreeze"
									render={({ field }) => (
										<FormItem>
											<div className="p-6 rounded-xl border-2 border-border/30 hover:border-purple-500/30 bg-gradient-to-br from-purple-500/5 to-transparent hover:from-purple-500/10 transition-all duration-300 group">
												<div className="flex items-start space-x-4">
													<FormControl>
														<Checkbox
															checked={field.value}
															onCheckedChange={field.onChange}
															className="w-5 h-5 mt-1 border-2 border-purple-500/50 data-[state=checked]:bg-purple-500 data-[state=checked]:border-purple-500"
														/>
													</FormControl>
													<div className="flex-1 space-y-2">
														<FormLabel className="text-base font-semibold text-foreground group-hover:text-purple-700 dark:group-hover:text-purple-300 transition-colors cursor-pointer">
															❄️ Revoke Freeze Authority
														</FormLabel>
														<FormDescription className="text-sm leading-relaxed">
															Prevents freezing token accounts. Ensures users maintain full control of their tokens.
														</FormDescription>
													</div>
												</div>
											</div>
											<FormMessage />
										</FormItem>
									)}
								/>
							</div>

							<div className="mt-8 p-6 bg-gradient-to-r from-amber-500/10 to-orange-500/10 rounded-xl border border-amber-500/20">
								<div className="flex items-start gap-3">
									<div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
										<svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
										</svg>
									</div>
									<div>
										<p className="text-sm font-medium text-foreground mb-1">⚠️ Important Security Notice</p>
										<p className="text-xs text-muted-foreground">
											Revoking authorities is permanent and cannot be undone. Consider your long-term token strategy before proceeding.
										</p>
									</div>
								</div>
							</div>
						</Card>
					</div>

					{/* Submit Section */}
					{form.formState.errors.root && (
						<Card className="p-6 border-2 border-destructive/50 bg-gradient-to-r from-destructive/10 to-red-500/10 backdrop-blur-sm shadow-xl">
							<div className="flex items-center gap-4">
								<div className="w-12 h-12 rounded-xl bg-destructive/20 flex items-center justify-center flex-shrink-0">
									<svg className="w-6 h-6 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
									</svg>
								</div>
								<div>
									<h4 className="text-base font-semibold text-destructive mb-1">Token Creation Failed</h4>
									<FormMessage className="text-sm text-destructive/80">
										{form.formState.errors.root.message}
									</FormMessage>
								</div>
							</div>
						</Card>
					)}

					<div className="flex justify-center pt-8">
						<div className="relative group">
							<div className="absolute -inset-1 bg-gradient-to-r from-primary via-blue-500 to-purple-500 rounded-xl blur opacity-25 group-hover:opacity-50 transition duration-300" />
							<Button
								type="submit"
								disabled={form.formState.isSubmitting}
								className="relative h-16 px-16 text-lg font-bold min-w-[280px] bg-gradient-to-r from-primary to-blue-600 hover:from-primary/90 hover:to-blue-600/90 shadow-2xl hover:shadow-3xl transition-all duration-300 transform hover:scale-105 border-0"
							>
								{form.formState.isSubmitting ? (
									<>
										<div className="w-6 h-6 border-3 border-current border-t-transparent rounded-full animate-spin mr-4" />
										<span className="bg-gradient-to-r from-white to-blue-100 bg-clip-text text-transparent">
											Creating Your Token...
										</span>
									</>
								) : (
									<span className="flex items-center gap-3">
										<span className="text-2xl">🚀</span>
										<span className="bg-gradient-to-r from-white to-blue-100 bg-clip-text text-transparent">
											Launch Token
										</span>
									</span>
								)}
							</Button>
						</div>
					</div>

					{form.formState.isSubmitting && (
						<div className="mt-8 p-6 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-xl border border-blue-500/20 backdrop-blur-sm">
							<div className="flex items-center justify-center gap-4">
								<div className="flex space-x-1">
									<div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
									<div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
									<div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" />
								</div>
								<p className="text-sm font-medium text-foreground">
									Deploying to Solana blockchain and uploading metadata to IPFS...
								</p>
							</div>
							<div className="mt-4 bg-muted/50 rounded-full h-2 overflow-hidden">
								<div className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full animate-pulse" />
							</div>
						</div>
					)}
				</form>
			</Form>

			{createdTokenDetails && (
				<TokenSuccessModal
					isOpen={isModalOpen}
					onClose={() => setIsModalOpen(false)}
					tokenDetails={createdTokenDetails}
				/>
			)}
		</>
	);
};

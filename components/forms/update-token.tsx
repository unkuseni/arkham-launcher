"use client";
import { uploadImageToCloudflareR2 } from "@/lib/s3-bucket";
import { updateTokenMetadata } from "@/lib/token/update-token";
import { zodResolver } from "@hookform/resolvers/zod";
import {
	AlertCircle,
	CheckCircle2,
	Edit3,
	Image as ImageIcon,
	Loader2,
	Upload,
	X,
} from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "../ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "../ui/card";
import { Checkbox } from "../ui/checkbox";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "../ui/dialog";
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
import { Separator } from "../ui/separator";
import { Textarea } from "../ui/textarea";

const formSchema = z.object({
	mintAddress: z.string().nonempty("Mint address is required"),
	name: z.string().optional(),
	symbol: z.string().optional(),
	uri: z.string().url().optional(),
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
	description: z.string().optional(),
	sellerFeeBasisPoints: z.number().int().optional(),
	mintAuthority: z.string().optional(),
	updateAuthority: z.string().optional(),
	isMutable: z.boolean().optional(),
	primarySaleHappened: z.boolean().optional(),
});

type FormValues = z.infer<typeof formSchema>;

const UpdateToken = () => {
	const [signature, setSignature] = useState<string | null>(null);
	const [imagePreview, setImagePreview] = useState<string | null>(null);
	const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
	const [isImageUploading, setIsImageUploading] = useState(false);
	const [isDragging, setIsDragging] = useState(false);

	const form = useForm<FormValues>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			mintAddress: "",
			name: undefined,
			symbol: undefined,
			uri: undefined,
			image: undefined,
			description: undefined,
			sellerFeeBasisPoints: undefined,
			mintAuthority: undefined,
			updateAuthority: undefined,
			isMutable: true,
			primarySaleHappened: false,
		},
	});

	const onSubmit = async (values: FormValues) => {
		try {
			let metadataUri = values.uri;

			if (values.description || uploadedImageUrl) {
				const token_metadata = {
					name: values.name || "",
					symbol: values.symbol || "",
					description: values.description || "",
					image: uploadedImageUrl || "",
				};

				const response = await fetch("/api/pinata/pinJSON", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(token_metadata),
				});

				const data = await response.json();
				if (!response.ok || !data.IpfsHash) {
					form.setError("root", {
						type: "manual",
						message: "Failed to upload updated metadata.",
					});
					return;
				}

				metadataUri = `https://gateway.pinata.cloud/ipfs/${data.IpfsHash}`;
				console.log("New metadata URI:", metadataUri);
			}

			const result = await updateTokenMetadata({
				...values,
				uri: metadataUri,
			});
			setSignature(result.signature);
			form.reset();
			setImagePreview(null);
			setUploadedImageUrl(null);
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : "Update failed";
			form.setError("mintAddress", {
				type: "manual",
				message,
			});
		}
	};

	const handleImageChange = async (file: File) => {
		if (!file) return;

		setIsImageUploading(true);
		form.setValue("image", file, { shouldValidate: true });

		try {
			// Show local preview
			const reader = new FileReader();
			reader.onloadend = () => setImagePreview(reader.result as string);
			reader.readAsDataURL(file);

			// Upload to R2
			const url = await uploadImageToCloudflareR2(file);
			console.log("Uploaded image URL:", url);
			if (url) setUploadedImageUrl(url);
		} catch (error) {
			console.error("Image upload failed:", error);
			form.setError("image", {
				type: "manual",
				message: "Failed to upload image. Please try again.",
			});
		} finally {
			setIsImageUploading(false);
		}
	};

	const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (file) handleImageChange(file);
	};

	const handleDrop = (e: React.DragEvent) => {
		e.preventDefault();
		setIsDragging(false);
		const file = e.dataTransfer.files[0];
		if (file?.type.startsWith("image/")) {
			handleImageChange(file);
		}
	};

	const handleDragOver = (e: React.DragEvent) => {
		e.preventDefault();
		setIsDragging(true);
	};

	const handleDragLeave = (e: React.DragEvent) => {
		e.preventDefault();
		setIsDragging(false);
	};

	const removeImage = () => {
		setImagePreview(null);
		setUploadedImageUrl(null);
		form.setValue("image", undefined);
	};

	return (
		<div className="font-mono flex flex-col gap-6 max-w-5xl mx-auto p-4">
			{/* Header Section */}
			<article className="mx-auto text-center space-y-2">
				<div className="flex items-center justify-center gap-2 mb-4">
					<Edit3 className="h-8 w-8 text-primary" />
					<h1 className="text-4xl font-bold font-inter">
						Update Token Metadata
					</h1>
				</div>
				<p className="text-muted-foreground text-lg">
					Update on-chain & off-chain metadata for your Solana token
				</p>
			</article>

			<Card className="border-2">
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Edit3 className="h-5 w-5" />
						Token Information
					</CardTitle>
					<CardDescription>
						Modify your token's metadata, authorities, and settings
					</CardDescription>
				</CardHeader>
				<CardContent>
					<Form {...form}>
						<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
							{/* Basic Information Section */}
							<div className="space-y-6">
								<div className="flex items-center gap-2 mb-4">
									<h3 className="text-lg font-semibold">Basic Information</h3>
								</div>

								<FormField
									control={form.control}
									name="mintAddress"
									render={({ field }) => (
										<FormItem>
											<FormLabel className="text-base font-medium">
												Mint Address <span className="text-red-500">*</span>
											</FormLabel>
											<FormControl>
												<Input
													placeholder="Enter the token mint address..."
													className="h-12"
													{...field}
												/>
											</FormControl>
											<FormDescription>
												The unique identifier of your token on Solana blockchain
											</FormDescription>
											<FormMessage />
										</FormItem>
									)}
								/>

								<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
									<FormField
										control={form.control}
										name="name"
										render={({ field }) => (
											<FormItem>
												<FormLabel className="text-base font-medium">
													Token Name
												</FormLabel>
												<FormControl>
													<Input
														placeholder="e.g., My Awesome Token"
														className="h-12"
														{...field}
													/>
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>

									<FormField
										control={form.control}
										name="symbol"
										render={({ field }) => (
											<FormItem>
												<FormLabel className="text-base font-medium">
													Symbol
												</FormLabel>
												<FormControl>
													<Input
														placeholder="e.g., MAT"
														className="h-12"
														{...field}
													/>
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>
								</div>

								<FormField
									control={form.control}
									name="description"
									render={({ field }) => (
										<FormItem>
											<FormLabel className="text-base font-medium">
												Description
											</FormLabel>
											<FormControl>
												<Textarea
													placeholder="Describe your token's purpose, utility, and key features..."
													className="min-h-[120px] resize-none"
													{...field}
												/>
											</FormControl>
											<FormDescription>
												A comprehensive description that will be stored in
												metadata
											</FormDescription>
											<FormMessage />
										</FormItem>
									)}
								/>

								<FormField
									control={form.control}
									name="uri"
									render={({ field }) => (
										<FormItem>
											<FormLabel className="text-base font-medium">
												Metadata URI
											</FormLabel>
											<FormControl>
												<Input
													placeholder="https://your-metadata-url.com/metadata.json"
													className="h-12"
													{...field}
												/>
											</FormControl>
											<FormDescription>
												Optional: Direct link to existing metadata JSON file
											</FormDescription>
											<FormMessage />
										</FormItem>
									)}
								/>
							</div>

							<Separator />

							{/* Image Upload Section */}
							<div className="space-y-6">
								<div className="flex items-center gap-2 mb-4">
									<ImageIcon className="h-5 w-5" />
									<h3 className="text-lg font-semibold">Token Image</h3>
								</div>

								<FormField
									control={form.control}
									name="image"
									render={({ field }) => (
										<FormItem>
											<FormLabel className="text-base font-medium">
												Upload Image
											</FormLabel>
											<FormControl>
												<div className="space-y-4">
													{/* Image Preview */}
													{imagePreview && (
														<div className="relative inline-block">
															<img
																src={imagePreview}
																alt="Token preview"
																className="w-48 h-48 object-cover rounded-lg border-2 border-border shadow-md"
															/>
															<Button
																type="button"
																variant="destructive"
																size="sm"
																className="absolute -top-2 -right-2 rounded-full w-8 h-8 p-0"
																onClick={removeImage}
															>
																<X className="h-4 w-4" />
															</Button>
														</div>
													)}

													{/* Upload Area */}
													<div
														className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
															isDragging
																? "border-primary bg-primary/5"
																: "border-muted-foreground/25 hover:border-muted-foreground/50"
														} ${imagePreview ? "mt-4" : ""}`}
														onDrop={handleDrop}
														onDragOver={handleDragOver}
														onDragLeave={handleDragLeave}
													>
														{isImageUploading ? (
															<div className="flex flex-col items-center space-y-2">
																<Loader2 className="h-8 w-8 animate-spin text-primary" />
																<p className="text-sm text-muted-foreground">
																	Uploading image...
																</p>
															</div>
														) : (
															<div className="flex flex-col items-center space-y-4">
																<div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
																	<Upload className="h-8 w-8 text-muted-foreground" />
																</div>
																<div className="space-y-2">
																	<h4 className="text-lg font-medium">
																		{imagePreview
																			? "Replace Image"
																			: "Upload Token Image"}
																	</h4>
																	<p className="text-sm text-muted-foreground">
																		Drag & drop or click to browse
																	</p>
																	<p className="text-xs text-muted-foreground">
																		Recommended: 1000x1000px • Max 5MB • JPG,
																		PNG, WEBP, GIF
																	</p>
																</div>
																<Button
																	type="button"
																	variant="outline"
																	className="mt-4"
																>
																	Select Image
																</Button>
															</div>
														)}

														<Input
															type="file"
															accept="image/jpeg,image/png,image/webp,image/gif"
															onChange={handleFileInputChange}
															className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
															disabled={isImageUploading}
														/>
													</div>
												</div>
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>
							</div>

							<Separator />

							{/* Advanced Settings Section */}
							<div className="space-y-6">
								<div className="flex items-center gap-2 mb-4">
									<AlertCircle className="h-5 w-5" />
									<h3 className="text-lg font-semibold">Advanced Settings</h3>
								</div>

								<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
									<FormField
										control={form.control}
										name="sellerFeeBasisPoints"
										render={({ field }) => (
											<FormItem>
												<FormLabel className="text-base font-medium">
													Royalty Fee (Basis Points)
												</FormLabel>
												<FormControl>
													<Input
														type="number"
														placeholder="e.g., 500 for 5%"
														className="h-12"
														{...field}
														onChange={(e) =>
															field.onChange(
																e.target.value
																	? Number(e.target.value)
																	: undefined,
															)
														}
													/>
												</FormControl>
												<FormDescription>
													Royalty percentage in basis points (100 = 1%)
												</FormDescription>
												<FormMessage />
											</FormItem>
										)}
									/>

									<div className="space-y-4">
										<FormField
											control={form.control}
											name="isMutable"
											render={({ field }) => (
												<FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-4">
													<FormControl>
														<Checkbox
															checked={field.value}
															onCheckedChange={field.onChange}
														/>
													</FormControl>
													<div className="space-y-1 leading-none">
														<FormLabel className="text-base font-medium">
															Mutable Metadata
														</FormLabel>
														<FormDescription>
															Allow future metadata updates
														</FormDescription>
													</div>
												</FormItem>
											)}
										/>

										<FormField
											control={form.control}
											name="primarySaleHappened"
											render={({ field }) => (
												<FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-4">
													<FormControl>
														<Checkbox
															checked={field.value}
															onCheckedChange={field.onChange}
														/>
													</FormControl>
													<div className="space-y-1 leading-none">
														<FormLabel className="text-base font-medium">
															Primary Sale Completed
														</FormLabel>
														<FormDescription>
															Mark if initial sale has occurred
														</FormDescription>
													</div>
												</FormItem>
											)}
										/>
									</div>
								</div>

								<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
									<FormField
										control={form.control}
										name="mintAuthority"
										render={({ field }) => (
											<FormItem>
												<FormLabel className="text-base font-medium">
													New Mint Authority
												</FormLabel>
												<FormControl>
													<Input
														placeholder="Enter public key or leave empty"
														className="h-12"
														{...field}
													/>
												</FormControl>
												<FormDescription>
													Transfer mint authority to another address
												</FormDescription>
												<FormMessage />
											</FormItem>
										)}
									/>

									<FormField
										control={form.control}
										name="updateAuthority"
										render={({ field }) => (
											<FormItem>
												<FormLabel className="text-base font-medium">
													New Update Authority
												</FormLabel>
												<FormControl>
													<Input
														placeholder="Enter public key or leave empty"
														className="h-12"
														{...field}
													/>
												</FormControl>
												<FormDescription>
													Transfer update authority to another address
												</FormDescription>
												<FormMessage />
											</FormItem>
										)}
									/>
								</div>
							</div>

							{/* Form Errors */}
							{form.formState.errors.root && (
								<div className="flex items-center gap-2 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
									<AlertCircle className="h-5 w-5 text-destructive" />
									<p className="text-sm text-destructive">
										{form.formState.errors.root.message}
									</p>
								</div>
							)}

							{/* Submit Button */}
							<div className="flex flex-col sm:flex-row gap-4 pt-6">
								<Button
									type="submit"
									disabled={form.formState.isSubmitting || isImageUploading}
									className="flex-1 h-12 text-base"
									size="lg"
								>
									{form.formState.isSubmitting ? (
										<>
											<Loader2 className="mr-2 h-4 w-4 animate-spin" />
											Updating Token...
										</>
									) : (
										<>
											<Edit3 className="mr-2 h-4 w-4" />
											Update Token Metadata
										</>
									)}
								</Button>

								<Button
									type="button"
									variant="outline"
									onClick={() => {
										form.reset();
										setImagePreview(null);
										setUploadedImageUrl(null);
									}}
									className="sm:w-auto h-12"
									disabled={form.formState.isSubmitting}
								>
									Reset Form
								</Button>
							</div>
						</form>
					</Form>
				</CardContent>
			</Card>

			{/* Success Modal */}
			{signature && (
				<Dialog open={!!signature} onOpenChange={() => setSignature(null)}>
					<DialogContent className="sm:max-w-md">
						<DialogHeader>
							<DialogTitle className="flex items-center gap-2">
								<CheckCircle2 className="h-5 w-5 text-green-600" />
								Update Successful!
							</DialogTitle>
						</DialogHeader>
						<div className="space-y-4">
							<p className="text-sm text-muted-foreground">
								Your token metadata has been successfully updated on the Solana
								blockchain.
							</p>
							<div className="p-4 bg-muted rounded-lg">
								<p className="text-sm font-medium mb-2">
									Transaction Signature:
								</p>
								<code className="text-xs break-all bg-background p-2 rounded border">
									{signature}
								</code>
							</div>
							<div className="flex gap-2">
								<Button
									variant="outline"
									size="sm"
									onClick={() => {
										navigator.clipboard.writeText(signature);
									}}
									className="flex-1"
								>
									Copy Signature
								</Button>
								<Button
									variant="outline"
									size="sm"
									onClick={() => {
										window.open(
											`https://explorer.solana.com/tx/${signature}`,
											"_blank",
										);
									}}
									className="flex-1"
								>
									View on Explorer
								</Button>
							</div>
						</div>
						<DialogFooter>
							<Button onClick={() => setSignature(null)} className="w-full">
								Close
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			)}
		</div>
	);
};

export default UpdateToken;

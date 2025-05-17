"use client";
import { uploadImageToCloudflareR2 } from "@/lib/s3-bucket";
import { updateTokenMetadata } from "@/lib/token/update-token";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { Dialog, DialogContent, DialogFooter, DialogTitle } from "../ui/dialog";
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
	// URL returned from R2 upload
	const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
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
		const imageUrl = uploadedImageUrl;
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
		} catch (err: any) {
			form.setError("mintAddress", {
				type: "manual",
				message: err.message || "Update failed",
			});
		}
	};

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
		<div className="font-mono flex flex-col gap-6">
			<Card className="max-w-3xl w-full mx-auto">
				<CardHeader>
					<CardTitle>Update Token Metadata</CardTitle>
					<CardDescription>
						Update on-chain & off-chain metadata for your Solana token.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<Form {...form}>
						<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
							<FormField
								control={form.control}
								name="mintAddress"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Mint Address</FormLabel>
										<FormControl>
											<Input placeholder="Token mint address" {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name="name"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Name</FormLabel>
										<FormControl>
											<Input placeholder="New name" {...field} />
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
										<FormLabel>Symbol</FormLabel>
										<FormControl>
											<Input placeholder="New symbol" {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name="uri"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Metadata URI</FormLabel>
										<FormControl>
											<Input placeholder="https://..." {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
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
													onChange={handleImageChange}
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
							<FormField
								control={form.control}
								name="sellerFeeBasisPoints"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Seller Fee Basis Points</FormLabel>
										<FormControl>
											<Input type="number" {...field} />
										</FormControl>
										<FormDescription>e.g. 500 for 5%</FormDescription>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name="mintAuthority"
								render={({ field }) => (
									<FormItem>
										<FormLabel>New Mint Authority</FormLabel>
										<FormControl>
											<Input placeholder="Public key" {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name="updateAuthority"
								render={({ field }) => (
									<FormItem>
										<FormLabel>New Update Authority</FormLabel>
										<FormControl>
											<Input placeholder="Public key" {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name="isMutable"
								render={({ field }) => (
									<FormItem className="flex items-center space-x-2">
										<FormControl>
											<Checkbox
												checked={field.value}
												onCheckedChange={field.onChange}
											/>
										</FormControl>
										<FormLabel>Mutable</FormLabel>
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name="primarySaleHappened"
								render={({ field }) => (
									<FormItem className="flex items-center space-x-2">
										<FormControl>
											<Checkbox
												checked={field.value}
												onCheckedChange={field.onChange}
											/>
										</FormControl>
										<FormLabel>Primary Sale Happened</FormLabel>
									</FormItem>
								)}
							/>
							<Button
								type="submit"
								disabled={form.formState.isSubmitting}
								className="w-full md:w-auto"
							>
								{form.formState.isSubmitting ? "Updating..." : "Update Token"}
							</Button>
						</form>
					</Form>
				</CardContent>
			</Card>
			{signature && (
				<Dialog open={!!signature} onOpenChange={() => setSignature(null)}>
					<DialogContent className="space-y-4">
						<DialogTitle className="text-lg font-semibold">
							Transaction Complete!
						</DialogTitle>
						<div className="text-green-800">
							Transaction signature: <code>{signature}</code>
						</div>
						<DialogFooter>
							<Button onClick={() => setSignature(null)}>Close</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			)}
		</div>
	);
};

export default UpdateToken;

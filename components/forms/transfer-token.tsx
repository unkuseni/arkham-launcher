"use client";
import {
	type AssetToSend,
	type AssetTransferDetail,
	type RecipientInfo,
	type SourceInfo,
	type TransferError,
	type TransferManyAssetsToManyRecipientsParams,
	type TransferManyAssetsToSingleRecipientParams,
	type TransferManyToOneParams,
	type TransferOneToManyParams,
	type TransferParams,
	type TransferResult,
	transferAsset,
	transferManyAssetsToManyRecipients,
	transferManyAssetsToSingleRecipient,
	transferOneAssetManyToOne,
	transferOneAssetToMany,
} from "@/lib/token/transfer-token";
import useUmiStore, { ConnectionStatus, Network } from "@/store/useUmiStore";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import { Badge } from "../ui/badge";
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
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "../ui/form";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "../ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Textarea } from "../ui/textarea";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "../ui/tooltip";

const SOL_MINT_ADDRESS = "So11111111111111111111111111111111111111112"; // Wrapped SOL mint
const NATIVE_SOL_ADDRESS = "11111111111111111111111111111111";

// Icons
const PlusIcon = () => (
	<svg
		width="16"
		height="16"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
	>
		<title>Add</title>
		<line x1="12" y1="5" x2="12" y2="19" />
		<line x1="5" y1="12" x2="19" y2="12" />
	</svg>
);

const TrashIcon = () => (
	<svg
		width="16"
		height="16"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
	>
		<title>Delete</title>
		<polyline points="3,6 5,6 21,6" />
		<path d="m19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2" />
	</svg>
);

const SendIcon = () => (
	<svg
		width="16"
		height="16"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
	>
		<title>Send</title>
		<line x1="22" y1="2" x2="11" y2="13" />
		<polygon points="22,2 15,22 11,13 2,9 22,2" />
	</svg>
);

const UsersIcon = () => (
	<svg
		width="16"
		height="16"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
	>
		<title>Users</title>
		<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
		<circle cx="9" cy="7" r="4" />
		<path d="m22 21v-2a4 4 0 0 0-3-3.87" />
		<path d="m16 3.13a4 4 0 0 1 0 7.75" />
	</svg>
);

const ArrowRightLeftIcon = () => (
	<svg
		width="16"
		height="16"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
	>
		<title>Transfer</title>
		<path d="m16 3 4 4-4 4" />
		<path d="M20 7H4" />
		<path d="m8 21-4-4 4-4" />
		<path d="M4 17h16" />
	</svg>
);

const PackageIcon = () => (
	<svg
		width="16"
		height="16"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
	>
		<title>Package</title>
		<path d="m7.5 4.27 9 5.15" />
		<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
		<path d="m3.3 7 8.7 5 8.7-5" />
		<path d="M12 22V12" />
	</svg>
);

// Types for the different transfer patterns
// Enhanced Transfer Types and Schemas
const prioritySchema = z.enum(["low", "medium", "high"]);

const singleTransferSchema = z.object({
	mint: z.string().min(32, "Invalid mint address"),
	amount: z.number().min(0.000001, "Amount must be greater than 0"),
	recipient: z.string().min(32, "Invalid recipient address"),
	priority: prioritySchema.optional(),
	computeUnitPrice: z.number().optional(),
});

const oneToManySchema = z.object({
	mint: z.string().min(32, "Invalid mint address"),
	recipients: z
		.array(
			z.object({
				address: z.string().min(32, "Invalid recipient address"),
				amount: z.number().min(0.000001, "Amount must be greater than 0"),
			}),
		)
		.min(1, "At least one recipient required"),
	priority: prioritySchema.optional(),
	batchSize: z.number().min(1).max(10).optional(),
});

const manyToOneSchema = z.object({
	mint: z.string().min(32, "Invalid mint address"),
	sources: z
		.array(
			z.object({
				signer: z.any(), // Will be filled with actual signer
				amount: z.number().min(0.000001, "Amount must be greater than 0"),
			}),
		)
		.min(1, "At least one source required"),
	destination: z.string().min(32, "Invalid destination address"),
	priority: prioritySchema.optional(),
	batchSize: z.number().min(1).max(10).optional(),
});

const manyAssetsToManySchema = z.object({
	transfers: z
		.array(
			z.object({
				mint: z.string().min(32, "Invalid mint address"),
				recipient: z.string().min(32, "Invalid recipient address"),
				amount: z.number().min(0.000001, "Amount must be greater than 0"),
			}),
		)
		.min(1, "At least one transfer required"),
	priority: prioritySchema.optional(),
	batchSize: z.number().min(1).max(10).optional(),
});

const manyAssetsToSingleSchema = z.object({
	assets: z
		.array(
			z.object({
				mint: z.string().min(32, "Invalid mint address"),
				amount: z.number().min(0.000001, "Amount must be greater than 0"),
			}),
		)
		.min(1, "At least one asset required"),
	recipient: z.string().min(32, "Invalid recipient address"),
	priority: prioritySchema.optional(),
	batchSize: z.number().min(1).max(10).optional(),
});

type SingleTransferForm = z.infer<typeof singleTransferSchema>;
type OneToManyForm = z.infer<typeof oneToManySchema>;
type ManyToOneForm = z.infer<typeof manyToOneSchema>;
type ManyAssetsToManyForm = z.infer<typeof manyAssetsToManySchema>;
type ManyAssetsToSingleForm = z.infer<typeof manyAssetsToSingleSchema>;

// Enhanced Transfer Component
const EnhancedTransferComponent = () => {
	const [transferMode, setTransferMode] = useState<TransferMode>("single");
	const [isLoading, setIsLoading] = useState(false);
	const [results, setResults] = useState<
		Array<{
			success: boolean;
			signature?: string;
			error?: string;
			timestamp: Date;
		}>
	>([]);
	const [tokens, setTokens] = useState<RawBalance[]>([]);

	const { umi, signer, connectionStatus, network, getTokenBalances } =
		useUmiStore();

	// Fetch token balances
	useEffect(() => {
		const loadTokensWithSol = async () => {
			if (!signer || !umi || connectionStatus !== ConnectionStatus.CONNECTED) {
				setTokens([]);
				return;
			}

			try {
				// Get SPL token balances
				const splTokens = await getTokenBalances();

				// Get SOL balance using UMI
				const solBalanceResult = await umi.rpc.getBalance(signer.publicKey);
				const solBalance = Number(solBalanceResult.basisPoints);

				// Create SOL token entry
				const solToken: RawBalance = {
					mint: SOL_MINT_ADDRESS,
					amount: BigInt(solBalance),
					decimals: 9,
					symbol: "SOL",
					name: "Solana",
				};

				// Combine SOL with other tokens
				const allTokens = [solToken, ...splTokens];
				setTokens(allTokens);
			} catch (err) {
				console.error("Failed to load token balances:", err);
				setTokens([]);
			}
		};

		loadTokensWithSol();
	}, [signer, connectionStatus, getTokenBalances, umi]);

	const addResult = (result: TransferResult<string | string[]>) => {
		setResults((prev) => [
			{
				success: result.success,
				signature: result.success
					? Array.isArray(result.data)
						? result.data[0]
						: result.data
					: undefined,
				error: !result.success ? result.error : undefined,
				timestamp: new Date(),
			},
			...prev.slice(0, 9),
		]); // Keep last 10 results
	};

	const clearResults = () => setResults([]);

	const getExplorerUrl = (signature: string) => {
		let url = `https://explorer.solana.com/tx/${signature}`;
		if (network && network !== Network.CUSTOM) {
			url += `?cluster=${network}`;
		}
		return url;
	};

	if (!signer) {
		return (
			<Card>
				<CardContent className="flex flex-col items-center justify-center p-8 space-y-4">
					<Badge
						variant="outline"
						className="px-3 py-1 text-yellow-600 border-yellow-600"
					>
						No Wallet Connected
					</Badge>
					<p className="text-center text-muted-foreground">
						Please connect your wallet to use enhanced transfer features.
					</p>
				</CardContent>
			</Card>
		);
	}

	return (
		<div className="space-y-6">
			{/* Transfer Mode Selection */}
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<PackageIcon />
						Transfer Mode Selection
					</CardTitle>
					<CardDescription>
						Choose the type of transfer pattern you want to execute
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
						{[
							{
								id: "single",
								title: "Single Transfer",
								desc: "Transfer one token to one recipient",
								icon: <SendIcon />,
							},
							{
								id: "one-to-many",
								title: "One to Many",
								desc: "Transfer one token to multiple recipients",
								icon: <UsersIcon />,
							},
							{
								id: "many-to-one",
								title: "Many to One",
								desc: "Transfer multiple tokens to one recipient",
								icon: <ArrowRightLeftIcon />,
							},
							{
								id: "many-assets-single",
								title: "Multiple Assets → Single",
								desc: "Transfer various tokens to one recipient",
								icon: <PackageIcon />,
							},
							{
								id: "many-assets-many",
								title: "Multiple Assets → Multiple",
								desc: "Transfer various tokens to various recipients",
								icon: <UsersIcon />,
							},
						].map((mode) => (
							<Card
								key={mode.id}
								className={`cursor-pointer transition-all duration-200 hover:shadow-md ${
									transferMode === mode.id
										? "ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-950/20"
										: ""
								}`}
								onClick={() => setTransferMode(mode.id as TransferMode)}
							>
								<CardContent className="p-4">
									<div className="flex items-start gap-3">
										<div className="mt-1">{mode.icon}</div>
										<div>
											<h3 className="font-medium text-sm">{mode.title}</h3>
											<p className="text-xs text-muted-foreground mt-1">
												{mode.desc}
											</p>
										</div>
									</div>
								</CardContent>
							</Card>
						))}
					</div>
				</CardContent>
			</Card>

			{/* Transfer Forms */}
			{transferMode === "single" && (
				<SingleTransferForm tokens={tokens} onResult={addResult} />
			)}
			{transferMode === "one-to-many" && (
				<OneToManyTransferForm tokens={tokens} onResult={addResult} />
			)}
			{transferMode === "many-to-one" && (
				<ManyToOneTransferForm tokens={tokens} onResult={addResult} />
			)}
			{transferMode === "many-assets-single" && (
				<ManyAssetsToSingleForm tokens={tokens} onResult={addResult} />
			)}
			{transferMode === "many-assets-many" && (
				<ManyAssetsToManyForm tokens={tokens} onResult={addResult} />
			)}

			{/* Results Display */}
			{results.length > 0 && (
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center justify-between">
							<span>Transaction Results</span>
							<Button variant="outline" size="sm" onClick={clearResults}>
								Clear History
							</Button>
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="space-y-3">
							{results.map((result, index) => (
								<div
									key={`${result.timestamp.getTime()}-${index}`}
									className={`p-3 rounded-lg border ${
										result.success
											? "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-900/20"
											: "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-900/20"
									}`}
								>
									<div className="flex items-center justify-between">
										<div className="flex items-center gap-2">
											<Badge
												variant={result.success ? "default" : "destructive"}
											>
												{result.success ? "Success" : "Failed"}
											</Badge>
											<span className="text-xs text-muted-foreground">
												{result.timestamp.toLocaleTimeString()}
											</span>
										</div>
										{result.signature && (
											<a
												href={getExplorerUrl(result.signature)}
												target="_blank"
												rel="noopener noreferrer"
												className="text-xs text-blue-600 hover:underline"
											>
												View on Explorer
											</a>
										)}
									</div>
									{result.error && (
										<p className="text-xs text-red-600 mt-1">{result.error}</p>
									)}
								</div>
							))}
						</div>
					</CardContent>
				</Card>
			)}
		</div>
	);
};

// Individual Transfer Form Components

// Single Transfer Form
const SingleTransferForm = ({
	tokens,
	onResult,
}: {
	tokens: RawBalance[];
	onResult: (result: TransferResult<string>) => void;
}) => {
	const { umi } = useUmiStore();
	const [isSubmitting, setIsSubmitting] = useState(false);

	const form = useForm<SingleTransferForm>({
		resolver: zodResolver(singleTransferSchema),
		defaultValues: {
			mint: "",
			amount: 0,
			recipient: "",
			priority: "medium",
		},
	});

	const onSubmit = async (values: SingleTransferForm) => {
		if (!umi) return;

		setIsSubmitting(true);
		try {
			const result = await transferAsset(values, umi);
			onResult(result);
			if (result.success) {
				form.reset();
			}
		} catch (error) {
			onResult({
				success: false,
				error: error instanceof Error ? error.message : String(error),
			});
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<SendIcon />
					Single Token Transfer
				</CardTitle>
				<CardDescription>
					Transfer a single token to one recipient with enhanced validation and
					retry logic
				</CardDescription>
			</CardHeader>
			<CardContent>
				<Form {...form}>
					<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<FormField
								control={form.control}
								name="mint"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Token</FormLabel>
										<FormControl>
											<Select
												value={field.value}
												onValueChange={field.onChange}
											>
												<SelectTrigger>
													<SelectValue placeholder="Select token" />
												</SelectTrigger>
												<SelectContent>
													{tokens.map((token) => (
														<SelectItem
															key={token.mint.toString()}
															value={token.mint.toString()}
														>
															<div className="flex items-center justify-between gap-3 w-full">
																<div className="flex items-center gap-1">
																	<span>{token.name || "Unknown"}</span>
																	<span>({token.symbol || "Unknown"})</span>
																</div>
																<span className="text-xs text-muted-foreground ml-2">
																	{(
																		Number(token.amount) /
																		10 ** token.decimals
																	).toLocaleString()}
																</span>
															</div>
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>

							<FormField
								control={form.control}
								name="amount"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Amount</FormLabel>
										<FormControl>
											<Input
												type="number"
												step="any"
												placeholder="0.00"
												{...field}
												onChange={(e) =>
													field.onChange(Number(e.target.value) || 0)
												}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>

						<FormField
							control={form.control}
							name="recipient"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Recipient Address</FormLabel>
									<FormControl>
										<Input placeholder="Solana wallet address" {...field} />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<FormField
								control={form.control}
								name="priority"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Priority Level</FormLabel>
										<FormControl>
											<Select
												value={field.value}
												onValueChange={field.onChange}
											>
												<SelectTrigger>
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="low">Low (Cheaper)</SelectItem>
													<SelectItem value="medium">
														Medium (Balanced)
													</SelectItem>
													<SelectItem value="high">High (Faster)</SelectItem>
												</SelectContent>
											</Select>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>

							<FormField
								control={form.control}
								name="computeUnitPrice"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Custom Compute Unit Price (Optional)</FormLabel>
										<FormControl>
											<Input
												type="number"
												placeholder="Auto"
												{...field}
												onChange={(e) =>
													field.onChange(Number(e.target.value) || undefined)
												}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>

						<Button type="submit" className="w-full" disabled={isSubmitting}>
							{isSubmitting ? "Processing..." : "Transfer Token"}
						</Button>
					</form>
				</Form>
			</CardContent>
		</Card>
	);
};

// One to Many Transfer Form
const OneToManyTransferForm = ({
	tokens,
	onResult,
}: {
	tokens: RawBalance[];
	onResult: (result: TransferResult<string[]>) => void;
}) => {
	const { umi } = useUmiStore();
	const [isSubmitting, setIsSubmitting] = useState(false);

	const form = useForm<OneToManyForm>({
		resolver: zodResolver(oneToManySchema),
		defaultValues: {
			mint: "",
			recipients: [{ address: "", amount: 0 }],
			priority: "medium",
			batchSize: 5,
		},
	});

	const { fields, append, remove } = useFieldArray({
		control: form.control,
		name: "recipients",
	});

	const onSubmit = async (values: OneToManyForm) => {
		if (!umi) return;

		setIsSubmitting(true);
		try {
			const result = await transferOneAssetToMany(values, umi);
			onResult(result);
			if (result.success) {
				form.reset();
			}
		} catch (error) {
			onResult({
				success: false,
				error: error instanceof Error ? error.message : String(error),
			});
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<UsersIcon />
					One Token to Many Recipients
				</CardTitle>
				<CardDescription>
					Transfer the same token to multiple recipients with batch processing
				</CardDescription>
			</CardHeader>
			<CardContent>
				<Form {...form}>
					<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
						<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
							<FormField
								control={form.control}
								name="mint"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Token</FormLabel>
										<FormControl>
											<Select
												value={field.value}
												onValueChange={field.onChange}
											>
												<SelectTrigger>
													<SelectValue placeholder="Select token" />
												</SelectTrigger>
												<SelectContent>
													{tokens.map((token) => (
														<SelectItem
															key={token.mint.toString()}
															value={token.mint.toString()}
														>
															<div className="flex items-center gap-1">
																<span>{token.name || "Unknown"}</span>
																<span>({token.symbol || "Unknown"})</span>
																<span className="text-xs text-muted-foreground ml-2">
																	{(
																		Number(token.amount) /
																		10 ** token.decimals
																	).toLocaleString()}
																</span>
															</div>
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>

							<FormField
								control={form.control}
								name="priority"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Priority</FormLabel>
										<FormControl>
											<Select
												value={field.value}
												onValueChange={field.onChange}
											>
												<SelectTrigger>
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="low">Low</SelectItem>
													<SelectItem value="medium">Medium</SelectItem>
													<SelectItem value="high">High</SelectItem>
												</SelectContent>
											</Select>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>

							<FormField
								control={form.control}
								name="batchSize"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Batch Size</FormLabel>
										<FormControl>
											<Input
												type="number"
												min={1}
												max={10}
												{...field}
												onChange={(e) =>
													field.onChange(Number(e.target.value) || 5)
												}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>

						<div className="space-y-3">
							<div className="flex items-center justify-between">
								<Label className="text-sm font-medium">Recipients</Label>
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={() => append({ address: "", amount: 0 })}
								>
									<PlusIcon />
									Add Recipient
								</Button>
							</div>

							{fields.map((field, index) => (
								<div
									key={field.id}
									className="grid grid-cols-1 md:grid-cols-3 gap-2 p-3 border rounded-lg"
								>
									<FormField
										control={form.control}
										name={`recipients.${index}.address`}
										render={({ field }) => (
											<FormItem>
												<FormControl>
													<Input placeholder="Recipient address" {...field} />
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>

									<FormField
										control={form.control}
										name={`recipients.${index}.amount`}
										render={({ field }) => (
											<FormItem>
												<FormControl>
													<Input
														type="number"
														step="any"
														placeholder="Amount"
														{...field}
														onChange={(e) =>
															field.onChange(Number(e.target.value) || 0)
														}
													/>
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>

									<Button
										type="button"
										variant="outline"
										size="sm"
										onClick={() => remove(index)}
										disabled={fields.length === 1}
									>
										<TrashIcon />
									</Button>
								</div>
							))}
						</div>

						<Button type="submit" className="w-full" disabled={isSubmitting}>
							{isSubmitting
								? "Processing..."
								: "Transfer to Multiple Recipients"}
						</Button>
					</form>
				</Form>
			</CardContent>
		</Card>
	);
};

// Many to One Transfer Form
const ManyToOneTransferForm = ({
	tokens,
	onResult,
}: {
	tokens: RawBalance[];
	onResult: (result: TransferResult<string[]>) => void;
}) => {
	const { umi } = useUmiStore();
	const [isSubmitting, setIsSubmitting] = useState(false);

	const form = useForm<ManyToOneForm>({
		resolver: zodResolver(manyToOneSchema),
		defaultValues: {
			mint: "",
			sources: [{ signer: umi?.identity, amount: 0 }],
			destination: "",
			priority: "medium",
			batchSize: 5,
		},
	});

	const { fields, append, remove } = useFieldArray({
		control: form.control,
		name: "sources",
	});

	const onSubmit = async (values: ManyToOneForm) => {
		if (!umi) return;

		setIsSubmitting(true);
		try {
			// Transform form values to match backend interface
			const transformedValues: TransferManyToOneParams = {
				...values,
				sources: values.sources.map((source) => ({
					...source,
					signer: source.signer || umi.identity, // Ensure signer is always present
				})),
			};

			const result = await transferOneAssetManyToOne(transformedValues, umi);
			onResult(result);
			if (result.success) {
				form.reset();
			}
		} catch (error) {
			onResult({
				success: false,
				error: error instanceof Error ? error.message : String(error),
			});
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<ArrowRightLeftIcon />
					Many Sources to One Recipient
				</CardTitle>
				<CardDescription>
					Transfer from multiple sources to a single recipient (requires
					multiple signers)
				</CardDescription>
			</CardHeader>
			<CardContent>
				<Form {...form}>
					<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<FormField
								control={form.control}
								name="mint"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Token</FormLabel>
										<FormControl>
											<Select
												value={field.value}
												onValueChange={field.onChange}
											>
												<SelectTrigger>
													<SelectValue placeholder="Select token" />
												</SelectTrigger>
												<SelectContent>
													{tokens.map((token) => (
														<SelectItem
															key={token.mint.toString()}
															value={token.mint.toString()}
														>
															<div className="flex items-center gap-1">
																<span>{token.name || "Unknown"}</span>
																<span>({token.symbol || "Unknown"})</span>
																<span className="text-xs text-muted-foreground ml-2">
																	{(
																		Number(token.amount) /
																		10 ** token.decimals
																	).toLocaleString()}
																</span>
															</div>
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>

							<FormField
								control={form.control}
								name="destination"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Destination Address</FormLabel>
										<FormControl>
											<Input placeholder="Solana wallet address" {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>

						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<FormField
								control={form.control}
								name="priority"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Priority</FormLabel>
										<FormControl>
											<Select
												value={field.value}
												onValueChange={field.onChange}
											>
												<SelectTrigger>
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="low">Low</SelectItem>
													<SelectItem value="medium">Medium</SelectItem>
													<SelectItem value="high">High</SelectItem>
												</SelectContent>
											</Select>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>

							<FormField
								control={form.control}
								name="batchSize"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Batch Size</FormLabel>
										<FormControl>
											<Input
												type="number"
												min={1}
												max={10}
												{...field}
												onChange={(e) =>
													field.onChange(Number(e.target.value) || 5)
												}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>

						<div className="space-y-3">
							<div className="flex items-center justify-between">
								<Label className="text-sm font-medium">
									Sources (Note: Multiple signers required)
								</Label>
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={() => append({ signer: umi?.identity, amount: 0 })}
								>
									<PlusIcon />
									Add Source
								</Button>
							</div>

							{fields.map((field, index) => (
								<div
									key={field.id}
									className="grid grid-cols-1 md:grid-cols-2 gap-2 p-3 border rounded-lg"
								>
									<FormField
										control={form.control}
										name={`sources.${index}.amount`}
										render={({ field }) => (
											<FormItem>
												<FormControl>
													<Input
														type="number"
														step="any"
														placeholder="Amount"
														{...field}
														onChange={(e) =>
															field.onChange(Number(e.target.value) || 0)
														}
													/>
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>

									<Button
										type="button"
										variant="outline"
										size="sm"
										onClick={() => remove(index)}
										disabled={fields.length === 1}
									>
										<TrashIcon />
									</Button>
								</div>
							))}
						</div>

						<Alert>
							<AlertDescription>
								<strong>Note:</strong> This transfer pattern requires multiple
								signers. In a real implementation, each source would need to
								sign the transaction. This demo uses the current wallet as all
								signers.
							</AlertDescription>
						</Alert>

						<Button type="submit" className="w-full" disabled={isSubmitting}>
							{isSubmitting
								? "Processing..."
								: "Transfer from Multiple Sources"}
						</Button>
					</form>
				</Form>
			</CardContent>
		</Card>
	);
};
const Alert = ({
	children,
	variant = "default",
}: {
	children: React.ReactNode;
	variant?: "default" | "destructive" | "success";
}) => (
	<div
		className={`rounded-lg border p-4 ${
			variant === "destructive"
				? "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-900/20"
				: variant === "success"
					? "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-900/20"
					: "border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/20"
		}`}
	>
		{children}
	</div>
);

const AlertDescription = ({ children }: { children: React.ReactNode }) => (
	<div className="text-sm">{children}</div>
);

const TransferTokens = () => {
	return (
		<Tabs defaultValue="enhanced-transfer">
			<TabsList className="mx-auto">
				<TabsTrigger value="enhanced-transfer">Enhanced Transfer</TabsTrigger>
				<TabsTrigger value="legacy-transfer">Legacy Transfer</TabsTrigger>
			</TabsList>
			<TabsContent value="enhanced-transfer">
				<div className="font-mono flex flex-col gap-4 max-w-6xl mx-auto">
					<article className="mx-auto text-center">
						<h1 className="text-4xl font-bold py-2.5 px-4 capitalize font-inter">
							Enhanced SPL Token Transfer
						</h1>
						<p>
							Advanced transfer patterns with batching, retry logic, and
							performance optimizations.
						</p>
					</article>
					<EnhancedTransferComponent />
				</div>
			</TabsContent>
			<TabsContent value="legacy-transfer">
				<div className="font-mono flex flex-col gap-4 max-w-4xl mx-auto">
					<article className="mx-auto text-center">
						<h1 className="text-4xl font-bold py-2.5 px-4 capitalize font-inter">
							Transfer SPL Tokens
						</h1>
						<p>Transfer additional tokens to a specified account.</p>
					</article>
					<Card>
						<CardHeader>
							<CardTitle>Transfer Tokens</CardTitle>
							<CardDescription>
								Fill in the details below to transfer your SPL tokens to another
								wallet.
							</CardDescription>
						</CardHeader>
						<CardContent>
							<TransferTokenForm />
						</CardContent>
					</Card>
				</div>
			</TabsContent>
		</Tabs>
	);
};

type FormValues = z.infer<typeof formSchema>;

const formSchema = z.object({
	recipient: z.string().min(1, "Recipient is required"),
	amount: z.number().min(0, "Amount must be greater than 0"),
	token: z.object({
		mint: z.string().min(1, "Mint is required"),
		decimals: z.number().min(0, "Decimals must be greater than 0"),
	}),
});

type RawBalance = Awaited<
	ReturnType<typeof useUmiStore.prototype.getTokenBalances>
>[number];

const TransferTokenForm = () => {
	const { umi, signer, connectionStatus, network, getTokenBalances } =
		useUmiStore();
	const [tokens, setTokens] = useState<RawBalance[]>([]);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [txSignature, setTxSignature] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	const form = useForm<FormValues>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			token: { mint: "", decimals: 0 },
			amount: 0,
			recipient: "",
		},
	});

	// Fetch balances when component mounts or wallet connection changes
	// Fetch balances including SOL when component mounts or wallet connection changes
	useEffect(() => {
		const loadTokensWithSol = async () => {
			if (!signer || !umi || connectionStatus !== ConnectionStatus.CONNECTED) {
				setTokens([]);
				return;
			}

			try {
				// Get SPL token balances
				const splTokens = await getTokenBalances();

				// Get SOL balance using UMI
				const solBalanceResult = await umi.rpc.getBalance(signer.publicKey);
				const solBalance = Number(solBalanceResult.basisPoints);

				// Create SOL token entry
				const solToken: RawBalance = {
					mint: SOL_MINT_ADDRESS, // Type assertion for compatibility
					amount: BigInt(solBalance),
					decimals: 9,
					symbol: "SOL",
					name: "Solana",
				};

				// Combine SOL with other tokens, SOL first
				const allTokens = [solToken, ...splTokens];
				setTokens(allTokens);
			} catch (err) {
				console.error("Failed to load token balances:", err);
				setTokens([]);
			}
		};

		loadTokensWithSol();
	}, [getTokenBalances, signer, connectionStatus, umi]);

	const onSubmit = async (values: FormValues) => {
		if (!signer || !umi) {
			setError("Wallet not connected");
			return;
		}

		setIsSubmitting(true);
		setError(null);
		setTxSignature(null);

		// Inside the TransferTokenForm component's onSubmit function:

		try {
			// Calculate the amount in raw units (applying decimal places)
			const rawAmount = values.amount;

			// Add logging to debug the transaction process
			console.log("Sending transfer:", {
				mint: values.token.mint,
				amount: rawAmount,
				recipient: values.recipient,
			});

			const result = await transferAsset(
				{
					mint: values.token.mint,
					amount: rawAmount,
					recipient: values.recipient,
				},
				umi,
			);

			// Explicitly log the transaction result for debugging
			console.log("Transfer successful, data:", result.data);

			// Ensure we're getting a string value for txSignature
			setTxSignature(
				typeof result.data === "string" ? result.data : String(result.data),
			);

			// Reset form and refresh balances with a slight delay to ensure state updates
			setTimeout(() => {
				form.reset({
					token: { mint: "", decimals: 0 },
					amount: 0,
					recipient: "",
				});

				// Refresh token balances
				getTokenBalances()
					.then((updatedList) => {
						setTokens(updatedList);
						console.log("Token balances refreshed");
					})
					.catch((err) => console.error("Failed to refresh balances:", err));
			}, 500);
		} catch (err: unknown) {
			console.error("Transfer error details:", err);
			setError(err instanceof Error ? err.message : "Transaction failed");
		} finally {
			setIsSubmitting(false);
		}

		// Show wallet connection status
		if (connectionStatus === ConnectionStatus.CONNECTING) {
			return (
				<div className="flex justify-center p-6">Connecting wallet...</div>
			);
		}
	};

	if (!signer) {
		return (
			<div className="flex flex-col items-center justify-center p-6 space-y-4">
				<Badge
					variant="outline"
					className="px-3 py-1 text-yellow-600 border-yellow-600"
				>
					No Wallet Connected
				</Badge>
				<p className="text-center text-muted-foreground">
					Please connect your wallet to transfer tokens.
				</p>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			{/* Success message */}
			{txSignature &&
				(() => {
					let explorerUrl = `https://explorer.solana.com/tx/${txSignature}`;
					if (network && network !== Network.CUSTOM) {
						explorerUrl += `?cluster=${network}`;
					}
					return (
						<div className="p-4 mb-4 border border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-900 rounded-md">
							<p className="text-sm font-medium text-green-800 dark:text-green-400">
								Transaction successful!{" "}
								<a
									href={explorerUrl}
									target="_blank"
									rel="noopener noreferrer"
									className="underline hover:no-underline"
								>
									View on Solana Explorer
								</a>
							</p>
						</div>
					);
				})()}

			{/* Error message */}
			{error && (
				<div className="p-4 mb-4 border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-900 rounded-md">
					<p className="text-sm font-medium text-red-800 dark:text-red-400">
						Error: {error}
					</p>
				</div>
			)}

			<Form {...form}>
				<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
					<FormField
						control={form.control}
						name="token"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Token to send</FormLabel>
								<FormControl>
									<Select
										value={field.value.mint}
										onValueChange={(mint) => {
											const token = tokens.find(
												(t) => t.mint.toString() === mint,
											);
											if (token) {
												field.onChange({
													mint,
													decimals: token.decimals,
												});
											}
										}}
										disabled={isSubmitting || tokens.length === 0}
									>
										<SelectTrigger className="w-full">
											<SelectValue placeholder="Select a token" />
										</SelectTrigger>
										<SelectContent>
											<SelectGroup>
												{tokens.length === 0 ? (
													<SelectItem value="loading" disabled>
														No tokens found
													</SelectItem>
												) : (
													tokens.map((token) => {
														const mintAddress = token.mint.toString();
														const shortMint = `${mintAddress.slice(0, 4)}...${mintAddress.slice(-4)}`;
														const balance =
															Number(token.amount) / 10 ** token.decimals;

														return (
															<SelectItem
																key={mintAddress}
																value={mintAddress}
																className="flex items-center justify-between"
															>
																<div className="flex items-center gap-2">
																	<span>{token.name || "Unknown"}</span>
																	<span className="text-xs text-muted-foreground">
																		({token.symbol || "???"})
																	</span>
																</div>
																<TooltipProvider>
																	<Tooltip>
																		<TooltipTrigger asChild>
																			<span className="text-xs font-mono text-muted-foreground ml-2">
																				{shortMint}
																			</span>
																		</TooltipTrigger>
																		<TooltipContent>
																			<p className="font-mono text-xs">
																				{mintAddress}
																			</p>
																		</TooltipContent>
																	</Tooltip>
																</TooltipProvider>
																<span className="ml-auto font-medium">
																	{balance.toLocaleString()}
																</span>
															</SelectItem>
														);
													})
												)}
											</SelectGroup>
										</SelectContent>
									</Select>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>

					{/* Amount field */}
					<FormField
						control={form.control}
						name="amount"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Amount</FormLabel>
								<FormControl>
									<Input
										type="number"
										placeholder="Enter amount to send"
										{...field}
										onChange={(e) =>
											field.onChange(Number.parseFloat(e.target.value) || 0)
										}
										disabled={isSubmitting}
									/>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>

					{/* Recipient field */}
					<FormField
						control={form.control}
						name="recipient"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Recipient Address</FormLabel>
								<FormControl>
									<Input
										{...field}
										placeholder="Enter Solana wallet address"
										disabled={isSubmitting}
									/>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>

					<Button
						type="submit"
						className="w-full"
						disabled={isSubmitting || !form.formState.isValid}
					>
						{isSubmitting ? "Processing..." : "Send Tokens"}
					</Button>
				</form>
			</Form>
		</div>
	);
};

// Many Assets to Single Recipient Form
const ManyAssetsToSingleForm = ({
	tokens,
	onResult,
}: {
	tokens: RawBalance[];
	onResult: (result: TransferResult<string>) => void;
}) => {
	const { umi } = useUmiStore();
	const [isSubmitting, setIsSubmitting] = useState(false);

	const form = useForm<ManyAssetsToSingleForm>({
		resolver: zodResolver(manyAssetsToSingleSchema),
		defaultValues: {
			assets: [{ mint: "", amount: 0 }],
			recipient: "",
			priority: "medium",
			batchSize: 5,
		},
	});

	const { fields, append, remove } = useFieldArray({
		control: form.control,
		name: "assets",
	});

	const onSubmit = async (values: ManyAssetsToSingleForm) => {
		if (!umi) return;

		setIsSubmitting(true);
		try {
			const result = await transferManyAssetsToSingleRecipient(values, umi);
			onResult(result);
			if (result.success) {
				form.reset();
			}
		} catch (error) {
			onResult({
				success: false,
				error: error instanceof Error ? error.message : String(error),
			});
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<PackageIcon />
					Multiple Assets to Single Recipient
				</CardTitle>
				<CardDescription>
					Bundle multiple token transfers to a single recipient with optimized
					batching
				</CardDescription>
			</CardHeader>
			<CardContent>
				<Form {...form}>
					<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
						<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
							<FormField
								control={form.control}
								name="recipient"
								render={({ field }) => (
									<FormItem className="md:col-span-2">
										<FormLabel>Recipient Address</FormLabel>
										<FormControl>
											<Input placeholder="Solana wallet address" {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>

							<FormField
								control={form.control}
								name="priority"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Priority</FormLabel>
										<FormControl>
											<Select
												value={field.value}
												onValueChange={field.onChange}
											>
												<SelectTrigger>
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="low">Low</SelectItem>
													<SelectItem value="medium">Medium</SelectItem>
													<SelectItem value="high">High</SelectItem>
												</SelectContent>
											</Select>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>

						<div className="space-y-3">
							<div className="flex items-center justify-between">
								<Label className="text-sm font-medium">
									Assets to Transfer
								</Label>
								<div className="flex gap-2">
									<FormField
										control={form.control}
										name="batchSize"
										render={({ field }) => (
											<FormItem>
												<FormControl>
													<div className="flex items-center gap-2">
														<Label className="text-xs">Batch:</Label>
														<Input
															type="number"
															min={1}
															max={10}
															className="w-16 h-8"
															{...field}
															onChange={(e) =>
																field.onChange(Number(e.target.value) || 5)
															}
														/>
													</div>
												</FormControl>
											</FormItem>
										)}
									/>
									<Button
										type="button"
										variant="outline"
										size="sm"
										onClick={() => append({ mint: "", amount: 0 })}
									>
										<PlusIcon />
										Add Asset
									</Button>
								</div>
							</div>

							{fields.map((field, index) => (
								<div
									key={field.id}
									className="grid grid-cols-1 md:grid-cols-3 gap-2 p-3 border rounded-lg"
								>
									<FormField
										control={form.control}
										name={`assets.${index}.mint`}
										render={({ field }) => (
											<FormItem>
												<FormControl>
													<Select
														value={field.value}
														onValueChange={field.onChange}
													>
														<SelectTrigger>
															<SelectValue placeholder="Select token" />
														</SelectTrigger>
														<SelectContent>
															{tokens.map((token) => (
																<SelectItem
																	key={token.mint.toString()}
																	value={token.mint.toString()}
																>
																	<div className="flex justify-between w-full gap-3">
																		<div className="flex items-center gap-1">
																			<span>{token.name || "Unknown"}</span>
																			<span>({token.symbol || "Unknown"})</span>
																		</div>
																		<span className="text-xs text-muted-foreground">
																			{(
																				Number(token.amount) /
																				10 ** token.decimals
																			).toLocaleString()}
																		</span>
																	</div>
																</SelectItem>
															))}
														</SelectContent>
													</Select>
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>

									<FormField
										control={form.control}
										name={`assets.${index}.amount`}
										render={({ field }) => (
											<FormItem>
												<FormControl>
													<Input
														type="number"
														step="any"
														placeholder="Amount"
														{...field}
														onChange={(e) =>
															field.onChange(Number(e.target.value) || 0)
														}
													/>
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>

									<Button
										type="button"
										variant="outline"
										size="sm"
										onClick={() => remove(index)}
										disabled={fields.length === 1}
									>
										<TrashIcon />
									</Button>
								</div>
							))}
						</div>

						<Button type="submit" className="w-full" disabled={isSubmitting}>
							{isSubmitting ? "Processing..." : "Transfer Multiple Assets"}
						</Button>
					</form>
				</Form>
			</CardContent>
		</Card>
	);
};

// Many Assets to Many Recipients Form
const ManyAssetsToManyForm = ({
	tokens,
	onResult,
}: {
	tokens: RawBalance[];
	onResult: (result: TransferResult<string>) => void;
}) => {
	const { umi } = useUmiStore();
	const [isSubmitting, setIsSubmitting] = useState(false);

	const form = useForm<ManyAssetsToManyForm>({
		resolver: zodResolver(manyAssetsToManySchema),
		defaultValues: {
			transfers: [
				{
					mint: "",
					recipient: "",
					amount: 0,
				},
			],
			priority: "medium",
			batchSize: 3,
		},
	});

	const {
		fields: transferFields,
		append: appendTransfer,
		remove: removeTransfer,
	} = useFieldArray({
		control: form.control,
		name: "transfers",
	});

	const onSubmit = async (values: ManyAssetsToManyForm) => {
		if (!umi) return;

		setIsSubmitting(true);
		try {
			const result = await transferManyAssetsToManyRecipients(values, umi);
			onResult(result);
			if (result.success) {
				form.reset();
			}
		} catch (error) {
			onResult({
				success: false,
				error: error instanceof Error ? error.message : String(error),
			});
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<UsersIcon />
					Multiple Assets to Multiple Recipients
				</CardTitle>
				<CardDescription>
					Complex transfer matrix - distribute different tokens to different
					recipients
				</CardDescription>
			</CardHeader>
			<CardContent>
				<Form {...form}>
					<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<FormField
								control={form.control}
								name="priority"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Priority Level</FormLabel>
										<FormControl>
											<Select
												value={field.value}
												onValueChange={field.onChange}
											>
												<SelectTrigger>
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="low">Low (Cheaper)</SelectItem>
													<SelectItem value="medium">
														Medium (Balanced)
													</SelectItem>
													<SelectItem value="high">High (Faster)</SelectItem>
												</SelectContent>
											</Select>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>

							<FormField
								control={form.control}
								name="batchSize"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Batch Size</FormLabel>
										<FormControl>
											<Input
												type="number"
												min={1}
												max={10}
												{...field}
												onChange={(e) =>
													field.onChange(Number(e.target.value) || 3)
												}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>

						<div className="space-y-4">
							<div className="flex items-center justify-between">
								<Label className="text-sm font-medium">Transfer Details</Label>
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={() =>
										appendTransfer({ mint: "", recipient: "", amount: 0 })
									}
								>
									<PlusIcon />
									Add Transfer
								</Button>
							</div>

							{transferFields.map((transferField, transferIndex) => (
								<Card key={transferField.id} className="p-4">
									<div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
										<FormField
											control={form.control}
											name={`transfers.${transferIndex}.mint`}
											render={({ field }) => (
												<FormItem>
													<FormLabel>Token</FormLabel>
													<FormControl>
														<Select
															value={field.value}
															onValueChange={field.onChange}
														>
															<SelectTrigger>
																<SelectValue placeholder="Select token" />
															</SelectTrigger>
															<SelectContent>
																{tokens.map((token) => (
																	<SelectItem
																		key={token.mint.toString()}
																		value={token.mint.toString()}
																	>
																		<div className="flex items-center gap-1">
																			<span>{token.name || "Unknown"}</span>
																			<span>({token.symbol || "Unknown"})</span>
																			<span className="text-xs text-muted-foreground ml-2">
																				{(
																					Number(token.amount) /
																					10 ** token.decimals
																				).toLocaleString()}
																			</span>
																		</div>
																	</SelectItem>
																))}
															</SelectContent>
														</Select>
													</FormControl>
													<FormMessage />
												</FormItem>
											)}
										/>

										<FormField
											control={form.control}
											name={`transfers.${transferIndex}.recipient`}
											render={({ field }) => (
												<FormItem>
													<FormLabel>Recipient</FormLabel>
													<FormControl>
														<Input placeholder="Recipient address" {...field} />
													</FormControl>
													<FormMessage />
												</FormItem>
											)}
										/>

										<FormField
											control={form.control}
											name={`transfers.${transferIndex}.amount`}
											render={({ field }) => (
												<FormItem>
													<FormLabel>Amount</FormLabel>
													<FormControl>
														<Input
															type="number"
															step="any"
															placeholder="Amount"
															{...field}
															onChange={(e) =>
																field.onChange(Number(e.target.value) || 0)
															}
														/>
													</FormControl>
													<FormMessage />
												</FormItem>
											)}
										/>

										<Button
											type="button"
											variant="outline"
											size="sm"
											onClick={() => removeTransfer(transferIndex)}
											disabled={transferFields.length === 1}
										>
											<TrashIcon />
										</Button>
									</div>
								</Card>
							))}
						</div>

						<Button type="submit" className="w-full" disabled={isSubmitting}>
							{isSubmitting ? "Processing..." : "Execute Transfer Matrix"}
						</Button>
					</form>
				</Form>
			</CardContent>
		</Card>
	);
};

type TransferMode =
	| "single"
	| "one-to-many"
	| "many-to-one"
	| "many-assets-single"
	| "many-assets-many";

export default TransferTokens;

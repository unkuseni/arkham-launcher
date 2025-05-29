"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	type SwapParams,
	type SwapResult,
	swap,
} from "@/lib/liquidity/cpmm/swap";
import {
	type SwapBaseOutParams,
	swapBaseOut,
} from "@/lib/liquidity/cpmm/swap-base-out";
import useUmiStore, { ConnectionStatus } from "@/store/useUmiStore";
import { Network } from "@/store/useUmiStore";
import { zodResolver } from "@hookform/resolvers/zod";
import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import {
	AlertCircle,
	ArrowDown,
	ArrowLeftRight,
	ArrowUpDown,
	DollarSign,
	Droplets,
	RefreshCw,
	Settings2,
	TrendingUp,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Label } from "../ui/label";

const SOL_MINT_ADDRESS = "So11111111111111111111111111111111111111112";

// Form schema
const swapSchema = z
	.object({
		poolId: z.string().optional(),
		inputMint: z.string().min(1, "Input token is required"),
		outputMint: z.string().min(1, "Output token is required"),
		inputAmount: z.number().min(0.000001, "Amount must be greater than 0"),
		outputAmount: z.number().optional(),
		slippagePercent: z
			.number()
			.min(0.01)
			.max(100, "Slippage must be between 0.01% and 100%"),
		swapMode: z.enum(["exact_in", "exact_out"]),
		autoSelectPool: z.boolean(),
		computeBudgetUnits: z.number().min(100000).max(1400000),
		computeBudgetMicroLamports: z.number().min(1000).max(100000000),
	})
	.refine(
		(data) => {
			if (data.swapMode === "exact_out" && !data.outputAmount) {
				return false;
			}
			return true;
		},
		{
			message: "Output amount is required for exact output swaps",
			path: ["outputAmount"],
		},
	);

type SwapFormData = z.infer<typeof swapSchema>;

interface SwapTransactionResult {
	txId: string;
	poolId: string;
	inputAmount: BN;
	outputAmount: BN;
	inputMint: string;
	outputMint: string;
	tradeFee: BN;
	slippage: number;
	timestamp: number;
	explorerUrl: string;
}

interface TokenBalance {
	mint: string;
	amount: bigint;
	decimals: number;
	symbol: string;
	name: string;
	formattedAmount: string;
	uiAmount: number;
}

const LoadingSpinner = ({ className }: { className?: string }) => (
	<div
		className={`animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
	/>
);

const SwapToken = () => {
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [showAdvanced, setShowAdvanced] = useState(false);
	const [result, setResult] = useState<SwapTransactionResult | null>(null);
	const [availableTokens, setAvailableTokens] = useState<TokenBalance[]>([]);
	const [loadingTokens, setLoadingTokens] = useState(false);
	const [estimatedOutput, setEstimatedOutput] = useState<string>("");
	const [priceImpact, setPriceImpact] = useState<number | null>(null);
	const [activeTab, setActiveTab] = useState<"exact_in" | "exact_out">(
		"exact_in",
	);

	const {
		umi,
		connection,
		network,
		getTokenBalances,
		signer,
		connectionStatus,
	} = useUmiStore();
	const newConnection = connection();

	const form = useForm<SwapFormData>({
		resolver: zodResolver(swapSchema),
		defaultValues: {
			poolId: "",
			inputMint: "",
			outputMint: "",
			inputAmount: 0.1,
			outputAmount: undefined,
			slippagePercent: 0.5,
			swapMode: "exact_in",
			autoSelectPool: true,
			computeBudgetUnits: 600000,
			computeBudgetMicroLamports: 46591500,
		},
	});

	useEffect(() => {
		form.setValue("swapMode", activeTab);
	}, [activeTab, form]);

	// Watch form values for calculations
	const watchedValues = form.watch();

	useEffect(() => {
		const loadTokenBalances = async () => {
			if (!signer || connectionStatus !== ConnectionStatus.CONNECTED) {
				setAvailableTokens([]);
				return;
			}

			setLoadingTokens(true);
			try {
				const balances = await getTokenBalances();
				const solBalanceResult = await umi.rpc.getBalance(signer.publicKey);
				const solBalance = Number(solBalanceResult.basisPoints) / 1e9;

				const formattedTokens: TokenBalance[] = balances.map((token) => ({
					mint: token.mint.toString(),
					amount: token.amount,
					decimals: token.decimals,
					symbol: token.symbol,
					name: token.name,
					formattedAmount: (
						Number(token.amount) /
						10 ** token.decimals
					).toLocaleString(),
					uiAmount: Number(token.amount) / 10 ** token.decimals,
				}));

				setAvailableTokens([
					{
						mint: SOL_MINT_ADDRESS,
						amount: BigInt(solBalanceResult.basisPoints),
						decimals: 9,
						symbol: "SOL",
						name: "Solana",
						formattedAmount: solBalance.toLocaleString(undefined, {
							maximumFractionDigits: 9,
						}),
						uiAmount: solBalance,
					},
					...formattedTokens,
				]);
			} catch (error) {
				console.error("Failed to load token balances:", error);
				setAvailableTokens([]);
			} finally {
				setLoadingTokens(false);
			}
		};

		loadTokenBalances();
	}, [signer, connectionStatus, getTokenBalances, umi.rpc]);

	// Calculate estimates when relevant values change
	useEffect(() => {
		const calculateEstimates = () => {
			const { inputAmount, inputMint, outputMint, swapMode } = watchedValues;

			if (
				!inputAmount ||
				inputAmount <= 0 ||
				!inputMint ||
				!outputMint ||
				inputMint === outputMint
			) {
				setEstimatedOutput("");
				setPriceImpact(null);
				return;
			}

			// Simple estimation - in real implementation, you'd call the swap calculation
			// This is a placeholder that assumes 1:1 ratio for demonstration
			if (swapMode === "exact_in") {
				setEstimatedOutput(inputAmount.toString());
			}

			// Calculate price impact (placeholder)
			setPriceImpact(0.05); // 0.05% impact
		};

		calculateEstimates();
	}, [
		watchedValues.inputAmount,
		watchedValues.inputMint,
		watchedValues.outputMint,
		watchedValues.swapMode,
	]);

	const TokenSelector = ({
		label,
		placeholder,
		onValueChange,
		value,
		excludeMint,
		showBalance = true,
	}: {
		label: string;
		placeholder: string;
		onValueChange: (value: string) => void;
		value?: string;
		excludeMint?: string;
		showBalance?: boolean;
	}) => {
		const filteredTokens = availableTokens.filter(
			(token) => token.mint !== excludeMint,
		);
		const selectedToken = filteredTokens.find((token) => token.mint === value);

		return (
			<div className="space-y-3">
				<div className="flex items-center justify-between">
					<FormLabel>{label}</FormLabel>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						onClick={() => loadTokenBalances()}
						disabled={loadingTokens}
						className="h-auto p-1 text-xs"
					>
						<RefreshCw
							className={`h-3 w-3 mr-1 ${loadingTokens ? "animate-spin" : ""}`}
						/>
						Refresh
					</Button>
				</div>

				{signer && connectionStatus === ConnectionStatus.CONNECTED ? (
					<Select onValueChange={onValueChange} value={value}>
						<SelectTrigger className="w-full">
							<SelectValue
								placeholder={
									loadingTokens
										? "Loading tokens..."
										: filteredTokens.length === 0
											? "No tokens found"
											: placeholder
								}
							/>
						</SelectTrigger>
						<SelectContent>
							{filteredTokens.map((token) => (
								<SelectItem key={token.mint} value={token.mint}>
									<div className="flex items-center justify-between w-full">
										<div className="flex flex-col items-start">
											<span className="font-medium">{token.symbol}</span>
											<span className="text-xs text-muted-foreground truncate max-w-[200px]">
												{token.name}
											</span>
										</div>
										{showBalance && (
											<div className="flex flex-col items-end ml-4">
												<span className="text-sm font-mono">
													{token.formattedAmount}
												</span>
												<span className="text-xs text-muted-foreground">
													{token.mint.slice(0, 4)}...{token.mint.slice(-4)}
												</span>
											</div>
										)}
									</div>
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				) : (
					<div className="text-sm text-muted-foreground p-3 border rounded-md bg-muted/50">
						{!signer
							? "Connect your wallet to see available tokens"
							: "Connecting..."}
					</div>
				)}

				{selectedToken && showBalance && (
					<div className="text-xs text-muted-foreground">
						Available: {selectedToken.formattedAmount} {selectedToken.symbol}
					</div>
				)}
			</div>
		);
	};

	const loadTokenBalances = async () => {
		if (!signer || connectionStatus !== ConnectionStatus.CONNECTED) return;

		setLoadingTokens(true);
		try {
			const balances = await getTokenBalances();
			const solBalanceResult = await umi.rpc.getBalance(signer.publicKey);
			const solBalance = Number(solBalanceResult.basisPoints) / 1e9;

			const formattedTokens: TokenBalance[] = balances.map((token) => ({
				mint: token.mint.toString(),
				amount: token.amount,
				decimals: token.decimals,
				symbol: token.symbol,
				name: token.name,
				formattedAmount: (
					Number(token.amount) /
					10 ** token.decimals
				).toLocaleString(),
				uiAmount: Number(token.amount) / 10 ** token.decimals,
			}));

			setAvailableTokens([
				{
					mint: SOL_MINT_ADDRESS,
					amount: BigInt(solBalanceResult.basisPoints),
					decimals: 9,
					symbol: "SOL",
					name: "Solana",
					formattedAmount: solBalance.toLocaleString(undefined, {
						maximumFractionDigits: 9,
					}),
					uiAmount: solBalance,
				},
				...formattedTokens,
			]);
		} catch (error) {
			console.error("Failed to refresh token balances:", error);
		} finally {
			setLoadingTokens(false);
		}
	};

	const handleSubmit = async (data: SwapFormData) => {
		if (!umi || !newConnection || !umi.identity) {
			console.error("Wallet not connected");
			return;
		}

		setIsSubmitting(true);
		try {
			let swapResult: SwapResult;

			if (activeTab === "exact_in") {
				// Exact input swap logic...
				const inputToken = availableTokens.find(
					(t) => t.mint === data.inputMint,
				);
				const inputDecimals = inputToken?.decimals || 9;

				const params: SwapParams = {
					umi,
					connection: newConnection,
					network,
					signer: umi.identity,
					poolIdParam: data.poolId || undefined,
					inputAmountParam: new BN(
						Math.floor(data.inputAmount * 10 ** inputDecimals),
					),
					inputMintParam: new PublicKey(data.inputMint),
					slippageParam: data.slippagePercent / 100,
					baseInParam: undefined,
				};

				swapResult = await swap(params);
			} else {
				// Exact output swap logic...
				const outputToken = availableTokens.find(
					(t) => t.mint === data.outputMint,
				);
				const outputDecimals = outputToken?.decimals || 9;

				const params: SwapBaseOutParams = {
					umi,
					connection: newConnection,
					network,
					signer: umi.identity,
					poolIdParam: data.poolId || undefined,
					outputAmountParam: new BN(
						Math.floor((data.outputAmount || 0) * 10 ** outputDecimals),
					),
					outputMintParam: new PublicKey(data.outputMint),
					slippageParam: data.slippagePercent / 100,
					baseInParam: undefined,
				};

				swapResult = await swapBaseOut(params);
			}

			const explorerUrl =
				network === Network.MAINNET
					? `https://solscan.io/tx/${swapResult.txId}`
					: `https://solscan.io/tx/${swapResult.txId}?cluster=${network}`;

			setResult({
				...swapResult,
				timestamp: Date.now(),
				explorerUrl,
			});

			form.reset();
		} catch (error) {
			console.error("Failed to execute swap:", error);
		} finally {
			setIsSubmitting(false);
		}
	};

	const swapTokens = () => {
		const inputMint = form.getValues("inputMint");
		const outputMint = form.getValues("outputMint");

		form.setValue("inputMint", outputMint);
		form.setValue("outputMint", inputMint);
	};

	const setMaxAmount = () => {
		const inputMint = watchedValues.inputMint;
		const selectedToken = availableTokens.find(
			(token) => token.mint === inputMint,
		);

		if (selectedToken) {
			// Keep some buffer for fees (especially for SOL)
			const buffer = selectedToken.symbol === "SOL" ? 0.01 : 0;
			const maxAmount = Math.max(0, selectedToken.uiAmount - buffer);
			form.setValue("inputAmount", maxAmount);
		}
	};

	if (result) {
		return (
			<div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-secondary/10 relative overflow-hidden">
				<div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:60px_60px]" />
				<div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-blue-500/5 via-transparent to-purple-500/5" />

				<div className="container mx-auto px-4 py-12 max-w-4xl relative">
					<div className="text-center mb-8">
						<div className="inline-flex items-center justify-center w-24 h-24 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-600/10 mb-6">
							<div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg flex items-center justify-center">
								<ArrowLeftRight className="w-6 h-6 text-white" />
							</div>
						</div>
						<h1 className="text-4xl font-bold text-blue-600 mb-4">
							Swap Completed!
						</h1>
						<p className="text-lg text-muted-foreground">
							Your tokens have been successfully swapped
						</p>
					</div>

					<Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-800">
						<CardHeader className="text-center">
							<CardTitle className="text-blue-700 dark:text-blue-300">
								Transaction Details
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
								<div className="space-y-2">
									<Label className="text-sm font-medium text-muted-foreground">
										Pool ID
									</Label>
									<div className="p-3 bg-background rounded-lg border font-mono text-sm break-all">
										{result.poolId}
									</div>
								</div>
								<div className="space-y-2">
									<Label className="text-sm font-medium text-muted-foreground">
										Transaction ID
									</Label>
									<div className="p-3 bg-background rounded-lg border font-mono text-sm break-all">
										{result.txId}
									</div>
								</div>
								<div className="space-y-2">
									<Label className="text-sm font-medium text-muted-foreground">
										Input Amount
									</Label>
									<div className="p-3 bg-background rounded-lg border">
										{(Number(result.inputAmount) / 1e9).toFixed(9)} tokens
									</div>
								</div>
								<div className="space-y-2">
									<Label className="text-sm font-medium text-muted-foreground">
										Output Amount
									</Label>
									<div className="p-3 bg-background rounded-lg border">
										{(Number(result.outputAmount) / 1e9).toFixed(9)} tokens
									</div>
								</div>
								<div className="space-y-2">
									<Label className="text-sm font-medium text-muted-foreground">
										Trade Fee
									</Label>
									<div className="p-3 bg-background rounded-lg border">
										{(Number(result.tradeFee) / 1e9).toFixed(9)} tokens
									</div>
								</div>
								<div className="space-y-2">
									<Label className="text-sm font-medium text-muted-foreground">
										Network
									</Label>
									<div className="p-3 bg-background rounded-lg border">
										<Badge variant="outline">{network}</Badge>
									</div>
								</div>
							</div>

							<div className="flex flex-col sm:flex-row gap-3 pt-6">
								<Button
									onClick={() => window.open(result.explorerUrl, "_blank")}
									className="flex-1"
								>
									View on Solscan
								</Button>
								<Button
									variant="outline"
									onClick={() => setResult(null)}
									className="flex-1"
								>
									Make Another Swap
								</Button>
							</div>
						</CardContent>
					</Card>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-secondary/10 relative overflow-hidden">
			<div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:60px_60px]" />
			<div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-blue-500/5 via-transparent to-purple-500/5" />

			<div className="container mx-auto px-4 py-12 max-w-4xl relative">
				{/* Hero Section */}
				<article className="text-center mb-16">
					<div className="inline-flex items-center justify-center w-24 h-24 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-600/10 mb-8 relative">
						<div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg flex items-center justify-center">
							<ArrowLeftRight className="w-6 h-6 text-white" />
						</div>
						<div className="absolute inset-0 rounded-2xl bg-blue-500/5 animate-pulse" />
					</div>
					<h1 className="text-6xl md:text-7xl font-bold bg-gradient-to-r from-blue-500 via-purple-600 to-blue-500 bg-clip-text text-transparent mb-6 tracking-tight">
						Swap Tokens
					</h1>
					<p className="text-xl md:text-2xl text-muted-foreground mb-3 max-w-3xl mx-auto font-medium">
						Trade tokens instantly with minimal slippage
					</p>
					<p className="text-lg text-muted-foreground/80 max-w-2xl mx-auto">
						Swap between any supported tokens using CPMM pools
					</p>
				</article>
				{/* Main form with tabs */}
				<Card className="max-w-2xl mx-auto">
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<ArrowLeftRight className="w-5 h-5" />
							Swap Tokens
						</CardTitle>
						<CardDescription>
							Choose tokens and amounts to swap between
						</CardDescription>
					</CardHeader>
					<CardContent>
						<Tabs
							value={activeTab}
							onValueChange={(value) =>
								setActiveTab(value as "exact_in" | "exact_out")
							}
						>
							<TabsList className="grid w-full grid-cols-2 mb-6">
								<TabsTrigger
									value="exact_in"
									className="flex items-center gap-2"
								>
									<ArrowDown className="w-4 h-4" />
									Exact Input
								</TabsTrigger>
								<TabsTrigger
									value="exact_out"
									className="flex items-center gap-2"
								>
									<ArrowUpDown className="w-4 h-4" />
									Exact Output
								</TabsTrigger>
							</TabsList>

							<Form {...form}>
								<form
									onSubmit={form.handleSubmit(handleSubmit)}
									className="space-y-6"
								>
									<div className="space-y-4">
										<div className="flex items-center gap-4">
											<Badge variant="outline">Pool Selection</Badge>
										</div>

										<FormField
											control={form.control}
											name="poolId"
											render={({ field }) => (
												<FormItem>
													<FormLabel>Pool ID (Optional)</FormLabel>
													<FormControl>
														<Input
															placeholder="Enter specific pool ID to swap from..."
															{...field}
														/>
													</FormControl>
													<FormDescription>
														Leave empty to auto-select the best pool based on
														token pair
													</FormDescription>
													<FormMessage />
												</FormItem>
											)}
										/>

										<FormField
											control={form.control}
											name="autoSelectPool"
											render={({ field }) => (
												<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
													<div className="space-y-0.5">
														<FormLabel className="text-base">
															Auto-select Best Pool
														</FormLabel>
														<FormDescription>
															Automatically find the best pool for your token
															pair when no pool ID is specified
														</FormDescription>
													</div>
													<FormControl>
														<Checkbox
															checked={field.value}
															onCheckedChange={field.onChange}
														/>
													</FormControl>
												</FormItem>
											)}
										/>

										{!watchedValues.poolId && (
											<div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
												<div className="flex items-center gap-2 mb-1">
													<TrendingUp className="w-4 h-4 text-blue-600" />
													<span className="text-sm font-medium text-blue-700 dark:text-blue-300">
														Auto Pool Selection
													</span>
												</div>
												<p className="text-xs text-blue-600 dark:text-blue-400">
													The system will automatically find the{" "}
													{watchedValues.autoSelectPool
														? "best available"
														: "first available"}{" "}
													pool for your selected token pair
												</p>
											</div>
										)}
									</div>

									<Separator />

									<TabsContent value="exact_in" className="space-y-6 mt-0">
										{/* Token Selection - Same for both tabs */}
										<div className="space-y-4">
											<div className="flex items-center justify-between">
												<Badge variant="outline">Token Pair</Badge>
												<Button
													type="button"
													variant="ghost"
													size="sm"
													onClick={swapTokens}
													className="h-auto p-2"
												>
													<ArrowUpDown className="h-4 w-4" />
												</Button>
											</div>

											{/* From Token */}
											<div>
												<TokenSelector
													label="From"
													placeholder="Select token to swap from"
													onValueChange={(value) =>
														form.setValue("inputMint", value)
													}
													value={form.watch("inputMint")}
													excludeMint={form.watch("outputMint")}
												/>
												<FormField
													control={form.control}
													name="inputMint"
													render={({ field }) => (
														<FormItem className="mt-2">
															<FormControl>
																<Input
																	placeholder="Or enter token mint address..."
																	{...field}
																/>
															</FormControl>
															<FormMessage />
														</FormItem>
													)}
												/>
											</div>

											{/* To Token */}
											<div>
												<TokenSelector
													label="To"
													placeholder="Select token to swap to"
													onValueChange={(value) =>
														form.setValue("outputMint", value)
													}
													value={form.watch("outputMint")}
													excludeMint={form.watch("inputMint")}
													showBalance={false}
												/>
												<FormField
													control={form.control}
													name="outputMint"
													render={({ field }) => (
														<FormItem className="mt-2">
															<FormControl>
																<Input
																	placeholder="Or enter token mint address..."
																	{...field}
																/>
															</FormControl>
															<FormMessage />
														</FormItem>
													)}
												/>
											</div>

											{watchedValues.inputMint &&
												watchedValues.outputMint &&
												watchedValues.inputMint !==
													watchedValues.outputMint && (
													<div className="p-3 bg-muted/50 rounded-lg border">
														<div className="flex items-center gap-2 mb-2">
															<Droplets className="w-4 h-4 text-muted-foreground" />
															<span className="text-sm font-medium">
																Pool Information
															</span>
														</div>
														{watchedValues.poolId ? (
															<div className="space-y-1 text-xs text-muted-foreground">
																<div>
																	Pool ID: {watchedValues.poolId.slice(0, 8)}...
																	{watchedValues.poolId.slice(-8)}
																</div>
																<div>Using specified pool for swap</div>
															</div>
														) : (
															<div className="space-y-1 text-xs text-muted-foreground">
																<div>
																	Pool will be auto-selected based on token pair
																</div>
																<div>
																	Mode:{" "}
																	{watchedValues.autoSelectPool
																		? "Best pool by liquidity"
																		: "First available pool"}
																</div>
															</div>
														)}
													</div>
												)}
										</div>

										<Separator />

										{/* Exact Input Amount */}
										<div className="space-y-4">
											<Badge variant="outline">Amount to Swap</Badge>

											<FormField
												control={form.control}
												name="inputAmount"
												render={({ field }) => (
													<FormItem>
														<div className="flex items-center justify-between">
															<FormLabel>Input Amount</FormLabel>
															<Button
																type="button"
																variant="ghost"
																size="sm"
																onClick={setMaxAmount}
																className="h-auto p-1 text-xs"
																disabled={!watchedValues.inputMint}
															>
																MAX
															</Button>
														</div>
														<FormControl>
															<Input
																type="number"
																step="any"
																placeholder="0.0"
																{...field}
																onChange={(e) =>
																	field.onChange(Number(e.target.value))
																}
															/>
														</FormControl>
														<FormDescription>
															Exact amount to swap from your wallet
														</FormDescription>
														<FormMessage />
													</FormItem>
												)}
											/>

											{/* Estimated Output */}
											{estimatedOutput && (
												<div className="p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
													<div className="flex items-center gap-2 mb-2">
														<TrendingUp className="w-4 h-4 text-green-600" />
														<span className="text-sm font-medium text-green-700 dark:text-green-300">
															Estimated Output
														</span>
													</div>
													<p className="text-lg font-mono text-green-800 dark:text-green-200">
														{estimatedOutput}
													</p>
													{priceImpact !== null && (
														<p className="text-xs text-green-600 dark:text-green-400 mt-1">
															Price Impact: {priceImpact.toFixed(2)}%
														</p>
													)}
												</div>
											)}
										</div>
									</TabsContent>

									<TabsContent value="exact_out" className="space-y-6 mt-0">
										{/* Token Selection - Same as above, reuse the same component */}
										<div className="space-y-4">
											<div className="flex items-center justify-between">
												<Badge variant="outline">Token Pair</Badge>
												<Button
													type="button"
													variant="ghost"
													size="sm"
													onClick={swapTokens}
													className="h-auto p-2"
												>
													<ArrowUpDown className="h-4 w-4" />
												</Button>
											</div>

											{/* From Token */}
											<div>
												<TokenSelector
													label="From"
													placeholder="Select token to pay with"
													onValueChange={(value) =>
														form.setValue("inputMint", value)
													}
													value={form.watch("inputMint")}
													excludeMint={form.watch("outputMint")}
												/>
												<FormField
													control={form.control}
													name="inputMint"
													render={({ field }) => (
														<FormItem className="mt-2">
															<FormControl>
																<Input
																	placeholder="Or enter token mint address..."
																	{...field}
																/>
															</FormControl>
															<FormMessage />
														</FormItem>
													)}
												/>
											</div>

											{/* To Token */}
											<div>
												<TokenSelector
													label="To"
													placeholder="Select token to receive"
													onValueChange={(value) =>
														form.setValue("outputMint", value)
													}
													value={form.watch("outputMint")}
													excludeMint={form.watch("inputMint")}
													showBalance={false}
												/>
												<FormField
													control={form.control}
													name="outputMint"
													render={({ field }) => (
														<FormItem className="mt-2">
															<FormControl>
																<Input
																	placeholder="Or enter token mint address..."
																	{...field}
																/>
															</FormControl>
															<FormMessage />
														</FormItem>
													)}
												/>
											</div>

											{/* Pool Info Display - Same as exact_in */}
											{watchedValues.inputMint &&
												watchedValues.outputMint &&
												watchedValues.inputMint !==
													watchedValues.outputMint && (
													<div className="p-3 bg-muted/50 rounded-lg border">
														<div className="flex items-center gap-2 mb-2">
															<Droplets className="w-4 h-4 text-muted-foreground" />
															<span className="text-sm font-medium">
																Pool Information
															</span>
														</div>
														{watchedValues.poolId ? (
															<div className="space-y-1 text-xs text-muted-foreground">
																<div>
																	Pool ID: {watchedValues.poolId.slice(0, 8)}...
																	{watchedValues.poolId.slice(-8)}
																</div>
																<div>Using specified pool for swap</div>
															</div>
														) : (
															<div className="space-y-1 text-xs text-muted-foreground">
																<div>
																	Pool will be auto-selected based on token pair
																</div>
																<div>
																	Mode:{" "}
																	{watchedValues.autoSelectPool
																		? "Best pool by liquidity"
																		: "First available pool"}
																</div>
															</div>
														)}
													</div>
												)}
										</div>

										<Separator />

										{/* Exact Output Amount */}
										<div className="space-y-4">
											<Badge variant="outline">Amount to Receive</Badge>

											<FormField
												control={form.control}
												name="outputAmount"
												render={({ field }) => (
													<FormItem>
														<FormLabel>Output Amount</FormLabel>
														<FormControl>
															<Input
																type="number"
																step="any"
																placeholder="0.0"
																{...field}
																onChange={(e) =>
																	field.onChange(Number(e.target.value))
																}
															/>
														</FormControl>
														<FormDescription>
															Exact amount you want to receive
														</FormDescription>
														<FormMessage />
													</FormItem>
												)}
											/>

											<FormField
												control={form.control}
												name="inputAmount"
												render={({ field }) => (
													<FormItem>
														<FormLabel>Maximum Input</FormLabel>
														<FormControl>
															<Input
																type="number"
																step="any"
																placeholder="0.0"
																{...field}
																onChange={(e) =>
																	field.onChange(Number(e.target.value))
																}
															/>
														</FormControl>
														<FormDescription>
															Maximum amount you're willing to pay
														</FormDescription>
														<FormMessage />
													</FormItem>
												)}
											/>

											{/* Estimated Input */}
											<div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
												<div className="flex items-center gap-2 mb-2">
													<DollarSign className="w-4 h-4 text-blue-600" />
													<span className="text-sm font-medium text-blue-700 dark:text-blue-300">
														Estimated Input Required
													</span>
												</div>
												<p className="text-lg font-mono text-blue-800 dark:text-blue-200">
													{/* Calculate estimated input based on output */}
													Calculating...
												</p>
												{priceImpact !== null && (
													<p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
														Price Impact: {priceImpact.toFixed(2)}%
													</p>
												)}
											</div>
										</div>
									</TabsContent>

									{/* Common Settings - Outside tabs so they apply to both */}
									<Separator />

									<div className="space-y-4">
										<FormField
											control={form.control}
											name="slippagePercent"
											render={({ field }) => (
												<FormItem>
													<FormLabel>Slippage Tolerance (%)</FormLabel>
													<FormControl>
														<Input
															type="number"
															step="0.01"
															placeholder="0.5"
															{...field}
															onChange={(e) =>
																field.onChange(Number(e.target.value))
															}
														/>
													</FormControl>
													<FormDescription>
														Maximum acceptable slippage for the swap
													</FormDescription>
													<FormMessage />
												</FormItem>
											)}
										/>

										<FormField
											control={form.control}
											name="poolId"
											render={({ field }) => (
												<FormItem>
													<FormLabel>Pool ID (Optional)</FormLabel>
													<FormControl>
														<Input
															placeholder="Leave empty for auto-selection..."
															{...field}
														/>
													</FormControl>
													<FormDescription>
														Specify a pool ID or let the system find the best
														pool
													</FormDescription>
													<FormMessage />
												</FormItem>
											)}
										/>

										{/* Advanced Settings */}
										<div className="space-y-4">
											<div className="flex items-center gap-2">
												<Checkbox
													id="show-advanced-swap"
													checked={showAdvanced}
													onCheckedChange={(checked) =>
														setShowAdvanced(checked === true)
													}
												/>
												<label
													htmlFor="show-advanced-swap"
													className="text-sm font-medium cursor-pointer flex items-center gap-2"
												>
													<Settings2 className="w-4 h-4" />
													Advanced Settings
												</label>
											</div>

											{showAdvanced && (
												<div className="space-y-4 p-4 border rounded-lg bg-muted/50">
													<div className="grid grid-cols-2 gap-4">
														<FormField
															control={form.control}
															name="computeBudgetUnits"
															render={({ field }) => (
																<FormItem>
																	<FormLabel>Compute Units</FormLabel>
																	<FormControl>
																		<Input
																			type="number"
																			{...field}
																			onChange={(e) =>
																				field.onChange(Number(e.target.value))
																			}
																		/>
																	</FormControl>
																	<FormMessage />
																</FormItem>
															)}
														/>
														<FormField
															control={form.control}
															name="computeBudgetMicroLamports"
															render={({ field }) => (
																<FormItem>
																	<FormLabel>
																		Priority Fee (μLamports)
																	</FormLabel>
																	<FormControl>
																		<Input
																			type="number"
																			{...field}
																			onChange={(e) =>
																				field.onChange(Number(e.target.value))
																			}
																		/>
																	</FormControl>
																	<FormMessage />
																</FormItem>
															)}
														/>
													</div>
												</div>
											)}
										</div>
									</div>

									{/* Submit Button */}
									<Button
										type="submit"
										className="w-full"
										disabled={
											isSubmitting ||
											!umi?.identity ||
											!watchedValues.inputMint ||
											!watchedValues.outputMint
										}
									>
										{isSubmitting ? (
											<>
												<LoadingSpinner className="mr-2 h-4 w-4" />
												{activeTab === "exact_in"
													? "Swapping..."
													: "Calculating & Swapping..."}
											</>
										) : (
											<>
												<ArrowLeftRight className="mr-2 h-4 w-4" />
												{activeTab === "exact_in"
													? "Swap Tokens"
													: "Swap for Exact Amount"}
											</>
										)}
									</Button>
								</form>
							</Form>
						</Tabs>
					</CardContent>
				</Card>
				{/* Connection Alert */}
				{!umi?.identity && (
					<Alert className="max-w-2xl mx-auto mt-6">
						<AlertCircle className="h-4 w-4" />
						<AlertDescription>
							Please connect your wallet to swap tokens. Make sure you have
							sufficient tokens and SOL for transaction fees.
						</AlertDescription>
					</Alert>
				)}
			</div>
		</div>
	);
};

export default SwapToken;

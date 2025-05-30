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
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
	type AddToCPMMPoolParams,
	addToCPMMPool,
	calculateMinimumAmounts,
	formatPoolAmounts,
} from "@/lib/liquidity/cpmm/add";
import useUmiStore, { ConnectionStatus } from "@/store/useUmiStore";
import { Network } from "@/store/useUmiStore";
import { zodResolver } from "@hookform/resolvers/zod";
import BN from "bn.js";
import {
	AlertCircle,
	ArrowDown,
	Droplets,
	Plus,
	RefreshCw,
	Settings2,
	TrendingUp,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const SOL_MINT_ADDRESS = "So11111111111111111111111111111111111111112";

// Form schema
const addLiquiditySchema = z
	.object({
		poolId: z.string().optional(),
		mintA: z.string().optional(),
		mintB: z.string().optional(),
		inputAmount: z.number().min(0.000001, "Amount must be greater than 0"),
		slippagePercent: z
			.number()
			.min(0.01)
			.max(100, "Slippage must be between 0.01% and 100%"),
		baseIn: z.boolean(),
		autoSelectBestPool: z.boolean(),
		poolSortBy: z.enum(["liquidity", "volume24h"]),
		computeBudgetUnits: z.number().min(100000).max(1400000),
		computeBudgetMicroLamports: z.number().min(1000).max(100000000),
	})
	.refine(
		(data) => {
			return data.poolId || (data.mintA && data.mintB);
		},
		{
			message: "Either pool ID or both token mints must be provided",
			path: ["poolId"],
		},
	);

type AddLiquidityFormData = z.infer<typeof addLiquiditySchema>;

interface AddLiquidityResult {
	txId: string;
	poolId: string;
	inputAmount: BN;
	estimatedPairAmount?: BN;
	actualSlippage?: number;
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

const AddLiquidity = () => {
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [showAdvanced, setShowAdvanced] = useState(false);
	const [result, setResult] = useState<AddLiquidityResult | null>(null);
	const [availableTokens, setAvailableTokens] = useState<TokenBalance[]>([]);
	const [loadingTokens, setLoadingTokens] = useState(false);
	const [estimatedPairAmount, setEstimatedPairAmount] = useState<string>("");
	const [minimumAmounts, setMinimumAmounts] = useState<{
		minInput: string;
		minPair: string;
	} | null>(null);

	const {
		umi,
		connection,
		network,
		getTokenBalances,
		signer,
		connectionStatus,
	} = useUmiStore();
	const newConnection = connection();

	const form = useForm<AddLiquidityFormData>({
		resolver: zodResolver(addLiquiditySchema),
		defaultValues: {
			poolId: "",
			mintA: "",
			mintB: "",
			inputAmount: 0.1,
			slippagePercent: 1,
			baseIn: true,
			autoSelectBestPool: true,
			poolSortBy: "liquidity",
			computeBudgetUnits: 600000,
			computeBudgetMicroLamports: 46591500,
		},
	});

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
			const { inputAmount, slippagePercent, baseIn } = watchedValues;

			if (!inputAmount || inputAmount <= 0) {
				setEstimatedPairAmount("");
				setMinimumAmounts(null);
				return;
			}

			// Simple estimation based on equal value assumption
			// In a real implementation, you'd fetch actual pool reserves
			const estimatedPair = inputAmount;
			setEstimatedPairAmount(estimatedPair.toString());

			// Calculate minimum amounts with slippage
			const inputBN = new BN(Math.floor(inputAmount * 1e9)); // Convert to lamports
			const pairBN = new BN(Math.floor(estimatedPair * 1e9));

			const { minInputAmount, minPairAmount } = calculateMinimumAmounts(
				inputBN,
				pairBN,
				slippagePercent,
			);

			setMinimumAmounts({
				minInput: formatPoolAmounts(minInputAmount, 9),
				minPair: formatPoolAmounts(minPairAmount, 9),
			});
		};

		calculateEstimates();
	}, [watchedValues]);

	const TokenSelector = ({
		label,
		placeholder,
		onValueChange,
		value,
		showBalance = true,
	}: {
		label: string;
		placeholder: string;
		onValueChange: (value: string) => void;
		value?: string;
		showBalance?: boolean;
	}) => {
		const selectedToken = availableTokens.find((token) => token.mint === value);

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
										: availableTokens.length === 0
											? "No tokens found"
											: placeholder
								}
							/>
						</SelectTrigger>
						<SelectContent>
							{availableTokens.map((token) => (
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

	const handleSubmit = async (data: AddLiquidityFormData) => {
		if (!umi || !newConnection || !umi.identity) {
			console.error("Wallet not connected");
			return;
		}

		setIsSubmitting(true);
		try {
			const params: AddToCPMMPoolParams = {
				umi,
				connection: newConnection,
				network,
				signer: umi.identity,
				poolIdParam: data.poolId || undefined,
				mintA: data.mintA || undefined,
				mintB: data.mintB || undefined,
				uiInputAmountParam: data.inputAmount.toString(),
				slippagePercent: data.slippagePercent,
				baseIn: data.baseIn,
				autoSelectBestPool: data.autoSelectBestPool,
				poolSortBy: data.poolSortBy,
				computeBudgetUnits: data.computeBudgetUnits,
				computeBudgetMicroLamports: data.computeBudgetMicroLamports,
			};

			const addResult = await addToCPMMPool(params);

			const explorerUrl =
				network === Network.MAINNET
					? `https://solscan.io/tx/${addResult.txId}`
					: `https://solscan.io/tx/${addResult.txId}?cluster=${network}`;

			setResult({
				...addResult,
				explorerUrl,
			});

			form.reset();
		} catch (error) {
			console.error("Failed to add liquidity:", error);
		} finally {
			setIsSubmitting(false);
		}
	};

	const setMaxAmount = () => {
		const baseToken = watchedValues.baseIn
			? watchedValues.mintA
			: watchedValues.mintB;
		const selectedToken = availableTokens.find(
			(token) => token.mint === baseToken,
		);

		if (selectedToken) {
			// Keep some buffer for fees
			const maxAmount = Math.max(0, selectedToken.uiAmount - 0.01);
			form.setValue("inputAmount", maxAmount);
		}
	};

	if (result) {
		return (
			<div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-secondary/10 relative overflow-hidden">
				<div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:60px_60px]" />
				<div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-primary/5 via-transparent to-secondary/5" />

				<div className="container mx-auto px-4 py-12 max-w-4xl relative">
					<div className="text-center mb-8">
						<div className="inline-flex items-center justify-center w-24 h-24 rounded-2xl bg-gradient-to-br from-green-500/20 to-green-600/10 mb-6">
							<div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-green-600 shadow-lg flex items-center justify-center">
								<Plus className="w-6 h-6 text-white" />
							</div>
						</div>
						<h1 className="text-4xl font-bold text-green-600 mb-4">
							Liquidity Added Successfully!
						</h1>
						<p className="text-lg text-muted-foreground">
							Your tokens have been added to the liquidity pool
						</p>
					</div>

					<Card className="border-green-200 bg-green-50/50 dark:bg-green-950/20 dark:border-green-800">
						<CardHeader className="text-center">
							<CardTitle className="text-green-700 dark:text-green-300">
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
										{formatPoolAmounts(result.inputAmount, 9)} tokens
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
									Add More Liquidity
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
			<div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-primary/5 via-transparent to-secondary/5" />

			<div className="container mx-auto px-4 py-12 max-w-4xl relative">
				{/* Hero Section */}
				<article className="text-center mb-16">
					<div className="inline-flex items-center justify-center w-24 h-24 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 mb-8 relative">
						<div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary/80 shadow-lg flex items-center justify-center">
							<Droplets className="w-6 h-6 text-white" />
						</div>
						<div className="absolute inset-0 rounded-2xl bg-primary/5 animate-pulse" />
					</div>
					<h1 className="text-6xl md:text-7xl font-bold bg-gradient-to-r from-primary via-primary/90 to-primary/70 bg-clip-text text-transparent mb-6 tracking-tight">
						Add Liquidity
					</h1>
					<p className="text-xl md:text-2xl text-muted-foreground mb-3 max-w-3xl mx-auto font-medium">
						Provide liquidity to CPMM pools and earn trading fees
					</p>
					<p className="text-lg text-muted-foreground/80 max-w-2xl mx-auto">
						Add your tokens to existing pools or create new trading pairs
					</p>
				</article>

				{/* Main Form */}
				<Card className="max-w-2xl mx-auto">
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Plus className="w-5 h-5" />
							Add Liquidity to Pool
						</CardTitle>
						<CardDescription>
							Choose tokens and amounts to add to a liquidity pool
						</CardDescription>
					</CardHeader>
					<CardContent>
						<Form {...form}>
							<form
								onSubmit={form.handleSubmit(handleSubmit)}
								className="space-y-6"
							>
								{/* Pool Selection Method */}
								<div className="space-y-4">
									<div className="flex items-center gap-4">
										<Badge variant="outline">Pool Selection</Badge>
									</div>

									{/* Pool ID Input */}
									<FormField
										control={form.control}
										name="poolId"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Pool ID (Optional)</FormLabel>
												<FormControl>
													<Input
														placeholder="Enter specific pool ID..."
														{...field}
													/>
												</FormControl>
												<FormDescription>
													Leave empty to auto-select pool based on token pair
												</FormDescription>
												<FormMessage />
											</FormItem>
										)}
									/>

									<div className="relative">
										<div className="absolute inset-0 flex items-center">
											<span className="w-full border-t" />
										</div>
										<div className="relative flex justify-center text-xs uppercase">
											<span className="bg-background px-2 text-muted-foreground">
												Or select tokens
											</span>
										</div>
									</div>

									{/* Token Selectors */}
									<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
										<div>
											<TokenSelector
												label="Token A"
												placeholder="Choose Token A"
												onValueChange={(value) => form.setValue("mintA", value)}
												value={form.watch("mintA")}
											/>
											<FormField
												control={form.control}
												name="mintA"
												render={({ field }) => (
													<FormItem className="mt-2">
														<FormControl>
															<Input
																placeholder="Or enter Token A mint..."
																{...field}
															/>
														</FormControl>
														<FormMessage />
													</FormItem>
												)}
											/>
										</div>

										<div>
											<TokenSelector
												label="Token B"
												placeholder="Choose Token B"
												onValueChange={(value) => form.setValue("mintB", value)}
												value={form.watch("mintB")}
											/>
											<FormField
												control={form.control}
												name="mintB"
												render={({ field }) => (
													<FormItem className="mt-2">
														<FormControl>
															<Input
																placeholder="Or enter Token B mint..."
																{...field}
															/>
														</FormControl>
														<FormMessage />
													</FormItem>
												)}
											/>
										</div>
									</div>
								</div>

								<Separator />

								{/* Liquidity Input */}
								<div className="space-y-4">
									<div className="flex items-center justify-between">
										<Badge variant="outline">Liquidity Amount</Badge>
									</div>

									<div className="space-y-4">
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
														>
															MAX
														</Button>
													</div>
													<FormControl>
														<Input
															type="number"
															step="any"
															placeholder="0.1"
															{...field}
															onChange={(e) =>
																field.onChange(Number(e.target.value))
															}
														/>
													</FormControl>
													<FormDescription>
														Amount of tokens to add to the pool
													</FormDescription>
													<FormMessage />
												</FormItem>
											)}
										/>

										<FormField
											control={form.control}
											name="baseIn"
											render={({ field }) => (
												<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
													<div className="space-y-0.5">
														<FormLabel className="text-base">
															Base Token Input
														</FormLabel>
														<FormDescription>
															{field.value
																? "Input amount is for Token A"
																: "Input amount is for Token B"}
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

										{/* Estimated Pair Amount */}
										{estimatedPairAmount && (
											<div className="p-4 bg-muted/50 rounded-lg">
												<div className="flex items-center gap-2 mb-2">
													<ArrowDown className="w-4 h-4" />
													<span className="text-sm font-medium">
														Estimated Pair Amount
													</span>
												</div>
												<p className="text-lg font-mono">
													{estimatedPairAmount}
												</p>
												{minimumAmounts && (
													<p className="text-xs text-muted-foreground mt-1">
														Minimum: {minimumAmounts.minPair} (with slippage)
													</p>
												)}
											</div>
										)}
									</div>
								</div>

								<Separator />

								{/* Pool Selection Options */}
								<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
									<FormField
										control={form.control}
										name="autoSelectBestPool"
										render={({ field }) => (
											<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
												<div className="space-y-0.5">
													<FormLabel className="text-base">
														Auto-select Best Pool
													</FormLabel>
													<FormDescription>
														Automatically find the best pool for your token pair
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

									<FormField
										control={form.control}
										name="poolSortBy"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Sort Pools By</FormLabel>
												<Select
													onValueChange={field.onChange}
													defaultValue={field.value}
												>
													<FormControl>
														<SelectTrigger>
															<SelectValue placeholder="Select sorting criteria" />
														</SelectTrigger>
													</FormControl>
													<SelectContent>
														<SelectItem value="liquidity">
															<div className="flex items-center gap-2">
																<Droplets className="w-4 h-4" />
																Highest Liquidity
															</div>
														</SelectItem>
														<SelectItem value="volume24h">
															<div className="flex items-center gap-2">
																<TrendingUp className="w-4 h-4" />
																24h Volume
															</div>
														</SelectItem>
													</SelectContent>
												</Select>
												<FormMessage />
											</FormItem>
										)}
									/>
								</div>

								{/* Slippage */}
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
													placeholder="1.0"
													{...field}
													onChange={(e) =>
														field.onChange(Number(e.target.value))
													}
												/>
											</FormControl>
											<FormDescription>
												Maximum acceptable slippage for the transaction
											</FormDescription>
											<FormMessage />
										</FormItem>
									)}
								/>

								{/* Advanced Settings */}
								<div className="space-y-4">
									<div className="flex items-center gap-2">
										<Checkbox
											id="show-advanced-add"
											checked={showAdvanced}
											onCheckedChange={(checked) =>
												setShowAdvanced(checked === true)
											}
										/>
										<label
											htmlFor="show-advanced-add"
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
															<FormLabel>Priority Fee (μLamports)</FormLabel>
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

								{/* Submit Button */}
								<Button
									type="submit"
									className="w-full"
									disabled={isSubmitting || !umi?.identity}
								>
									{isSubmitting ? (
										<>
											<LoadingSpinner className="mr-2 h-4 w-4" />
											Adding Liquidity...
										</>
									) : (
										<>
											<Plus className="mr-2 h-4 w-4" />
											Add Liquidity
										</>
									)}
								</Button>
							</form>
						</Form>
					</CardContent>
				</Card>

				{/* Connection Alert */}
				{!umi?.identity && (
					<Alert className="max-w-2xl mx-auto mt-6">
						<AlertCircle className="h-4 w-4" />
						<AlertDescription>
							Please connect your wallet to add liquidity. Make sure you have
							sufficient tokens and SOL for transaction fees.
						</AlertDescription>
					</Alert>
				)}
			</div>
		</div>
	);
};

export default AddLiquidity;

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
	type CreateCLMMPoolParams,
	createCLMMPool,
} from "@/lib/liquidity/clmm/create";
import {
	type CreateCPMMPoolParams,
	createCPMMPool,
} from "@/lib/liquidity/cpmm/create";
import useUmiStore, { ConnectionStatus } from "@/store/useUmiStore";
import { Network } from "@/store/useUmiStore";
import { zodResolver } from "@hookform/resolvers/zod";
import { sol } from "@metaplex-foundation/umi";
import BN from "bn.js";
import {
	AlertCircle,
	DollarSign,
	Droplets,
	Info,
	RefreshCw,
	Settings2,
	TrendingUp,
	Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Label } from "@/components/ui/label";

const SOL_MINT_ADDRESS = "So11111111111111111111111111111111111111112"; // Wrapped SOL mint
// Pool type selection
type PoolType = "clmm" | "cpmm";

// CLMM Pool Schema
const clmmPoolSchema = z.object({
	mint1Address: z
		.string()
		.min(32, "Invalid mint address")
		.max(44, "Invalid mint address"),
	mint2Address: z
		.string()
		.min(32, "Invalid mint address")
		.max(44, "Invalid mint address"),
	initialPrice: z
		.number()
		.min(0.000001, "Initial price must be greater than 0"),
	ammConfigIndex: z.number().min(0).max(20),
	fundOwner: z.string().optional(),
	description: z
		.string()
		.max(200, "Description must be at most 200 characters")
		.optional(),
	computeBudgetUnits: z.number().min(100000).max(1400000),
	computeBudgetMicroLamports: z.number().min(1000).max(100000000),
});

// CPMM Pool Schema
const cpmmPoolSchema = z.object({
	mintAAddress: z
		.string()
		.min(32, "Invalid mint address")
		.max(44, "Invalid mint address"),
	mintBAddress: z
		.string()
		.min(32, "Invalid mint address")
		.max(44, "Invalid mint address"),
	mintAAmount: z.number().min(0.000001, "Amount must be greater than 0"),
	mintBAmount: z.number().min(0.000001, "Amount must be greater than 0"),
	startTime: z.number().optional(),
	feeConfigIndex: z.number().min(0).max(10),
	computeBudgetUnits: z.number().min(100000).max(1400000),
	computeBudgetMicroLamports: z.number().min(1000).max(100000000),
});

type CLMMPoolFormData = z.infer<typeof clmmPoolSchema>;
type CPMMPoolFormData = z.infer<typeof cpmmPoolSchema>;

interface PoolCreationResult {
	txId: string;
	poolId: string;
	type: PoolType;
	timestamp: number;
}

// Simple loading spinner component
const LoadingSpinner = ({ className }: { className?: string }) => (
	<div
		className={`animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
	/>
);

const CreatePool = () => {
	const [poolType, setPoolType] = useState<PoolType>("clmm");
	const [isCreating, setIsCreating] = useState(false);
	const [showAdvanced, setShowAdvanced] = useState(false);
	const [creationResult, setCreationResult] =
		useState<PoolCreationResult | null>(null);

	// Token selection state
	const [availableTokens, setAvailableTokens] = useState<
		Array<{
			mint: string;
			amount: bigint;
			decimals: number;
			symbol: string;
			name: string;
			formattedAmount: string;
		}>
	>([]);
	const [loadingTokens, setLoadingTokens] = useState(false);

	const {
		umi,
		connection,
		network,
		getTokenBalances,
		signer,
		connectionStatus,
	} = useUmiStore();

	const newConnection = connection();

	// CLMM Form
	const clmmForm = useForm<z.infer<typeof clmmPoolSchema>>({
		resolver: zodResolver(clmmPoolSchema),
		defaultValues: {
			mint1Address: "",
			mint2Address: "",
			initialPrice: 1,
			ammConfigIndex: 0,
			fundOwner: "",
			description: "",
			computeBudgetUnits: 600000,
			computeBudgetMicroLamports: 46591500,
		},
	});

	// CPMM Form
	const cpmmForm = useForm<z.infer<typeof cpmmPoolSchema>>({
		resolver: zodResolver(cpmmPoolSchema),
		defaultValues: {
			mintAAddress: "",
			mintBAddress: "",
			mintAAmount: 1,
			mintBAmount: 1,
			startTime: undefined,
			feeConfigIndex: 0,
			computeBudgetUnits: 600000,
			computeBudgetMicroLamports: 46591500,
		},
	});

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
				const formattedTokens = balances.map((token) => ({
					mint: token.mint.toString(),
					amount: token.amount,
					decimals: token.decimals,
					symbol: token.symbol,
					name: token.name,
					formattedAmount: (
						Number(token.amount) /
						10 ** token.decimals
					).toLocaleString(),
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
	}, [signer, connectionStatus, getTokenBalances, umi.rpc.getBalance]);

	// Function to refresh token balances manually
	const refreshTokenBalances = async () => {
		if (!signer || connectionStatus !== ConnectionStatus.CONNECTED) return;

		setLoadingTokens(true);
		try {
			const balances = await getTokenBalances();
			const formattedTokens = balances.map((token) => ({
				mint: token.mint.toString(),
				amount: token.amount,
				decimals: token.decimals,
				symbol: token.symbol,
				name: token.name,
				formattedAmount: (
					Number(token.amount) /
					10 ** token.decimals
				).toLocaleString(),
			}));
			setAvailableTokens(formattedTokens);
		} catch (error) {
			console.error("Failed to refresh token balances:", error);
		} finally {
			setLoadingTokens(false);
		}
	};

	const TokenSelector = ({
		label,
		placeholder,
		onValueChange,
		value,
	}: {
		label: string;
		placeholder: string;
		onValueChange: (value: string) => void;
		value?: string;
	}) => (
		<div className="space-y-3">
			<div className="flex items-center justify-between">
				<FormLabel>{label}</FormLabel>
				<Button
					type="button"
					variant="ghost"
					size="sm"
					onClick={refreshTokenBalances}
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
				<Select
					onValueChange={onValueChange}
					value={value}
					disabled={loadingTokens}
				>
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
									<div className="flex flex-col items-end ml-4">
										<span className="text-sm font-mono">
											{token.formattedAmount}
										</span>
										<span className="text-xs text-muted-foreground">
											{token.mint.slice(0, 4)}...{token.mint.slice(-4)}
										</span>
									</div>
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
		</div>
	);

	const handleCLMMSubmit = async (data: z.infer<typeof clmmPoolSchema>) => {
		if (!umi || !connection || !umi.identity) {
			console.error("Wallet not connected. Please connect your wallet first.");
			return;
		}

		setIsCreating(true);
		try {
			const params: CreateCLMMPoolParams = {
				umi,
				connection: newConnection,
				network,
				signer: umi.identity,
				mint1Address: data.mint1Address,
				mint2Address: data.mint2Address,
				initialPrice: data.initialPrice,
				ammConfigIndex: data.ammConfigIndex,
				fundOwner: data.fundOwner || "",
				description: data.description || "",
				computeBudgetUnits: data.computeBudgetUnits,
				computeBudgetMicroLamports: data.computeBudgetMicroLamports,
			};

			const result = await createCLMMPool(params);

			setCreationResult({
				txId: result.txId,
				poolId: result.poolId,
				type: "clmm",
				timestamp: result.timestamp,
			});

			console.log("CLMM Pool created successfully!");
			clmmForm.reset();
		} catch (error) {
			console.error("Failed to create CLMM pool:", error);
		} finally {
			setIsCreating(false);
		}
	};

	const handleCPMMSubmit = async (data: z.infer<typeof cpmmPoolSchema>) => {
		if (!umi || !connection || !umi.identity) {
			console.error("Wallet not connected. Please connect your wallet first.");
			return;
		}

		setIsCreating(true);
		try {
			const params: CreateCPMMPoolParams = {
				umi,
				connection: newConnection,
				network,
				signer: umi.identity,
				mintAAddress: data.mintAAddress,
				mintBAddress: data.mintBAddress,
				mintAAmount: new BN(Math.floor(data.mintAAmount * 10 ** 9)), // Convert to lamports
				mintBAmount: new BN(Math.floor(data.mintBAmount * 10 ** 9)), // Convert to lamports
				startTime: data.startTime ? new BN(data.startTime) : undefined,
				feeConfigIndex: data.feeConfigIndex,
				computeBudgetUnits: data.computeBudgetUnits,
				computeBudgetMicroLamports: data.computeBudgetMicroLamports,
			};

			const result = await createCPMMPool(params);

			setCreationResult({
				txId: result.txId,
				poolId: result.poolId,
				type: "cpmm",
				timestamp: result.timestamp,
			});

			console.log("CPMM Pool created successfully!");
			cpmmForm.reset();
		} catch (error) {
			console.error("Failed to create CPMM pool:", error);
		} finally {
			setIsCreating(false);
		}
	};

	const getExplorerUrl = (txId: string) => {
		const baseUrl =
			network === Network.MAINNET ? "https://solscan.io" : "https://solscan.io";
		return `${baseUrl}/tx/${txId}?cluster=${network}`;
	};

	if (creationResult) {
		return (
			<div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-secondary/10 relative overflow-hidden">
				<div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:60px_60px]" />
				<div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-primary/5 via-transparent to-secondary/5" />

				<div className="container mx-auto px-4 py-12 max-w-4xl relative">
					<div className="text-center mb-8">
						<div className="inline-flex items-center justify-center w-24 h-24 rounded-2xl bg-gradient-to-br from-green-500/20 to-green-600/10 mb-6">
							<div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-green-600 shadow-lg flex items-center justify-center">
								<Droplets className="w-6 h-6 text-white" />
							</div>
						</div>
						<h1 className="text-4xl font-bold text-green-600 mb-4">
							Pool Created Successfully!
						</h1>
						<p className="text-lg text-muted-foreground">
							Your {creationResult.type.toUpperCase()} liquidity pool has been
							created
						</p>
					</div>

					<Card className="border-green-200 bg-green-50/50 dark:bg-green-950/20 dark:border-green-800">
						<CardHeader className="text-center">
							<CardTitle className="text-green-700 dark:text-green-300">
								Pool Details
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
								<div className="space-y-2">
									<Label className="text-sm font-medium text-muted-foreground">
										Pool Type
									</Label>
									<div className="p-3 bg-background rounded-lg border">
										<Badge
											variant={
												creationResult.type === "clmm" ? "default" : "secondary"
											}
										>
											{creationResult.type.toUpperCase()}
										</Badge>
									</div>
								</div>
								<div className="space-y-2">
									<Label className="text-sm font-medium text-muted-foreground">
										Pool ID
									</Label>
									<div className="p-3 bg-background rounded-lg border font-mono text-sm break-all">
										{creationResult.poolId}
									</div>
								</div>
								<div className="space-y-2">
									<Label className="text-sm font-medium text-muted-foreground">
										Transaction ID
									</Label>
									<div className="p-3 bg-background rounded-lg border font-mono text-sm break-all">
										{creationResult.txId}
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
									onClick={() =>
										window.open(getExplorerUrl(creationResult.txId), "_blank")
									}
									className="flex-1"
								>
									View on Solscan
								</Button>
								<Button
									variant="outline"
									onClick={() => setCreationResult(null)}
									className="flex-1"
								>
									Create Another Pool
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
			{/* Background decoration */}
			<div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:60px_60px]" />
			<div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-primary/5 via-transparent to-secondary/5" />

			<div className="container mx-auto px-4 py-12 max-w-6xl relative">
				{/* Hero Section */}
				<article className="text-center mb-16">
					<div className="inline-flex items-center justify-center w-24 h-24 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 mb-8 relative">
						<div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary/80 shadow-lg flex items-center justify-center">
							<Droplets className="w-6 h-6 text-white" />
						</div>
						<div className="absolute inset-0 rounded-2xl bg-primary/5 animate-pulse" />
					</div>
					<h1 className="text-6xl md:text-7xl font-bold bg-gradient-to-r from-primary via-primary/90 to-primary/70 bg-clip-text text-transparent mb-6 tracking-tight">
						Liquidity Pool Creator
					</h1>
					<p className="text-xl md:text-2xl text-muted-foreground mb-3 max-w-3xl mx-auto font-medium">
						Create concentrated or constant product liquidity pools on Solana
					</p>
					<p className="text-lg text-muted-foreground/80 max-w-2xl mx-auto">
						Choose between CLMM for concentrated liquidity or CPMM for
						traditional constant product pools
					</p>
				</article>

				{/* Pool Type Selection */}
				<div className="mb-8">
					<Tabs
						value={poolType}
						onValueChange={(value) => setPoolType(value as PoolType)}
						className="w-full"
					>
						<TabsList className="grid w-full grid-cols-2 max-w-md mx-auto">
							<TabsTrigger value="clmm" className="flex items-center gap-2">
								<TrendingUp className="w-4 h-4" />
								CLMM Pool
							</TabsTrigger>
							<TabsTrigger value="cpmm" className="flex items-center gap-2">
								<DollarSign className="w-4 h-4" />
								CPMM Pool
							</TabsTrigger>
						</TabsList>

						{/* Pool Type Descriptions */}
						<div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto">
							<Card
								className={`transition-all ${poolType === "clmm" ? "ring-2 ring-primary" : "opacity-60"}`}
							>
								<CardHeader>
									<CardTitle className="flex items-center gap-2">
										<TrendingUp className="w-5 h-5 text-primary" />
										CLMM (Concentrated Liquidity)
									</CardTitle>
									<CardDescription>
										Advanced liquidity pools with concentrated positions for
										better capital efficiency
									</CardDescription>
								</CardHeader>
								<CardContent>
									<ul className="text-sm space-y-1 text-muted-foreground">
										<li>• Higher capital efficiency</li>
										<li>• Concentrated price ranges</li>
										<li>• Better for stable pairs</li>
										<li>• Requires initial price setting</li>
									</ul>
								</CardContent>
							</Card>

							<Card
								className={`transition-all ${poolType === "cpmm" ? "ring-2 ring-primary" : "opacity-60"}`}
							>
								<CardHeader>
									<CardTitle className="flex items-center gap-2">
										<DollarSign className="w-5 h-5 text-primary" />
										CPMM (Constant Product)
									</CardTitle>
									<CardDescription>
										Traditional AMM pools with x*y=k formula for all price
										ranges
									</CardDescription>
								</CardHeader>
								<CardContent>
									<ul className="text-sm space-y-1 text-muted-foreground">
										<li>• Full price range coverage</li>
										<li>• Simpler to understand</li>
										<li>• Better for volatile pairs</li>
										<li>• Requires token amounts</li>
									</ul>
								</CardContent>
							</Card>
						</div>

						{/* CLMM Pool Form */}
						<TabsContent value="clmm" className="mt-8">
							<Card className="max-w-2xl mx-auto">
								<CardHeader>
									<CardTitle className="flex items-center gap-2">
										<TrendingUp className="w-5 h-5" />
										Create CLMM Pool
									</CardTitle>
									<CardDescription>
										Set up a concentrated liquidity market maker pool with
										custom price ranges
									</CardDescription>
								</CardHeader>
								<CardContent>
									<Form {...clmmForm}>
										<form
											onSubmit={clmmForm.handleSubmit(handleCLMMSubmit)}
											className="space-y-6"
										>
											{/* Token Selectors */}
											<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
												<div>
													<TokenSelector
														label="Select Token A"
														placeholder="Choose Token A from wallet"
														onValueChange={(value) => {
															clmmForm.setValue("mint1Address", value);
														}}
														value={clmmForm.watch("mint1Address")}
													/>

													<div className="relative mt-2">
														<div className="absolute inset-0 flex items-center">
															<span className="w-full border-t" />
														</div>
														<div className="relative flex justify-center text-xs uppercase">
															<span className="bg-background px-2 text-muted-foreground">
																Or enter manually
															</span>
														</div>
													</div>
													<FormField
														control={clmmForm.control}
														name="mint1Address"
														render={({ field }) => (
															<FormItem className="mt-2">
																<FormControl>
																	<Input
																		placeholder="Enter Token A mint address..."
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
														label="Select Token B"
														placeholder="Choose Token B from wallet"
														onValueChange={(value) => {
															clmmForm.setValue("mint2Address", value);
														}}
														value={clmmForm.watch("mint2Address")}
													/>

													<div className="relative mt-2">
														<div className="absolute inset-0 flex items-center">
															<span className="w-full border-t" />
														</div>
														<div className="relative flex justify-center text-xs uppercase">
															<span className="bg-background px-2 text-muted-foreground">
																Or enter manually
															</span>
														</div>
													</div>

													<FormField
														control={clmmForm.control}
														name="mint2Address"
														render={({ field }) => (
															<FormItem className="mt-2">
																<FormControl>
																	<Input
																		placeholder="Enter Token B mint address..."
																		{...field}
																	/>
																</FormControl>
																<FormMessage />
															</FormItem>
														)}
													/>
												</div>
											</div>

											{/* Initial Price */}
											<FormField
												control={clmmForm.control}
												name="initialPrice"
												render={({ field }) => (
													<FormItem>
														<FormLabel>
															Initial Price (Token B per Token A)
														</FormLabel>
														<FormControl>
															<Input
																type="number"
																step="any"
																placeholder="1.0"
																{...field}
																onChange={(e) =>
																	field.onChange(Number(e.target.value))
																}
															/>
														</FormControl>
														<FormDescription>
															The starting price ratio between Token B and Token
															A
														</FormDescription>
														<FormMessage />
													</FormItem>
												)}
											/>

											{/* AMM Config */}
											<FormField
												control={clmmForm.control}
												name="ammConfigIndex"
												render={({ field }) => (
													<FormItem>
														<FormLabel>AMM Configuration</FormLabel>
														<Select
															onValueChange={(value) =>
																field.onChange(Number(value))
															}
															defaultValue={field.value.toString()}
														>
															<FormControl>
																<SelectTrigger>
																	<SelectValue placeholder="Select configuration" />
																</SelectTrigger>
															</FormControl>
															<SelectContent>
																<SelectItem value="0">
																	Standard (0.01% fee)
																</SelectItem>
																<SelectItem value="1">
																	Low Fee (0.05% fee)
																</SelectItem>
																<SelectItem value="2">
																	Medium Fee (0.25% fee)
																</SelectItem>
																<SelectItem value="3">
																	High Fee (1% fee)
																</SelectItem>
															</SelectContent>
														</Select>
														<FormMessage />
													</FormItem>
												)}
											/>

											{/* Optional Fields */}
											<FormField
												control={clmmForm.control}
												name="description"
												render={({ field }) => (
													<FormItem>
														<FormLabel>Description (Optional)</FormLabel>
														<FormControl>
															<Textarea
																placeholder="Pool description..."
																{...field}
															/>
														</FormControl>
														<FormMessage />
													</FormItem>
												)}
											/>

											{/* Advanced Settings */}
											<div className="space-y-4">
												<div className="flex items-center gap-2">
													<Checkbox
														id="show-advanced-clmm"
														checked={showAdvanced}
														onCheckedChange={(checked) =>
															setShowAdvanced(checked === true)
														}
													/>
													<label
														htmlFor="show-advanced-clmm"
														className="text-sm font-medium cursor-pointer flex items-center gap-2"
													>
														<Settings2 className="w-4 h-4" />
														Advanced Settings
													</label>
												</div>

												{showAdvanced && (
													<div className="space-y-4 p-4 border rounded-lg bg-muted/50">
														<FormField
															control={clmmForm.control}
															name="fundOwner"
															render={({ field }) => (
																<FormItem>
																	<FormLabel>Fund Owner (Optional)</FormLabel>
																	<FormControl>
																		<Input
																			placeholder="Fund owner address..."
																			{...field}
																		/>
																	</FormControl>
																	<FormDescription>
																		Leave empty to use connected wallet
																	</FormDescription>
																	<FormMessage />
																</FormItem>
															)}
														/>

														<div className="grid grid-cols-2 gap-4">
															<FormField
																control={clmmForm.control}
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
																control={clmmForm.control}
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

											{/* Create Button */}
											<Button
												type="submit"
												className="w-full"
												disabled={isCreating || !umi?.identity}
											>
												{isCreating ? (
													<>
														<LoadingSpinner className="mr-2 h-4 w-4" />
														Creating CLMM Pool...
													</>
												) : (
													<>
														<Zap className="mr-2 h-4 w-4" />
														Create CLMM Pool
													</>
												)}
											</Button>
										</form>
									</Form>
								</CardContent>
							</Card>
						</TabsContent>

						{/* CPMM Pool Form */}
						<TabsContent value="cpmm" className="mt-8">
							<Card className="max-w-2xl mx-auto">
								<CardHeader>
									<CardTitle className="flex items-center gap-2">
										<DollarSign className="w-5 h-5" />
										Create CPMM Pool
									</CardTitle>
									<CardDescription>
										Set up a constant product market maker pool with token
										amounts
									</CardDescription>
								</CardHeader>
								<CardContent>
									<Form {...cpmmForm}>
										<form
											onSubmit={cpmmForm.handleSubmit(handleCPMMSubmit)}
											className="space-y-6"
										>
											{/* Token Selectors */}
											<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
												<div>
													<TokenSelector
														label="Select Token A"
														placeholder="Choose Token A from wallet"
														onValueChange={(value) => {
															cpmmForm.setValue("mintAAddress", value);
														}}
														value={cpmmForm.watch("mintAAddress")}
													/>
													<div className="relative mt-2">
														<div className="absolute inset-0 flex items-center">
															<span className="w-full border-t" />
														</div>
														<div className="relative flex justify-center text-xs uppercase">
															<span className="bg-background px-2 text-muted-foreground">
																Or enter manually
															</span>
														</div>
													</div>{" "}
													<FormField
														control={cpmmForm.control}
														name="mintAAddress"
														render={({ field }) => (
															<FormItem className="mt-2">
																<FormControl>
																	<Input
																		placeholder="Enter Token A mint address..."
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
														label="Select Token B"
														placeholder="Choose Token B from wallet"
														onValueChange={(value) => {
															cpmmForm.setValue("mintBAddress", value);
														}}
														value={cpmmForm.watch("mintBAddress")}
													/>

													<div className="relative mt-2">
														<div className="absolute inset-0 flex items-center">
															<span className="w-full border-t" />
														</div>
														<div className="relative flex justify-center text-xs uppercase">
															<span className="bg-background px-2 text-muted-foreground">
																Or enter manually
															</span>
														</div>
													</div>

													<FormField
														control={cpmmForm.control}
														name="mintBAddress"
														render={({ field }) => (
															<FormItem className="mt-2">
																<FormControl>
																	<Input
																		placeholder="Enter Token B mint address..."
																		{...field}
																	/>
																</FormControl>
																<FormMessage />
															</FormItem>
														)}
													/>
												</div>
											</div>

											{/* Token Amounts */}
											<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
												<FormField
													control={cpmmForm.control}
													name="mintAAmount"
													render={({ field }) => (
														<FormItem>
															<FormLabel>Token A Amount</FormLabel>
															<FormControl>
																<Input
																	type="number"
																	step="any"
																	placeholder="1000"
																	{...field}
																	onChange={(e) =>
																		field.onChange(Number(e.target.value))
																	}
																/>
															</FormControl>
															<FormDescription>
																Amount of Token A to add to the pool
															</FormDescription>
															<FormMessage />
														</FormItem>
													)}
												/>
												<FormField
													control={cpmmForm.control}
													name="mintBAmount"
													render={({ field }) => (
														<FormItem>
															<FormLabel>Token B Amount</FormLabel>
															<FormControl>
																<Input
																	type="number"
																	step="any"
																	placeholder="1000"
																	{...field}
																	onChange={(e) =>
																		field.onChange(Number(e.target.value))
																	}
																/>
															</FormControl>
															<FormDescription>
																Amount of Token B to add to the pool
															</FormDescription>
															<FormMessage />
														</FormItem>
													)}
												/>
											</div>

											{/* Fee Configuration */}
											<FormField
												control={cpmmForm.control}
												name="feeConfigIndex"
												render={({ field }) => (
													<FormItem>
														<FormLabel>Fee Configuration</FormLabel>
														<Select
															onValueChange={(value) =>
																field.onChange(Number(value))
															}
															defaultValue={field.value.toString()}
														>
															<FormControl>
																<SelectTrigger>
																	<SelectValue placeholder="Select fee structure" />
																</SelectTrigger>
															</FormControl>
															<SelectContent>
																<SelectItem value="0">
																	Standard (0.25% fee)
																</SelectItem>
																<SelectItem value="1">
																	Low Fee (0.05% fee)
																</SelectItem>
																<SelectItem value="2">
																	High Fee (1% fee)
																</SelectItem>
															</SelectContent>
														</Select>
														<FormMessage />
													</FormItem>
												)}
											/>

											{/* Advanced Settings */}
											<div className="space-y-4">
												<div className="flex items-center gap-2">
													<Checkbox
														id="show-advanced-cpmm"
														checked={showAdvanced}
														onCheckedChange={(checked) =>
															setShowAdvanced(checked === true)
														}
													/>
													<label
														htmlFor="show-advanced-cpmm"
														className="text-sm font-medium cursor-pointer flex items-center gap-2"
													>
														<Settings2 className="w-4 h-4" />
														Advanced Settings
													</label>
												</div>

												{showAdvanced && (
													<div className="space-y-4 p-4 border rounded-lg bg-muted/50">
														<FormField
															control={cpmmForm.control}
															name="startTime"
															render={({ field }) => (
																<FormItem>
																	<FormLabel>Start Time (Optional)</FormLabel>
																	<FormControl>
																		<Input
																			type="number"
																			placeholder="Unix timestamp"
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
																		Leave empty to start immediately
																	</FormDescription>
																	<FormMessage />
																</FormItem>
															)}
														/>

														<div className="grid grid-cols-2 gap-4">
															<FormField
																control={cpmmForm.control}
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
																control={cpmmForm.control}
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

											{/* Create Button */}
											<Button
												type="submit"
												className="w-full"
												disabled={isCreating || !umi?.identity}
											>
												{isCreating ? (
													<>
														<LoadingSpinner className="mr-2 h-4 w-4" />
														Creating CPMM Pool...
													</>
												) : (
													<>
														<Zap className="mr-2 h-4 w-4" />
														Create CPMM Pool
													</>
												)}
											</Button>
										</form>
									</Form>
								</CardContent>
							</Card>
						</TabsContent>
					</Tabs>
				</div>

				{/* Connection Alert */}
				{!umi?.identity && (
					<Alert className="max-w-2xl mx-auto">
						<AlertCircle className="h-4 w-4" />
						<AlertDescription>
							Please connect your wallet to create liquidity pools. Make sure
							you have sufficient SOL for transaction fees.
						</AlertDescription>
					</Alert>
				)}

				{/* Info Section */}
				<div className="mt-16 max-w-4xl mx-auto">
					<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2 text-lg">
									<Info className="w-5 h-5 text-blue-500" />
									Pool Requirements
								</CardTitle>
							</CardHeader>
							<CardContent className="text-sm space-y-2">
								<p>• Valid SPL token mint addresses</p>
								<p>• Sufficient SOL for transaction fees</p>
								<p>• Token amounts for CPMM pools</p>
								<p>• Initial price for CLMM pools</p>
							</CardContent>
						</Card>

						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2 text-lg">
									<TrendingUp className="w-5 h-5 text-green-500" />
									Benefits
								</CardTitle>
							</CardHeader>
							<CardContent className="text-sm space-y-2">
								<p>• Earn trading fees from swaps</p>
								<p>• Provide liquidity to the ecosystem</p>
								<p>• Concentrated liquidity efficiency</p>
								<p>• Customizable fee structures</p>
							</CardContent>
						</Card>

						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2 text-lg">
									<AlertCircle className="w-5 h-5 text-amber-500" />
									Important Notes
								</CardTitle>
							</CardHeader>
							<CardContent className="text-sm space-y-2">
								<p>• Pool creation is irreversible</p>
								<p>• Test on devnet first</p>
								<p>• Consider impermanent loss risks</p>
								<p>• Monitor pool performance</p>
							</CardContent>
						</Card>
					</div>
				</div>
			</div>
		</div>
	);
};

export default CreatePool;

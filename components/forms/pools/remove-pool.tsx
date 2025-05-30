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
import { Slider } from "@/components/ui/slider";
import {
	type RemoveFromCPMMPoolParams,
	removeFromCPMMPool,
} from "@/lib/liquidity/cpmm/remove";
import useUmiStore, { ConnectionStatus } from "@/store/useUmiStore";
import { Network } from "@/store/useUmiStore";
import { zodResolver } from "@hookform/resolvers/zod";
import BN from "bn.js";
import {
	AlertCircle,
	ArrowDown,
	DollarSign,
	Droplets,
	Minus,
	RefreshCw,
	Settings2,
	Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Label } from "../../ui/label";

// Form schema
const removeLiquiditySchema = z
	.object({
		poolId: z.string().min(1, "Pool ID is required"),
		lpAmount: z.number().min(0.000001, "LP amount must be greater than 0"),
		slippagePercent: z
			.number()
			.min(0.01)
			.max(100, "Slippage must be between 0.01% and 100%"),
		closeWsol: z.boolean(),
		removePercentage: z.number().min(1).max(100),
	})
	.refine(
		(data) => {
			return data.poolId && data.poolId.length > 0;
		},
		{
			message: "Pool ID is required",
			path: ["poolId"],
		},
	);

type RemoveLiquidityFormData = z.infer<typeof removeLiquiditySchema>;

interface RemoveLiquidityResult {
	txId: string;
	poolId: string;
	lpAmount: BN;
	slippage: number;
	timestamp: number;
	explorerUrl: string;
}

interface LPPosition {
	poolId: string;
	lpAmount: bigint;
	formattedAmount: string;
	poolName: string;
	tokenA: {
		symbol: string;
		mint: string;
		amount: string;
	};
	tokenB: {
		symbol: string;
		mint: string;
		amount: string;
	};
	value?: string; // USD value if available
}

const LoadingSpinner = ({ className }: { className?: string }) => (
	<div
		className={`animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
	/>
);

const RemoveLiquidity = () => {
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [showAdvanced, setShowAdvanced] = useState(false);
	const [result, setResult] = useState<RemoveLiquidityResult | null>(null);
	const [lpPositions, setLpPositions] = useState<LPPosition[]>([]);
	const [loadingPositions, setLoadingPositions] = useState(false);
	const [selectedPosition, setSelectedPosition] = useState<LPPosition | null>(
		null,
	);
	const [estimatedWithdrawal, setEstimatedWithdrawal] = useState<{
		tokenA: string;
		tokenB: string;
	} | null>(null);

	const { umi, connection, network, signer, connectionStatus } = useUmiStore();
	const newConnection = connection();

	const form = useForm<RemoveLiquidityFormData>({
		resolver: zodResolver(removeLiquiditySchema),
		defaultValues: {
			poolId: "",
			lpAmount: 0,
			slippagePercent: 1,
			closeWsol: true,
			removePercentage: 100,
		},
	});

	// Watch form values for calculations
	const watchedValues = form.watch();

	useEffect(() => {
		const loadLPPositions = async () => {
			if (!signer || connectionStatus !== ConnectionStatus.CONNECTED) {
				setLpPositions([]);
				return;
			}

			setLoadingPositions(true);
			try {
				// Mock LP positions - in a real implementation, fetch from Raydium API
				const mockPositions: LPPosition[] = [
					{
						poolId: "6rXSohG2esLJMzKZzpFr1BXUeXg8Cr5Gv3TwbuXbrwQq",
						lpAmount: BigInt("1000000000"),
						formattedAmount: "1.0",
						poolName: "SOL-USDC",
						tokenA: {
							symbol: "SOL",
							mint: "So11111111111111111111111111111111111111112",
							amount: "0.5",
						},
						tokenB: {
							symbol: "USDC",
							mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
							amount: "75.25",
						},
						value: "$150.50",
					},
					// Add more mock positions as needed
				];

				setLpPositions(mockPositions);
			} catch (error) {
				console.error("Failed to load LP positions:", error);
				setLpPositions([]);
			} finally {
				setLoadingPositions(false);
			}
		};

		loadLPPositions();
	}, [signer, connectionStatus]);

	// Calculate withdrawal estimates when values change
	useEffect(() => {
		const calculateWithdrawal = () => {
			if (!selectedPosition || !watchedValues.removePercentage) {
				setEstimatedWithdrawal(null);
				return;
			}

			const percentage = watchedValues.removePercentage / 100;
			const tokenAAmount = (
				Number.parseFloat(selectedPosition.tokenA.amount) * percentage
			).toFixed(6);
			const tokenBAmount = (
				Number.parseFloat(selectedPosition.tokenB.amount) * percentage
			).toFixed(6);

			setEstimatedWithdrawal({
				tokenA: tokenAAmount,
				tokenB: tokenBAmount,
			});

			// Update LP amount based on percentage
			const lpAmountToRemove =
				(Number(selectedPosition.lpAmount) * percentage) / 1e9;
			form.setValue("lpAmount", lpAmountToRemove);
		};

		calculateWithdrawal();
	}, [watchedValues.removePercentage, selectedPosition, form]);

	const LPPositionSelector = () => {
		return (
			<div className="space-y-3">
				<div className="flex items-center justify-between">
					<FormLabel>Select LP Position</FormLabel>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						onClick={() => loadLPPositions()}
						disabled={loadingPositions}
						className="h-auto p-1 text-xs"
					>
						<RefreshCw
							className={`h-3 w-3 mr-1 ${loadingPositions ? "animate-spin" : ""}`}
						/>
						Refresh
					</Button>
				</div>

				{signer && connectionStatus === ConnectionStatus.CONNECTED ? (
					<Select
						onValueChange={(value) => {
							const position = lpPositions.find((p) => p.poolId === value);
							setSelectedPosition(position || null);
							form.setValue("poolId", value);
						}}
						value={selectedPosition?.poolId || ""}
					>
						<SelectTrigger className="w-full">
							<SelectValue
								placeholder={
									loadingPositions
										? "Loading positions..."
										: lpPositions.length === 0
											? "No LP positions found"
											: "Choose LP position to remove"
								}
							/>
						</SelectTrigger>
						<SelectContent>
							{lpPositions.map((position) => (
								<SelectItem key={position.poolId} value={position.poolId}>
									<div className="flex items-center justify-between w-full">
										<div className="flex flex-col items-start">
											<span className="font-medium">{position.poolName}</span>
											<span className="text-xs text-muted-foreground">
												{position.tokenA.amount} {position.tokenA.symbol} +{" "}
												{position.tokenB.amount} {position.tokenB.symbol}
											</span>
										</div>
										<div className="flex flex-col items-end ml-4">
											<span className="text-sm font-mono">
												{position.formattedAmount} LP
											</span>
											{position.value && (
												<span className="text-xs text-green-600">
													{position.value}
												</span>
											)}
										</div>
									</div>
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				) : (
					<div className="text-sm text-muted-foreground p-3 border rounded-md bg-muted/50">
						{!signer
							? "Connect your wallet to see LP positions"
							: "Connecting..."}
					</div>
				)}

				{selectedPosition && (
					<div className="text-xs text-muted-foreground space-y-1">
						<div>
							Pool: {selectedPosition.poolId.slice(0, 8)}...
							{selectedPosition.poolId.slice(-8)}
						</div>
						<div>Available: {selectedPosition.formattedAmount} LP tokens</div>
					</div>
				)}
			</div>
		);
	};

	const loadLPPositions = async () => {
		if (!signer || connectionStatus !== ConnectionStatus.CONNECTED) return;

		setLoadingPositions(true);
		try {
			// In a real implementation, fetch actual LP positions from Raydium
			// This would involve checking the user's token accounts for LP tokens
			console.log("Loading LP positions...");
			// Simulate API call delay
			await new Promise((resolve) => setTimeout(resolve, 1000));
		} catch (error) {
			console.error("Failed to refresh LP positions:", error);
		} finally {
			setLoadingPositions(false);
		}
	};

	const handleSubmit = async (data: RemoveLiquidityFormData) => {
		if (!umi || !newConnection || !umi.identity) {
			console.error("Wallet not connected");
			return;
		}

		setIsSubmitting(true);
		try {
			const lpAmountBN = new BN(Math.floor(data.lpAmount * 1e9));

			const params: RemoveFromCPMMPoolParams = {
				umi,
				connection: newConnection,
				network,
				signer: umi.identity,
				poolIdParam: data.poolId,
				lpAmountParam: lpAmountBN,
				slippagePercent: data.slippagePercent,
				closeWsol: data.closeWsol,
			};

			const removeResult = await removeFromCPMMPool(params);

			const explorerUrl =
				network === Network.MAINNET
					? `https://solscan.io/tx/${removeResult.txId}`
					: `https://solscan.io/tx/${removeResult.txId}?cluster=${network}`;

			setResult({
				...removeResult,
				explorerUrl,
			});

			form.reset();
			setSelectedPosition(null);
		} catch (error) {
			console.error("Failed to remove liquidity:", error);
		} finally {
			setIsSubmitting(false);
		}
	};

	const setPercentage = (percentage: number) => {
		form.setValue("removePercentage", percentage);
	};

	if (result) {
		return (
			<div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-secondary/10 relative overflow-hidden">
				<div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:60px_60px]" />
				<div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-destructive/5 via-transparent to-orange/5" />

				<div className="container mx-auto px-4 py-12 max-w-4xl relative">
					<div className="text-center mb-8">
						<div className="inline-flex items-center justify-center w-24 h-24 rounded-2xl bg-gradient-to-br from-orange-500/20 to-orange-600/10 mb-6">
							<div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 shadow-lg flex items-center justify-center">
								<Minus className="w-6 h-6 text-white" />
							</div>
						</div>
						<h1 className="text-4xl font-bold text-orange-600 mb-4">
							Liquidity Removed Successfully!
						</h1>
						<p className="text-lg text-muted-foreground">
							Your LP tokens have been withdrawn from the pool
						</p>
					</div>

					<Card className="border-orange-200 bg-orange-50/50 dark:bg-orange-950/20 dark:border-orange-800">
						<CardHeader className="text-center">
							<CardTitle className="text-orange-700 dark:text-orange-300">
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
										LP Amount Removed
									</Label>
									<div className="p-3 bg-background rounded-lg border">
										{(Number(result.lpAmount) / 1e9).toFixed(9)} LP tokens
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
									Remove More Liquidity
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
			<div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-destructive/5 via-transparent to-orange/5" />

			<div className="container mx-auto px-4 py-12 max-w-4xl relative">
				{/* Hero Section */}
				<article className="text-center mb-16">
					<div className="inline-flex items-center justify-center w-24 h-24 rounded-2xl bg-gradient-to-br from-destructive/20 to-destructive/10 mb-8 relative">
						<div className="w-12 h-12 rounded-xl bg-gradient-to-br from-destructive to-destructive/80 shadow-lg flex items-center justify-center">
							<Minus className="w-6 h-6 text-white" />
						</div>
						<div className="absolute inset-0 rounded-2xl bg-destructive/5 animate-pulse" />
					</div>
					<h1 className="text-6xl md:text-7xl font-bold bg-gradient-to-r from-destructive via-destructive/90 to-destructive/70 bg-clip-text text-transparent mb-6 tracking-tight">
						Remove Liquidity
					</h1>
					<p className="text-xl md:text-2xl text-muted-foreground mb-3 max-w-3xl mx-auto font-medium">
						Withdraw your tokens from CPMM pools
					</p>
					<p className="text-lg text-muted-foreground/80 max-w-2xl mx-auto">
						Remove your LP tokens and get back your underlying assets
					</p>
				</article>

				{/* Main Form */}
				<Card className="max-w-2xl mx-auto">
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Minus className="w-5 h-5" />
							Remove Liquidity from Pool
						</CardTitle>
						<CardDescription>
							Select your LP position or enter a pool ID manually
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

									{/* Manual Pool ID Input */}
									<FormField
										control={form.control}
										name="poolId"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Pool ID (Manual Entry)</FormLabel>
												<FormControl>
													<Input
														placeholder="Enter pool ID to remove liquidity from..."
														{...field}
														onChange={(e) => {
															field.onChange(e.target.value);
															// Clear selected position when manually entering pool ID
															setSelectedPosition(null);
														}}
													/>
												</FormControl>
												<FormDescription>
													Enter a specific pool ID to remove liquidity from
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
												Or select from your positions
											</span>
										</div>
									</div>

									<LPPositionSelector />

									{selectedPosition && (
										<div className="p-4 bg-muted/50 rounded-lg">
											<div className="flex items-center gap-2 mb-2">
												<Droplets className="w-4 h-4" />
												<span className="text-sm font-medium">
													Position Details
												</span>
											</div>
											<div className="grid grid-cols-2 gap-4 text-sm">
												<div>
													<p className="text-muted-foreground">Token A</p>
													<p className="font-mono">
														{selectedPosition.tokenA.amount}{" "}
														{selectedPosition.tokenA.symbol}
													</p>
												</div>
												<div>
													<p className="text-muted-foreground">Token B</p>
													<p className="font-mono">
														{selectedPosition.tokenB.amount}{" "}
														{selectedPosition.tokenB.symbol}
													</p>
												</div>
											</div>
										</div>
									)}
								</div>

								<Separator />

								{/* Removal Amount */}
								{(selectedPosition || watchedValues.poolId) && (
									<div className="space-y-4">
										<div className="flex items-center gap-4">
											<Badge variant="outline">Removal Amount</Badge>
										</div>

										{/* LP Amount Input */}
										<FormField
											control={form.control}
											name="lpAmount"
											render={({ field }) => (
												<FormItem>
													<FormLabel>LP Tokens to Remove</FormLabel>
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
														Amount of LP tokens to withdraw from the pool
													</FormDescription>
													<FormMessage />
												</FormItem>
											)}
										/>

										{/* Percentage Slider - Only show if position is selected */}
										{selectedPosition && (
											<FormField
												control={form.control}
												name="removePercentage"
												render={({ field }) => (
													<FormItem>
														<div className="flex items-center justify-between">
															<FormLabel>Percentage to Remove</FormLabel>
															<span className="text-sm font-mono">
																{field.value}%
															</span>
														</div>
														<FormControl>
															<div className="space-y-4">
																<Slider
																	value={[field.value]}
																	onValueChange={(value) =>
																		field.onChange(value[0])
																	}
																	min={1}
																	max={100}
																	step={1}
																	className="w-full"
																/>
																<div className="flex justify-between gap-2">
																	{[25, 50, 75, 100].map((percentage) => (
																		<Button
																			key={percentage}
																			type="button"
																			variant={
																				field.value === percentage
																					? "default"
																					: "outline"
																			}
																			size="sm"
																			onClick={() => setPercentage(percentage)}
																			className="flex-1"
																		>
																			{percentage}%
																		</Button>
																	))}
																</div>
															</div>
														</FormControl>
														<FormMessage />
													</FormItem>
												)}
											/>
										)}

										{/* Estimated Withdrawal */}
										{estimatedWithdrawal && selectedPosition && (
											<div className="p-4 bg-muted/50 rounded-lg">
												<div className="flex items-center gap-2 mb-2">
													<ArrowDown className="w-4 h-4" />
													<span className="text-sm font-medium">
														Estimated Withdrawal
													</span>
												</div>
												<div className="grid grid-cols-2 gap-4">
													<div>
														<p className="text-xs text-muted-foreground">
															{selectedPosition.tokenA.symbol}
														</p>
														<p className="text-lg font-mono">
															{estimatedWithdrawal.tokenA}
														</p>
													</div>
													<div>
														<p className="text-xs text-muted-foreground">
															{selectedPosition.tokenB.symbol}
														</p>
														<p className="text-lg font-mono">
															{estimatedWithdrawal.tokenB}
														</p>
													</div>
												</div>
											</div>
										)}
									</div>
								)}

								<Separator />

								{/* Settings */}
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

									<FormField
										control={form.control}
										name="closeWsol"
										render={({ field }) => (
											<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
												<div className="space-y-0.5">
													<FormLabel className="text-base">
														Close WSOL Account
													</FormLabel>
													<FormDescription>
														Automatically close wrapped SOL account after
														withdrawal
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
								</div>

								{/* Submit Button */}
								<Button
									type="submit"
									className="w-full"
									disabled={
										isSubmitting ||
										!umi?.identity ||
										(!selectedPosition && !watchedValues.poolId)
									}
									variant="destructive"
								>
									{isSubmitting ? (
										<>
											<LoadingSpinner className="mr-2 h-4 w-4" />
											Removing Liquidity...
										</>
									) : (
										<>
											<Minus className="mr-2 h-4 w-4" />
											Remove Liquidity
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
							Please connect your wallet to remove liquidity. Make sure you have
							LP tokens and SOL for transaction fees.
						</AlertDescription>
					</Alert>
				)}

				{/* No Positions Alert */}
				{umi?.identity && lpPositions.length === 0 && !loadingPositions && (
					<Alert className="max-w-2xl mx-auto mt-6">
						<AlertCircle className="h-4 w-4" />
						<AlertDescription>
							No LP positions found in your wallet. You can still remove
							liquidity by entering a pool ID manually above.
						</AlertDescription>
					</Alert>
				)}
			</div>
		</div>
	);
};

export default RemoveLiquidity;

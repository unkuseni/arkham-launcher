"use client";
import {
	type BurnTokenParams,
	burnAllTokens,
	burnSPLTokens,
} from "@/lib/token/burn-token";
import useUmiStore, { ConnectionStatus } from "@/store/useUmiStore";
import { zodResolver } from "@hookform/resolvers/zod";
import { findAssociatedTokenPda } from "@metaplex-foundation/mpl-toolbox";
import { publicKey } from "@metaplex-foundation/umi";
import { createWeb3JsRpc } from "@metaplex-foundation/umi-rpc-web3js";
import { getAccount, getMint } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import { AlertTriangle, Coins, Flame, Target } from "lucide-react";
import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
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
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "../ui/dialog";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "../ui/form";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";

// Zod schema for burn form
const burnSchema = z.object({
	mintAddress: z.string().nonempty("Mint address is required"),
	amount: z
		.number({ invalid_type_error: "Amount must be a number" })
		.min(0.000001, "Amount must be greater than 0"),
	ownerAddress: z.string().optional(),
});

// Zod schema for burn all form
const burnAllSchema = z.object({
	mintAddress: z.string().nonempty("Mint address is required"),
	ownerAddress: z.string().optional(),
});

type BurnValues = z.infer<typeof burnSchema>;
type BurnAllValues = z.infer<typeof burnAllSchema>;
type BurnResult = { signature: string; amountBurned: bigint };

export default function BurnTokens() {
	return (
		<div className="font-mono flex flex-col gap-6 max-w-6xl mx-auto p-4">
			<article className="mx-auto text-center space-y-2">
				<div className="flex items-center justify-center gap-2 mb-4">
					<Flame className="h-8 w-8 text-red-500" />
					<h1 className="text-4xl font-bold font-inter">Burn SPL Tokens</h1>
				</div>
				<p className="text-muted-foreground text-lg">
					Permanently destroy tokens from your wallet or specified accounts
				</p>
				<div className="flex items-center justify-center gap-2 text-amber-600">
					<AlertTriangle className="h-4 w-4" />
					<p className="text-sm font-medium">
						Warning: Burned tokens cannot be recovered
					</p>
				</div>
			</article>

			<Tabs defaultValue="burn-amount" className="w-full">
				<TabsList className="grid w-full grid-cols-2 mb-6">
					<TabsTrigger value="burn-amount" className="flex items-center gap-2">
						<Target className="h-4 w-4" />
						Burn Amount
					</TabsTrigger>
					<TabsTrigger value="burn-all" className="flex items-center gap-2">
						<Flame className="h-4 w-4" />
						Burn All
					</TabsTrigger>
				</TabsList>

				<TabsContent value="burn-amount">
					<Card className="border-2 border-red-200 dark:border-red-800">
						<CardHeader className="pb-4">
							<CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-400">
								<Target className="h-5 w-5" />
								Burn Specific Amount
							</CardTitle>
							<CardDescription>
								Burn a specific amount of tokens from your wallet or specified
								account.
							</CardDescription>
						</CardHeader>
						<CardContent>
							<BurnForm />
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="burn-all">
					<Card className="border-2 border-red-200 dark:border-red-800">
						<CardHeader className="pb-4">
							<CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-400">
								<Flame className="h-5 w-5" />
								Burn All Tokens
							</CardTitle>
							<CardDescription>
								Burn all tokens from your wallet or specified account. This
								action is irreversible.
							</CardDescription>
						</CardHeader>
						<CardContent>
							<BurnAllForm />
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>
		</div>
	);
}

function BurnForm() {
	const { umi, connectionStatus, getTokenBalances, signer, connection } = useUmiStore.getState();
	const [availableTokens, setAvailableTokens] = useState<Array<{
		mint: string;
		amount: bigint;
		decimals: number;
		symbol: string;
		name: string;
		formattedAmount: string;
	}>>([]);
	const [loadingTokens, setLoadingTokens] = useState(false);
	const [decimals, setDecimals] = useState<number>(1);
	const [tokenBalance, setTokenBalance] = useState<bigint | null>(null);
	const [result, setResult] = useState<BurnResult | null>(null);
	const [open, setOpen] = useState(false);

	const newConnection = connection();

	const form = useForm<BurnValues>({
		resolver: zodResolver(burnSchema),
		defaultValues: { mintAddress: "", amount: 0, ownerAddress: "" },
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
				const formattedTokens = balances.map(token => ({
					mint: token.mint.toString(),
					amount: token.amount,
					decimals: token.decimals,
					symbol: token.symbol,
					name: token.name,
					formattedAmount: (Number(token.amount) / 10 ** token.decimals).toLocaleString()
				}));
				setAvailableTokens(formattedTokens);
			} catch (error) {
				console.error('Failed to load token balances:', error);
				setAvailableTokens([]);
			} finally {
				setLoadingTokens(false);
			}
		};

		loadTokenBalances();
	}, [signer, connectionStatus, getTokenBalances]);

	useEffect(() => {
		const sub = form.watch(async (vals, { name }) => {
			if (
				(name === "mintAddress" || name === "ownerAddress") &&
				vals.mintAddress
			) {
				try {
					const mintPubkey = new PublicKey(vals.mintAddress);
					const info = await getMint(newConnection, mintPubkey);
					setDecimals(info.decimals);

					// Get token balance logic here...
				} catch {
					setDecimals(1);
					setTokenBalance(null);
				}
			}
		});
		return () => sub.unsubscribe();
	}, [form, newConnection]);


	const refreshTokenBalances = async () => {
		if (!signer || connectionStatus !== ConnectionStatus.CONNECTED) return;

		setLoadingTokens(true);
		try {
			const balances = await getTokenBalances();
			const formattedTokens = balances.map(token => ({
				mint: token.mint.toString(),
				amount: token.amount,
				decimals: token.decimals,
				symbol: token.symbol,
				name: token.name,
				formattedAmount: (Number(token.amount) / 10 ** token.decimals).toLocaleString()
			}));
			setAvailableTokens(formattedTokens);
		} catch (error) {
			console.error('Failed to refresh token balances:', error);
		} finally {
			setLoadingTokens(false);
		}
	};

	const onSubmit = async (values: BurnValues) => {
		try {
			const tx = await burnSPLTokens({
				mintAddress: values.mintAddress,
				amount: values.amount,
				ownerAddress: values.ownerAddress || undefined,
			});
			setResult(tx);
			setOpen(true);
			form.reset();
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			form.setError("mintAddress", { type: "manual", message });
		}
	};

	const setMaxAmount = () => {
		if (tokenBalance !== null && decimals > 0) {
			const maxAmount = Number(tokenBalance) / 10 ** decimals;
			form.setValue("amount", maxAmount);
		}
	};

	return (
		<>
			<Form {...form}>
				<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

					{/* Token Selector */}
					<div className="space-y-3">
						<div className="flex items-center justify-between">
							<FormLabel>Select Token to Delegate</FormLabel>
							<Button
								type="button"
								variant="ghost"
								size="sm"
								onClick={refreshTokenBalances}
								disabled={loadingTokens}
								className="h-auto p-1 text-xs"
							>
								{loadingTokens ? (
									<div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current mr-1" />
								) : null}
								Refresh
							</Button>
						</div>

						{signer && connectionStatus === ConnectionStatus.CONNECTED ? (
							<Select
								onValueChange={(value) => {
									const selectedToken = availableTokens.find(t => t.mint === value);
									if (selectedToken) {
										form.setValue("mintAddress", selectedToken.mint);
										setDecimals(selectedToken.decimals);
										setTokenBalance(selectedToken.amount);
									}
								}}
								disabled={loadingTokens}
							>
								<SelectTrigger className="w-full">
									<SelectValue placeholder={
										loadingTokens
											? "Loading tokens..."
											: availableTokens.length === 0
												? "No tokens found"
												: "Select a token from your wallet"
									} />
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
													<span className="text-sm font-mono">{token.formattedAmount}</span>
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
								{!signer ? "Connect your wallet to see available tokens" : "Connecting..."}
							</div>
						)}
					</div>

					<div className="relative">
						<div className="absolute inset-0 flex items-center">
							<span className="w-full border-t" />
						</div>
						<div className="relative flex justify-center text-xs uppercase">
							<span className="bg-background px-2 text-muted-foreground">Or enter manually</span>
						</div>
					</div>

					<FormField
						control={form.control}
						name="mintAddress"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Token Mint Address</FormLabel>
								<FormControl>
									<Input
										{...field}
										placeholder="Enter token mint address"
										className="font-mono"
									/>
								</FormControl>
								<FormMessage />
								<div className="flex items-center gap-2 mt-1 flex-wrap">
									{decimals > 1 && (
										<Badge variant="secondary" className="text-xs">
											{decimals} decimals
										</Badge>
									)}
									{tokenBalance !== null && (
										<Badge variant="outline" className="text-xs">
											Balance:{" "}
											{(Number(tokenBalance) / 10 ** decimals).toLocaleString()}
										</Badge>
									)}
								</div>
							</FormItem>
						)}
					/>

					<FormField
						control={form.control}
						name="amount"
						render={({ field }) => (
							<FormItem>
								<FormLabel className="flex items-center justify-between">
									<span>Amount to Burn</span>
									{tokenBalance !== null && (
										<Button
											type="button"
											variant="ghost"
											size="sm"
											onClick={setMaxAmount}
											className="h-auto p-1 text-xs text-red-600 hover:text-red-700"
										>
											Use Max
										</Button>
									)}
								</FormLabel>
								<FormControl>
									<Input
										type="number"
										step="any"
										{...field}
										onChange={(e) => field.onChange(Number(e.target.value))}
										placeholder="Enter amount to burn"
									/>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>

					<FormField
						control={form.control}
						name="ownerAddress"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Owner Address (optional)</FormLabel>
								<FormControl>
									<Input
										{...field}
										placeholder="Leave empty to use connected wallet"
										className="font-mono"
									/>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>

					<div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
						<div className="flex items-center gap-2 text-red-800 dark:text-red-200 mb-2">
							<AlertTriangle className="h-4 w-4" />
							<span className="font-medium text-sm">Warning</span>
						</div>
						<p className="text-sm text-red-700 dark:text-red-300">
							Burning tokens permanently destroys them. This action cannot be
							undone. Make sure you want to permanently remove these tokens from
							circulation.
						</p>
					</div>

					<Button
						type="submit"
						className="w-full bg-red-600 hover:bg-red-700"
						disabled={form.formState.isSubmitting}
						size="lg"
					>
						{form.formState.isSubmitting ? (
							<>
								<div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
								Burning Tokens...
							</>
						) : (
							<>
								<Flame className="h-4 w-4 mr-2" />
								Burn Tokens
							</>
						)}
					</Button>
				</form>
			</Form>

			<Dialog open={open} onOpenChange={setOpen}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<Flame className="h-5 w-5 text-red-500" />
							Tokens Burned Successfully
						</DialogTitle>
						<DialogDescription>
							Your tokens have been permanently burned.
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-3 py-4">
						<div className="space-y-1">
							<p className="text-sm font-medium">Amount Burned:</p>
							<Badge variant="outline" className="font-mono">
								{result?.amountBurned.toString()}
							</Badge>
						</div>
						<div className="space-y-1">
							<p className="text-sm font-medium">Transaction Signature:</p>
							<code className="text-xs bg-muted p-2 rounded break-all block">
								{result?.signature}
							</code>
						</div>
						<div className="text-xs text-muted-foreground">
							<a
								href={`https://explorer.solana.com/tx/${result?.signature}?cluster=devnet`}
								target="_blank"
								rel="noopener noreferrer"
								className="text-blue-600 hover:text-blue-700 underline"
							>
								View on Solana Explorer
							</a>
						</div>
					</div>
					<DialogFooter>
						<Button onClick={() => setOpen(false)} className="w-full">
							Close
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}

function BurnAllForm() {
	const { umi, connectionStatus, getTokenBalances, signer, connection } = useUmiStore.getState();
	const [availableTokens, setAvailableTokens] = useState<Array<{
		mint: string;
		amount: bigint;
		decimals: number;
		symbol: string;
		name: string;
		formattedAmount: string;
	}>>([]);
	const [loadingTokens, setLoadingTokens] = useState(false);
	const [decimals, setDecimals] = useState<number>(1);
	const [tokenBalance, setTokenBalance] = useState<bigint | null>(null);
	const [result, setResult] = useState<BurnResult | null>(null);
	const [open, setOpen] = useState(false);
	const [confirmText, setConfirmText] = useState("");

	const newConnection = connection();

	const form = useForm<BurnAllValues>({
		resolver: zodResolver(burnAllSchema),
		defaultValues: { mintAddress: "", ownerAddress: "" },
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
				const formattedTokens = balances.map(token => ({
					mint: token.mint.toString(),
					amount: token.amount,
					decimals: token.decimals,
					symbol: token.symbol,
					name: token.name,
					formattedAmount: (Number(token.amount) / 10 ** token.decimals).toLocaleString()
				}));
				setAvailableTokens(formattedTokens);
			} catch (error) {
				console.error('Failed to load token balances:', error);
				setAvailableTokens([]);
			} finally {
				setLoadingTokens(false);
			}
		};

		loadTokenBalances();
	}, [signer, connectionStatus, getTokenBalances]);

	useEffect(() => {
		const sub = form.watch(async (vals, { name }) => {
			if (
				(name === "mintAddress" || name === "ownerAddress") &&
				vals.mintAddress
			) {
				try {
					const mintPubkey = new PublicKey(vals.mintAddress);
					const info = await getMint(newConnection, mintPubkey);
					setDecimals(info.decimals);

					// Get token balance logic here...
				} catch {
					setDecimals(1);
					setTokenBalance(null);
				}
			}
		});
		return () => sub.unsubscribe();
	}, [form, newConnection]);


	const refreshTokenBalances = async () => {
		if (!signer || connectionStatus !== ConnectionStatus.CONNECTED) return;

		setLoadingTokens(true);
		try {
			const balances = await getTokenBalances();
			const formattedTokens = balances.map(token => ({
				mint: token.mint.toString(),
				amount: token.amount,
				decimals: token.decimals,
				symbol: token.symbol,
				name: token.name,
				formattedAmount: (Number(token.amount) / 10 ** token.decimals).toLocaleString()
			}));
			setAvailableTokens(formattedTokens);
		} catch (error) {
			console.error('Failed to refresh token balances:', error);
		} finally {
			setLoadingTokens(false);
		}
	};

	const onSubmit = async (values: BurnAllValues) => {
		if (confirmText !== "BURN ALL") {
			form.setError("mintAddress", {
				type: "manual",
				message: "Please type 'BURN ALL' to confirm",
			});
			return;
		}

		try {
			const tx = await burnAllTokens({
				mintAddress: values.mintAddress,
				ownerAddress: values.ownerAddress || undefined,
			});
			setResult(tx);
			setOpen(true);
			form.reset();
			setConfirmText("");
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			form.setError("mintAddress", { type: "manual", message });
		}
	};

	const isConfirmed = confirmText === "BURN ALL";
	const hasBalance = tokenBalance !== null && tokenBalance > 0;

	return (
		<>
			<Form {...form}>
				<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

					{/* Token Selector */}
					<div className="space-y-3">
						<div className="flex items-center justify-between">
							<FormLabel>Select Token to Delegate</FormLabel>
							<Button
								type="button"
								variant="ghost"
								size="sm"
								onClick={refreshTokenBalances}
								disabled={loadingTokens}
								className="h-auto p-1 text-xs"
							>
								{loadingTokens ? (
									<div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current mr-1" />
								) : null}
								Refresh
							</Button>
						</div>

						{signer && connectionStatus === ConnectionStatus.CONNECTED ? (
							<Select
								onValueChange={(value) => {
									const selectedToken = availableTokens.find(t => t.mint === value);
									if (selectedToken) {
										form.setValue("mintAddress", selectedToken.mint);
										setDecimals(selectedToken.decimals);
										setTokenBalance(selectedToken.amount);
									}
								}}
								disabled={loadingTokens}
							>
								<SelectTrigger className="w-full">
									<SelectValue placeholder={
										loadingTokens
											? "Loading tokens..."
											: availableTokens.length === 0
												? "No tokens found"
												: "Select a token from your wallet"
									} />
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
													<span className="text-sm font-mono">{token.formattedAmount}</span>
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
								{!signer ? "Connect your wallet to see available tokens" : "Connecting..."}
							</div>
						)}
					</div>

					<div className="relative">
						<div className="absolute inset-0 flex items-center">
							<span className="w-full border-t" />
						</div>
						<div className="relative flex justify-center text-xs uppercase">
							<span className="bg-background px-2 text-muted-foreground">Or enter manually</span>
						</div>
					</div>

					<FormField
						control={form.control}
						name="mintAddress"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Token Mint Address</FormLabel>
								<FormControl>
									<Input
										{...field}
										placeholder="Enter token mint address"
										className="font-mono"
									/>
								</FormControl>
								<FormMessage />
								<div className="flex items-center gap-2 mt-1 flex-wrap">
									{decimals > 1 && (
										<Badge variant="secondary" className="text-xs">
											{decimals} decimals
										</Badge>
									)}
									{tokenBalance !== null && (
										<Badge variant="outline" className="text-xs">
											Balance:{" "}
											{(Number(tokenBalance) / 10 ** decimals).toLocaleString()}
										</Badge>
									)}
								</div>
							</FormItem>
						)}
					/>

					<FormField
						control={form.control}
						name="ownerAddress"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Owner Address (optional)</FormLabel>
								<FormControl>
									<Input
										{...field}
										placeholder="Leave empty to use connected wallet"
										className="font-mono"
									/>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>

					{hasBalance && (
						<div className="space-y-4">
							<div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
								<div className="flex items-center gap-2 text-red-800 dark:text-red-200 mb-2">
									<AlertTriangle className="h-5 w-5" />
									<span className="font-medium">Critical Warning</span>
								</div>
								<p className="text-sm text-red-700 dark:text-red-300 mb-3">
									You are about to burn ALL tokens in this account. This will
									permanently destroy{" "}
									<span className="font-bold">
										{(Number(tokenBalance) / 10 ** decimals).toLocaleString()}{" "}
										tokens
									</span>
									. This action cannot be undone.
								</p>
								<p className="text-sm text-red-700 dark:text-red-300">
									Type <span className="font-bold">"BURN ALL"</span> below to
									confirm:
								</p>
							</div>

							<div>
								<Input
									value={confirmText}
									onChange={(e) => setConfirmText(e.target.value)}
									placeholder="Type 'BURN ALL' to confirm"
									className="border-red-300 focus:border-red-500"
								/>
							</div>
						</div>
					)}

					<Button
						type="submit"
						className="w-full bg-red-600 hover:bg-red-700"
						disabled={
							form.formState.isSubmitting || !hasBalance || !isConfirmed
						}
						size="lg"
					>
						{form.formState.isSubmitting ? (
							<>
								<div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
								Burning All Tokens...
							</>
						) : (
							<>
								<Flame className="h-4 w-4 mr-2" />
								Burn All Tokens
								{hasBalance &&
									` (${(Number(tokenBalance) / 10 ** decimals).toLocaleString()})`}
							</>
						)}
					</Button>
				</form>
			</Form>

			<Dialog open={open} onOpenChange={setOpen}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<Flame className="h-5 w-5 text-red-500" />
							All Tokens Burned Successfully
						</DialogTitle>
						<DialogDescription>
							All tokens have been permanently burned from the account.
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-3 py-4">
						<div className="space-y-1">
							<p className="text-sm font-medium">Amount Burned:</p>
							<Badge variant="outline" className="font-mono">
								{result?.amountBurned.toString()}
							</Badge>
						</div>
						<div className="space-y-1">
							<p className="text-sm font-medium">Transaction Signature:</p>
							<code className="text-xs bg-muted p-2 rounded break-all block">
								{result?.signature}
							</code>
						</div>
						<div className="text-xs text-muted-foreground">
							<a
								href={`https://explorer.solana.com/tx/${result?.signature}?cluster=devnet`}
								target="_blank"
								rel="noopener noreferrer"
								className="text-blue-600 hover:text-blue-700 underline"
							>
								View on Solana Explorer
							</a>
						</div>
					</div>
					<DialogFooter>
						<Button onClick={() => setOpen(false)} className="w-full">
							Close
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}

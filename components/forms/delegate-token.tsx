"use client";

import {
	type DelegateTokenParams,
	delegateTokens,
	delegatedBurn,
	delegatedTransfer,
	lockAsset,
	revokeStandardDelegate,
	unlockAsset,
} from "@/lib/token/delegate-token";
import useUmiStore from "@/store/useUmiStore";
import { zodResolver } from "@hookform/resolvers/zod";
import { TokenStandard } from "@metaplex-foundation/mpl-token-metadata";
import { findAssociatedTokenPda } from "@metaplex-foundation/mpl-toolbox";
import { publicKey } from "@metaplex-foundation/umi";
import { createWeb3JsRpc } from "@metaplex-foundation/umi-rpc-web3js";
import { getAccount, getMint } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import {
	ArrowRight,
	CheckCircle,
	Flame,
	Key,
	Lock,
	Send,
	Shield,
	ShieldCheck,
	Unlock,
	Users,
} from "lucide-react";
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
import { Checkbox } from "../ui/checkbox";
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
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "../ui/form";
import { Input } from "../ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "../ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";

// Zod schemas for different delegation operations
const delegateSchema = z.object({
	mintAddress: z.string().nonempty("Mint address is required"),
	delegateAddress: z.string().nonempty("Delegate address is required"),
	amount: z
		.number({ invalid_type_error: "Amount must be a number" })
		.min(0.000001, "Amount must be greater than 0"),
	ownerAddress: z.string().optional(),
	delegateType: z.enum(["spl", "default"]),
	tokenStandard: z.enum(["Fungible", "NonFungible"]),
});

const revokeSchema = z.object({
	mintAddress: z.string().nonempty("Mint address is required"),
	standardDelegate: z.string().nonempty("Delegate address is required"),
	ownerAddress: z.string().optional(),
	delegateType: z.enum(["spl", "default"]),
});

const transferSchema = z.object({
	mintAddress: z.string().nonempty("Mint address is required"),
	destinationOwnerAddress: z.string().nonempty("Destination address is required"),
	currentOwnerAddress: z.string().optional(),
	tokenStandard: z.enum(["Fungible", "NonFungible"]),
});

const burnSchema = z.object({
	mintAddress: z.string().nonempty("Mint address is required"),
	tokenOwnerAddress: z.string().optional(),
	tokenStandard: z.enum(["Fungible", "NonFungible"]),
});

const lockUnlockSchema = z.object({
	mintAddress: z.string().nonempty("Mint address is required"),
	tokenOwnerAddress: z.string().optional(),
	tokenStandard: z.enum(["Fungible", "NonFungible"]),
});

type DelegateValues = z.infer<typeof delegateSchema>;
type RevokeValues = z.infer<typeof revokeSchema>;
type TransferValues = z.infer<typeof transferSchema>;
type BurnValues = z.infer<typeof burnSchema>;
type LockUnlockValues = z.infer<typeof lockUnlockSchema>;

type OperationResult = {
	signature: string;
	amountDelegated?: bigint;
};

const DelegateTokens = () => {
	return (
		<div className="font-mono flex flex-col gap-6 max-w-6xl mx-auto p-4">
			<article className="mx-auto text-center space-y-2">
				<div className="flex items-center justify-center gap-2 mb-4">
					<Shield className="h-8 w-8 text-primary" />
					<h1 className="text-4xl font-bold font-inter">
						Token Delegation & Management
					</h1>
				</div>
				<p className="text-muted-foreground text-lg">
					Delegate spending authority, transfer, burn, and manage token permissions
				</p>
				<div className="flex items-center justify-center gap-2 text-amber-600">
					<Key className="h-4 w-4" />
					<p className="text-sm font-medium">
						Delegation gives others authority over your tokens - use with caution
					</p>
				</div>
			</article>

			<Tabs defaultValue="delegate" className="w-full">
				<TabsList className="grid w-full grid-cols-6 mb-6">
					<TabsTrigger value="delegate" className="flex items-center gap-2">
						<Shield className="h-4 w-4" />
						Delegate
					</TabsTrigger>
					<TabsTrigger value="revoke" className="flex items-center gap-2">
						<ShieldCheck className="h-4 w-4" />
						Revoke
					</TabsTrigger>
					<TabsTrigger value="transfer" className="flex items-center gap-2">
						<Send className="h-4 w-4" />
						Transfer
					</TabsTrigger>
					<TabsTrigger value="burn" className="flex items-center gap-2">
						<Flame className="h-4 w-4" />
						Burn
					</TabsTrigger>
					<TabsTrigger value="lock" className="flex items-center gap-2">
						<Lock className="h-4 w-4" />
						Lock
					</TabsTrigger>
					<TabsTrigger value="unlock" className="flex items-center gap-2">
						<Unlock className="h-4 w-4" />
						Unlock
					</TabsTrigger>
				</TabsList>

				<TabsContent value="delegate">
					<Card className="border-2">
						<CardHeader className="pb-4">
							<CardTitle className="flex items-center gap-2">
								<Shield className="h-5 w-5 text-primary" />
								Delegate Token Authority
							</CardTitle>
							<CardDescription>
								Grant spending authority to another wallet for your tokens
							</CardDescription>
						</CardHeader>
						<CardContent>
							<DelegateForm />
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="revoke">
					<Card className="border-2">
						<CardHeader className="pb-4">
							<CardTitle className="flex items-center gap-2">
								<ShieldCheck className="h-5 w-5 text-green-600" />
								Revoke Delegation
							</CardTitle>
							<CardDescription>
								Remove previously granted spending authority
							</CardDescription>
						</CardHeader>
						<CardContent>
							<RevokeForm />
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="transfer">
					<Card className="border-2">
						<CardHeader className="pb-4">
							<CardTitle className="flex items-center gap-2">
								<Send className="h-5 w-5 text-blue-600" />
								Delegated Transfer
							</CardTitle>
							<CardDescription>
								Transfer tokens using delegate authority (auto-revokes delegation)
							</CardDescription>
						</CardHeader>
						<CardContent>
							<TransferForm />
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="burn">
					<Card className="border-2">
						<CardHeader className="pb-4">
							<CardTitle className="flex items-center gap-2">
								<Flame className="h-5 w-5 text-red-600" />
								Delegated Burn
							</CardTitle>
							<CardDescription>
								Burn tokens using delegate authority
							</CardDescription>
						</CardHeader>
						<CardContent>
							<BurnForm />
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="lock">
					<Card className="border-2">
						<CardHeader className="pb-4">
							<CardTitle className="flex items-center gap-2">
								<Lock className="h-5 w-5 text-orange-600" />
								Lock Asset
							</CardTitle>
							<CardDescription>
								Lock tokens to prevent transfers (requires delegate authority)
							</CardDescription>
						</CardHeader>
						<CardContent>
							<LockForm />
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="unlock">
					<Card className="border-2">
						<CardHeader className="pb-4">
							<CardTitle className="flex items-center gap-2">
								<Unlock className="h-5 w-5 text-green-600" />
								Unlock Asset
							</CardTitle>
							<CardDescription>
								Unlock previously locked tokens (requires delegate authority)
							</CardDescription>
						</CardHeader>
						<CardContent>
							<UnlockForm />
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>
		</div>
	);
};

// Delegate Form Component
function DelegateForm() {
	const { umi } = useUmiStore.getState();

	const [decimals, setDecimals] = useState<number>(1);
	const [tokenBalance, setTokenBalance] = useState<bigint | null>(null);
	const [result, setResult] = useState<OperationResult | null>(null);
	const [open, setOpen] = useState(false);

	const connection = createWeb3JsRpc(umi, umi.rpc.getEndpoint()).connection;

	const form = useForm<DelegateValues>({
		resolver: zodResolver(delegateSchema),
		defaultValues: {
			mintAddress: "",
			delegateAddress: "",
			amount: 1,
			ownerAddress: "",
			delegateType: "default",
			tokenStandard: "Fungible",
		},
	});

	useEffect(() => {
		const sub = form.watch(async (vals, { name }) => {
			if ((name === "mintAddress" || name === "ownerAddress") && vals.mintAddress) {
				try {
					const mintPubkey = new PublicKey(vals.mintAddress);
					const info = await getMint(connection, mintPubkey);
					setDecimals(info.decimals);

					// Get token balance
					if (umi.identity?.publicKey) {
						const owner = vals.ownerAddress
							? new PublicKey(vals.ownerAddress)
							: new PublicKey(umi.identity.publicKey);

						const associatedTokenAddress = findAssociatedTokenPda(umi, {
							mint: publicKey(vals.mintAddress),
							owner: publicKey(owner.toString()),
						});

						try {
							const tokenAccount = await getAccount(connection, new PublicKey(associatedTokenAddress[0]));
							setTokenBalance(tokenAccount.amount);
						} catch {
							setTokenBalance(BigInt(0));
						}
					}
				} catch {
					setDecimals(1);
					setTokenBalance(null);
				}
			}
		});
		return () => sub.unsubscribe();
	}, [form, connection, umi]);

	const onSubmit = async (values: DelegateValues) => {
		try {
			const tx = await delegateTokens({
				mintAddress: values.mintAddress,
				delegateAddress: values.delegateAddress,
				amount: values.amount,
				ownerAddress: values.ownerAddress || undefined,
				delegateType: values.delegateType,
				tokenStandard: values.tokenStandard === "Fungible" ? TokenStandard.Fungible : TokenStandard.NonFungible,
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
			const maxAmount = Number(tokenBalance) / (10 ** decimals);
			form.setValue("amount", maxAmount);
		}
	};

	return (
		<>
			<Form {...form}>
				<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
											Balance: {(Number(tokenBalance) / (10 ** decimals)).toLocaleString()}
										</Badge>
									)}
								</div>
							</FormItem>
						)}
					/>

					<FormField
						control={form.control}
						name="delegateAddress"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Delegate Address</FormLabel>
								<FormControl>
									<Input
										{...field}
										placeholder="Enter delegate wallet address"
										className="font-mono"
									/>
								</FormControl>
								<FormDescription>
									The wallet that will receive spending authority
								</FormDescription>
								<FormMessage />
							</FormItem>
						)}
					/>

					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<FormField
							control={form.control}
							name="amount"
							render={({ field }) => (
								<FormItem>
									<FormLabel className="flex items-center justify-between">
										Amount to Delegate
										{tokenBalance !== null && (
											<Button
												type="button"
												variant="ghost"
												size="sm"
												onClick={setMaxAmount}
												className="h-auto p-1 text-xs text-muted-foreground hover:text-foreground"
											>
												Max: {(Number(tokenBalance) / (10 ** decimals)).toLocaleString()}
											</Button>
										)}
									</FormLabel>
									<FormControl>
										<Input
											type="number"
											step="any"
											{...field}
											onChange={(e) => field.onChange(Number(e.target.value))}
											placeholder="Enter amount"
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="delegateType"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Delegate Type</FormLabel>
									<Select onValueChange={field.onChange} defaultValue={field.value}>
										<FormControl>
											<SelectTrigger>
												<SelectValue placeholder="Select type" />
											</SelectTrigger>
										</FormControl>
										<SelectContent>
											<SelectItem value="default">Token Metadata Standard</SelectItem>
											<SelectItem value="spl">SPL Token Standard</SelectItem>
										</SelectContent>
									</Select>
									<FormDescription>
										Choose delegation standard
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>
					</div>

					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<FormField
							control={form.control}
							name="tokenStandard"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Token Standard</FormLabel>					<Select
										onValueChange={field.onChange}
										defaultValue={field.value}
									>
										<FormControl>
											<SelectTrigger>
												<SelectValue placeholder="Select standard" />
											</SelectTrigger>
										</FormControl>
										<SelectContent>
											<SelectItem value="Fungible">Fungible Token</SelectItem>
											<SelectItem value="NonFungible">Non-Fungible Token</SelectItem>
										</SelectContent>
									</Select>
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
											placeholder="Leave empty for connected wallet"
											className="font-mono"
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
					</div>

					<div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
						<div className="flex items-center gap-2 text-amber-800 dark:text-amber-200 mb-2">
							<Key className="h-4 w-4" />
							<span className="font-medium text-sm">Important</span>
						</div>
						<p className="text-sm text-amber-700 dark:text-amber-300">
							Delegating tokens gives another wallet spending authority over your tokens.
							The delegate can transfer, burn, or otherwise use your tokens. Only delegate to trusted parties.
						</p>
					</div>

					<Button
						type="submit"
						className="w-full"
						disabled={form.formState.isSubmitting}
						size="lg"
					>
						{form.formState.isSubmitting ? (
							<>
								<div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
								Delegating Tokens...
							</>
						) : (
							<>
								<Shield className="h-4 w-4 mr-2" />
								Delegate Tokens
							</>
						)}
					</Button>
				</form>
			</Form>

			<Dialog open={open} onOpenChange={setOpen}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<CheckCircle className="h-5 w-5 text-green-500" />
							Delegation Successful
						</DialogTitle>
						<DialogDescription>
							Your tokens have been successfully delegated.
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-3 py-4">
						{result && (
							<div className="space-y-2">
								<div className="flex justify-between items-center">
									<span className="text-sm font-medium">Transaction:</span>
									<Badge variant="outline" className="font-mono text-xs">
										{result.signature.slice(0, 8)}...{result.signature.slice(-8)}
									</Badge>
								</div>
								{result.amountDelegated && (
									<div className="flex justify-between items-center">
										<span className="text-sm font-medium">Amount Delegated:</span>
										<span className="text-sm font-mono">
											{(Number(result.amountDelegated) / (10 ** decimals)).toLocaleString()}
										</span>
									</div>
								)}
								<div className="text-xs text-muted-foreground">
									<a
										href={`https://explorer.solana.com/tx/${result.signature}?cluster=devnet`}
										target="_blank"
										rel="noopener noreferrer"
										className="text-blue-600 hover:text-blue-700 underline"
									>
										View on Solana Explorer
									</a>
								</div>
							</div>
						)}
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

// Revoke Form Component
function RevokeForm() {
	const { umi } = useUmiStore.getState();
	const [result, setResult] = useState<OperationResult | null>(null);
	const [open, setOpen] = useState(false);

	const form = useForm<RevokeValues>({
		resolver: zodResolver(revokeSchema),
		defaultValues: {
			mintAddress: "",
			standardDelegate: "",
			ownerAddress: "",
			delegateType: "default",
		},
	});

	const onSubmit = async (values: RevokeValues) => {
		try {
			const tx = await revokeStandardDelegate({
				mintAddress: values.mintAddress,
				standardDelegate: values.standardDelegate,
				ownerAddress: values.ownerAddress || undefined,
				delegateType: values.delegateType,
			});
			setResult(tx);
			setOpen(true);
			form.reset();
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			form.setError("mintAddress", { type: "manual", message });
		}
	};

	return (
		<>
			<Form {...form}>
				<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
							</FormItem>
						)}
					/>

					<FormField
						control={form.control}
						name="standardDelegate"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Delegate Address to Revoke</FormLabel>
								<FormControl>
									<Input
										{...field}
										placeholder="Enter delegate address to revoke"
										className="font-mono"
									/>
								</FormControl>
								<FormDescription>
									The wallet whose spending authority will be removed
								</FormDescription>
								<FormMessage />
							</FormItem>
						)}
					/>

					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<FormField
							control={form.control}
							name="delegateType"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Delegate Type</FormLabel>
									<Select onValueChange={field.onChange} defaultValue={field.value}>
										<FormControl>
											<SelectTrigger>
												<SelectValue placeholder="Select type" />
											</SelectTrigger>
										</FormControl>
										<SelectContent>
											<SelectItem value="default">Token Metadata Standard</SelectItem>
											<SelectItem value="spl">SPL Token Standard</SelectItem>
										</SelectContent>
									</Select>
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
											placeholder="Leave empty for connected wallet"
											className="font-mono"
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
					</div>

					<Button
						type="submit"
						className="w-full"
						disabled={form.formState.isSubmitting}
						size="lg"
					>
						{form.formState.isSubmitting ? (
							<>
								<div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
								Revoking Delegation...
							</>
						) : (
							<>
								<ShieldCheck className="h-4 w-4 mr-2" />
								Revoke Delegation
							</>
						)}
					</Button>
				</form>
			</Form>

			<Dialog open={open} onOpenChange={setOpen}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<CheckCircle className="h-5 w-5 text-green-500" />
							Delegation Revoked
						</DialogTitle>
						<DialogDescription>
							Delegation has been successfully revoked.
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-3 py-4">
						{result && (
							<div className="space-y-2">
								<div className="flex justify-between items-center">
									<span className="text-sm font-medium">Transaction:</span>
									<Badge variant="outline" className="font-mono text-xs">
										{result.signature.slice(0, 8)}...{result.signature.slice(-8)}
									</Badge>
								</div>
								<div className="text-xs text-muted-foreground">
									<a
										href={`https://explorer.solana.com/tx/${result.signature}?cluster=devnet`}
										target="_blank"
										rel="noopener noreferrer"
										className="text-blue-600 hover:text-blue-700 underline"
									>
										View on Solana Explorer
									</a>
								</div>
							</div>
						)}
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

// Transfer Form Component
function TransferForm() {
	const { umi } = useUmiStore.getState();
	const [result, setResult] = useState<OperationResult | null>(null);
	const [open, setOpen] = useState(false);

	const form = useForm<TransferValues>({
		resolver: zodResolver(transferSchema),
		defaultValues: {
			mintAddress: "",
			destinationOwnerAddress: "",
			currentOwnerAddress: "",
			tokenStandard: "Fungible" as const,
		},
	});

	const onSubmit = async (values: TransferValues) => {
		try {
			const tx = await delegatedTransfer({
				mintAddress: values.mintAddress,
				destinationOwnerAddress: values.destinationOwnerAddress,
				currentOwnerAddress: values.currentOwnerAddress || undefined,
				tokenStandard: values.tokenStandard === "Fungible" ? TokenStandard.Fungible : TokenStandard.NonFungible,
			});
			setResult(tx);
			setOpen(true);
			form.reset();
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			form.setError("mintAddress", { type: "manual", message });
		}
	};

	return (
		<>
			<Form {...form}>
				<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
							</FormItem>
						)}
					/>

					<FormField
						control={form.control}
						name="destinationOwnerAddress"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Destination Address</FormLabel>
								<FormControl>
									<Input
										{...field}
										placeholder="Enter destination wallet address"
										className="font-mono"
									/>
								</FormControl>
								<FormDescription>
									The wallet that will receive the tokens
								</FormDescription>
								<FormMessage />
							</FormItem>
						)}
					/>

					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<FormField
							control={form.control}
							name="tokenStandard"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Token Standard</FormLabel>
									<Select onValueChange={field.onChange} defaultValue={field.value}>
										<FormControl>
											<SelectTrigger>
												<SelectValue placeholder="Select standard" />
											</SelectTrigger>
										</FormControl>
										<SelectContent>
											<SelectItem value="Fungible">Fungible Token</SelectItem>
											<SelectItem value="NonFungible">Non-Fungible Token</SelectItem>
										</SelectContent>
									</Select>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="currentOwnerAddress"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Current Owner (optional)</FormLabel>
									<FormControl>
										<Input
											{...field}
											placeholder="Leave empty for connected wallet"
											className="font-mono"
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
					</div>

					<div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
						<div className="flex items-center gap-2 text-blue-800 dark:text-blue-200 mb-2">
							<ArrowRight className="h-4 w-4" />
							<span className="font-medium text-sm">Note</span>
						</div>
						<p className="text-sm text-blue-700 dark:text-blue-300">
							This transfer uses delegate authority and will automatically revoke the delegation after the transfer.
						</p>
					</div>

					<Button
						type="submit"
						className="w-full"
						disabled={form.formState.isSubmitting}
						size="lg"
					>
						{form.formState.isSubmitting ? (
							<>
								<div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
								Transferring Tokens...
							</>
						) : (
							<>
								<Send className="h-4 w-4 mr-2" />
								Transfer with Delegate Authority
							</>
						)}
					</Button>
				</form>
			</Form>

			<Dialog open={open} onOpenChange={setOpen}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<CheckCircle className="h-5 w-5 text-green-500" />
							Transfer Successful
						</DialogTitle>
						<DialogDescription>
							Tokens have been successfully transferred using delegate authority.
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-3 py-4">
						{result && (
							<div className="space-y-2">
								<div className="flex justify-between items-center">
									<span className="text-sm font-medium">Transaction:</span>
									<Badge variant="outline" className="font-mono text-xs">
										{result.signature.slice(0, 8)}...{result.signature.slice(-8)}
									</Badge>
								</div>
								<div className="text-xs text-muted-foreground">
									<a
										href={`https://explorer.solana.com/tx/${result.signature}?cluster=devnet`}
										target="_blank"
										rel="noopener noreferrer"
										className="text-blue-600 hover:text-blue-700 underline"
									>
										View on Solana Explorer
									</a>
								</div>
							</div>
						)}
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

// Burn Form Component
function BurnForm() {
	const { umi } = useUmiStore.getState();
	const [result, setResult] = useState<OperationResult | null>(null);
	const [open, setOpen] = useState(false);

	const form = useForm<BurnValues>({
		resolver: zodResolver(burnSchema),
		defaultValues: {
			mintAddress: "",
			tokenOwnerAddress: "",
			tokenStandard: "Fungible",
		},
	});

	const onSubmit = async (values: BurnValues) => {
		try {
			const tx = await delegatedBurn({
				mintAddress: values.mintAddress,
				tokenOwnerAddress: values.tokenOwnerAddress || undefined,
				tokenStandard: values.tokenStandard === "Fungible" ? TokenStandard.Fungible : TokenStandard.NonFungible,
			});
			setResult(tx);
			setOpen(true);
			form.reset();
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			form.setError("mintAddress", { type: "manual", message });
		}
	};

	return (
		<>
			<Form {...form}>
				<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
							</FormItem>
						)}
					/>

					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<FormField
							control={form.control}
							name="tokenStandard"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Token Standard</FormLabel>
									<Select onValueChange={field.onChange} defaultValue={field.value}>
										<FormControl>
											<SelectTrigger>
												<SelectValue placeholder="Select standard" />
											</SelectTrigger>
										</FormControl>
										<SelectContent>
											<SelectItem value="Fungible">Fungible Token</SelectItem>
											<SelectItem value="NonFungible">Non-Fungible Token</SelectItem>
										</SelectContent>
									</Select>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="tokenOwnerAddress"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Token Owner (optional)</FormLabel>
									<FormControl>
										<Input
											{...field}
											placeholder="Leave empty for connected wallet"
											className="font-mono"
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
					</div>

					<div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
						<div className="flex items-center gap-2 text-red-800 dark:text-red-200 mb-2">
							<Flame className="h-4 w-4" />
							<span className="font-medium text-sm">Warning</span>
						</div>
						<p className="text-sm text-red-700 dark:text-red-300">
							This action will permanently destroy the tokens using delegate authority. This cannot be undone.
						</p>
					</div>

					<Button
						type="submit"
						variant="destructive"
						className="w-full"
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
								Burn with Delegate Authority
							</>
						)}
					</Button>
				</form>
			</Form>

			<Dialog open={open} onOpenChange={setOpen}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<CheckCircle className="h-5 w-5 text-green-500" />
							Burn Successful
						</DialogTitle>
						<DialogDescription>
							Tokens have been successfully burned using delegate authority.
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-3 py-4">
						{result && (
							<div className="space-y-2">
								<div className="flex justify-between items-center">
									<span className="text-sm font-medium">Transaction:</span>
									<Badge variant="outline" className="font-mono text-xs">
										{result.signature.slice(0, 8)}...{result.signature.slice(-8)}
									</Badge>
								</div>
								<div className="text-xs text-muted-foreground">
									<a
										href={`https://explorer.solana.com/tx/${result.signature}?cluster=devnet`}
										target="_blank"
										rel="noopener noreferrer"
										className="text-blue-600 hover:text-blue-700 underline"
									>
										View on Solana Explorer
									</a>
								</div>
							</div>
						)}
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

// Lock Form Component
function LockForm() {
	const { umi } = useUmiStore.getState();
	const [result, setResult] = useState<OperationResult | null>(null);
	const [open, setOpen] = useState(false);

	const form = useForm<LockUnlockValues>({
		resolver: zodResolver(lockUnlockSchema),
		defaultValues: {
			mintAddress: "",
			tokenOwnerAddress: "",
			tokenStandard: "NonFungible",
		},
	});

	const onSubmit = async (values: LockUnlockValues) => {
		try {
			const tx = await lockAsset({
				mintAddress: values.mintAddress,
				tokenOwnerAddress: values.tokenOwnerAddress || undefined,
				tokenStandard: values.tokenStandard === "Fungible" ? TokenStandard.Fungible : TokenStandard.NonFungible,
			});
			setResult(tx);
			setOpen(true);
			form.reset();
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			form.setError("mintAddress", { type: "manual", message });
		}
	};

	return (
		<>
			<Form {...form}>
				<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
							</FormItem>
						)}
					/>

					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<FormField
							control={form.control}
							name="tokenStandard"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Token Standard</FormLabel>
									<Select onValueChange={field.onChange} defaultValue={field.value}>
										<FormControl>
											<SelectTrigger>
												<SelectValue placeholder="Select standard" />
											</SelectTrigger>
										</FormControl>
										<SelectContent>
											<SelectItem value="Fungible">Fungible Token</SelectItem>
											<SelectItem value="NonFungible">Non-Fungible Token</SelectItem>
										</SelectContent>
									</Select>
									<FormDescription>
										Locking is typically used for NFTs
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="tokenOwnerAddress"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Token Owner (optional)</FormLabel>
									<FormControl>
										<Input
											{...field}
											placeholder="Leave empty for connected wallet"
											className="font-mono"
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
					</div>

					<div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
						<div className="flex items-center gap-2 text-orange-800 dark:text-orange-200 mb-2">
							<Lock className="h-4 w-4" />
							<span className="font-medium text-sm">Important</span>
						</div>
						<p className="text-sm text-orange-700 dark:text-orange-300">
							Locking an asset prevents transfers until it's unlocked. You must have delegate authority to lock assets.
						</p>
					</div>

					<Button
						type="submit"
						className="w-full"
						disabled={form.formState.isSubmitting}
						size="lg"
					>
						{form.formState.isSubmitting ? (
							<>
								<div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
								Locking Asset...
							</>
						) : (
							<>
								<Lock className="h-4 w-4 mr-2" />
								Lock Asset
							</>
						)}
					</Button>
				</form>
			</Form>

			<Dialog open={open} onOpenChange={setOpen}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<CheckCircle className="h-5 w-5 text-green-500" />
							Asset Locked
						</DialogTitle>
						<DialogDescription>
							The asset has been successfully locked.
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-3 py-4">
						{result && (
							<div className="space-y-2">
								<div className="flex justify-between items-center">
									<span className="text-sm font-medium">Transaction:</span>
									<Badge variant="outline" className="font-mono text-xs">
										{result.signature.slice(0, 8)}...{result.signature.slice(-8)}
									</Badge>
								</div>
								<div className="text-xs text-muted-foreground">
									<a
										href={`https://explorer.solana.com/tx/${result.signature}?cluster=devnet`}
										target="_blank"
										rel="noopener noreferrer"
										className="text-blue-600 hover:text-blue-700 underline"
									>
										View on Solana Explorer
									</a>
								</div>
							</div>
						)}
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

// Unlock Form Component
function UnlockForm() {
	const { umi } = useUmiStore.getState();
	const [result, setResult] = useState<OperationResult | null>(null);
	const [open, setOpen] = useState(false);

	const form = useForm<LockUnlockValues>({
		resolver: zodResolver(lockUnlockSchema),
		defaultValues: {
			mintAddress: "",
			tokenOwnerAddress: "",
			tokenStandard: "NonFungible",
		},
	});

	const onSubmit = async (values: LockUnlockValues) => {
		try {
			const tx = await unlockAsset({
				mintAddress: values.mintAddress,
				tokenOwnerAddress: values.tokenOwnerAddress || undefined,
				tokenStandard: values.tokenStandard === "Fungible" ? TokenStandard.Fungible : TokenStandard.NonFungible,
			});
			setResult(tx);
			setOpen(true);
			form.reset();
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			form.setError("mintAddress", { type: "manual", message });
		}
	};

	return (
		<>
			<Form {...form}>
				<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
							</FormItem>
						)}
					/>

					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<FormField
							control={form.control}
							name="tokenStandard"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Token Standard</FormLabel>
									<Select onValueChange={field.onChange} defaultValue={field.value}>
										<FormControl>
											<SelectTrigger>
												<SelectValue placeholder="Select standard" />
											</SelectTrigger>
										</FormControl>
										<SelectContent>
											<SelectItem value="Fungible">Fungible Token</SelectItem>
											<SelectItem value="NonFungible">Non-Fungible Token</SelectItem>
										</SelectContent>
									</Select>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="tokenOwnerAddress"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Token Owner (optional)</FormLabel>
									<FormControl>
										<Input
											{...field}
											placeholder="Leave empty for connected wallet"
											className="font-mono"
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
					</div>

					<div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
						<div className="flex items-center gap-2 text-green-800 dark:text-green-200 mb-2">
							<Unlock className="h-4 w-4" />
							<span className="font-medium text-sm">Note</span>
						</div>
						<p className="text-sm text-green-700 dark:text-green-300">
							Unlocking will restore transfer capabilities to the asset. You must have delegate authority to unlock assets.
						</p>
					</div>

					<Button
						type="submit"
						className="w-full"
						disabled={form.formState.isSubmitting}
						size="lg"
					>
						{form.formState.isSubmitting ? (
							<>
								<div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
								Unlocking Asset...
							</>
						) : (
							<>
								<Unlock className="h-4 w-4 mr-2" />
								Unlock Asset
							</>
						)}
					</Button>
				</form>
			</Form>

			<Dialog open={open} onOpenChange={setOpen}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<CheckCircle className="h-5 w-5 text-green-500" />
							Asset Unlocked
						</DialogTitle>
						<DialogDescription>
							The asset has been successfully unlocked.
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-3 py-4">
						{result && (
							<div className="space-y-2">
								<div className="flex justify-between items-center">
									<span className="text-sm font-medium">Transaction:</span>
									<Badge variant="outline" className="font-mono text-xs">
										{result.signature.slice(0, 8)}...{result.signature.slice(-8)}
									</Badge>
								</div>
								<div className="text-xs text-muted-foreground">
									<a
										href={`https://explorer.solana.com/tx/${result.signature}?cluster=devnet`}
										target="_blank"
										rel="noopener noreferrer"
										className="text-blue-600 hover:text-blue-700 underline"
									>
										View on Solana Explorer
									</a>
								</div>
							</div>
						)}
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

export default DelegateTokens;

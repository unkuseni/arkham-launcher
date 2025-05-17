"use client";
import { transferAsset } from "@/lib/token/transfer-token";
import useUmiStore, { ConnectionStatus } from "@/store/useUmiStore";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "../ui/form";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";

const TransferTokens = () => {
	return (
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
						Fill in the details below to transfer your SPL tokens to another wallet.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<TransferTokenForm />
				</CardContent>
			</Card>
		</div>
	);
};

type FormValues = z.infer<typeof formSchema>;


const formSchema = z.object({
	recipient: z.string().min(1, "Recipient is required"),
	amount: z.number().min(0, "Amount must be greater than 0"),
	token: z.object({
		mint: z.string().min(1, "Mint is required"),
		decimals: z.number().min(0, "Decimals must be greater than 0"),
	})
})


type RawBalance = Awaited<ReturnType<typeof useUmiStore.prototype.getTokenBalances>>[number];

const TransferTokenForm = () => {
	const { umi, signer, connectionStatus, getTokenBalances } = useUmiStore();
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
	useEffect(() => {
		if (signer && connectionStatus === ConnectionStatus.CONNECTED) {
			getTokenBalances()
				.then((list) => setTokens(list))
				.catch((err) => console.error("Failed to load token balances:", err));
		}
	}, [getTokenBalances, signer, connectionStatus]);

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
			const rawAmount = values.amount * 10 ** values.token.decimals;

			// Add logging to debug the transaction process
			console.log("Sending transfer:", {
				mint: values.token.mint,
				amount: rawAmount,
				recipient: values.recipient,
			});

			const signature = await transferAsset(
				{
					mint: values.token.mint,
					amount: rawAmount,
					recipient: values.recipient,
				},
				umi,
			);

			// Explicitly log the transaction result for debugging
			console.log("Transfer successful, signature:", signature);

			// Ensure we're getting a string value for txSignature
			setTxSignature(
				typeof signature === "string" ? signature : String(signature),
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
		} catch (err: any) {
			console.error("Transfer error details:", err);
			setError(err.message || "Transaction failed");
		} finally {
			setIsSubmitting(false);
		}

		// Show wallet connection status
		if (connectionStatus === ConnectionStatus.CONNECTING) {
			return (
				<div className="flex justify-center p-6">Connecting wallet...</div>
			);
		}
	}

	if (!signer) {
		return (
			<div className="flex flex-col items-center justify-center p-6 space-y-4">
				<Badge variant="outline" className="px-3 py-1 text-yellow-600 border-yellow-600">
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
			{txSignature && (
				<div className="p-4 mb-4 border border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-900 rounded-md">
					<p className="text-sm font-medium text-green-800 dark:text-green-400">
						Transaction successful!{" "}
						<a
							href={`https://explorer.solana.com/tx/${txSignature}`}
							target="_blank"
							rel="noopener noreferrer"
							className="underline hover:no-underline"
						>
							View on Solana Explorer
						</a>
					</p>
				</div>
			)}

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
											const token = tokens.find(t => t.mint.toString() === mint);
											if (token) {
												field.onChange({
													mint,
													decimals: token.decimals
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
														const balance = Number(token.amount) / (10 ** token.decimals);

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
																			<p className="font-mono text-xs">{mintAddress}</p>
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
										onChange={(e) => field.onChange(Number.parseFloat(e.target.value) || 0)}
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
	)
}
export default TransferTokens;

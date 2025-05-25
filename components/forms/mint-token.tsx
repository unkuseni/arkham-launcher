"use client";
import {
	type MintToMultipleRecipient,
	type MintToMultipleResult,
	batchRecipients,
	mintSPLTokens,
	mintSPLTokensToMultiple,
} from "@/lib/token/mint-token";
import useUmiStore from "@/store/useUmiStore";
import { zodResolver } from "@hookform/resolvers/zod";
import { createWeb3JsRpc } from "@metaplex-foundation/umi-rpc-web3js";
import { getMint } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import { Coins, Plus, Trash2, Upload, Users } from "lucide-react";
import React, { useEffect, useState } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Textarea } from "../ui/textarea";

// Zod schema for single mint form
const singleMintSchema = z.object({
	mintAddress: z.string().nonempty("Mint address is required"),
	amount: z
		.number({ invalid_type_error: "Amount must be a number" })
		.min(1, "Amount must be at least 1"),
	ownerAddress: z.string().optional(),
});

// Zod schema for multi mint form
const multiMintSchema = z.object({
	mintAddress: z.string().nonempty("Mint address is required"),
	recipients: z
		.array(
			z.object({
				address: z.string().nonempty("Address is required"),
				amount: z.number().min(1, "Amount must be at least 1"),
			}),
		)
		.min(1, "At least one recipient is required"),
	bulkInput: z.string().optional(),
});

type SingleMintValues = z.infer<typeof singleMintSchema>;
type MultiMintValues = z.infer<typeof multiMintSchema>;
type MintResult = {
	signature: string;
	amountMinted: bigint;
	recipientAta: string;
};

export default function MintTokens() {
	return (
		<div className="font-mono flex flex-col gap-6 max-w-6xl mx-auto p-4">
			<article className="mx-auto text-center space-y-2">
				<div className="flex items-center justify-center gap-2 mb-4">
					<Coins className="h-8 w-8 text-primary" />
					<h1 className="text-4xl font-bold font-inter">Mint SPL Tokens</h1>
				</div>
				<p className="text-muted-foreground text-lg">
					Mint tokens to single or multiple recipients with ease
				</p>
			</article>

			<Tabs defaultValue="single" className="w-full">
				<TabsList className="grid w-full grid-cols-2 mb-6">
					<TabsTrigger value="single" className="flex items-center gap-2">
						<Coins className="h-4 w-4" />
						Single Mint
					</TabsTrigger>
					<TabsTrigger value="multiple" className="flex items-center gap-2">
						<Users className="h-4 w-4" />
						Mint to Multiple
					</TabsTrigger>
				</TabsList>

				<TabsContent value="single">
					<Card className="border-2">
						<CardHeader className="pb-4">
							<CardTitle className="flex items-center gap-2">
								<Coins className="h-5 w-5" />
								Single Mint
							</CardTitle>
							<CardDescription>
								Mint tokens to a single recipient address.
							</CardDescription>
						</CardHeader>
						<CardContent>
							<SingleMintForm />
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="multiple">
					<Card className="border-2">
						<CardHeader className="pb-4">
							<CardTitle className="flex items-center gap-2">
								<Users className="h-5 w-5" />
								Mint to Multiple Recipients
							</CardTitle>
							<CardDescription>
								Mint tokens to multiple recipients in a single transaction.
								Maximum 20 recipients per batch.
							</CardDescription>
						</CardHeader>
						<CardContent>
							<MultiMintForm />
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>
		</div>
	);
}

function SingleMintForm() {
	const { umi } = useUmiStore.getState();

	const [decimals, setDecimals] = useState<number>(1);
	const [result, setResult] = useState<MintResult | null>(null);
	const [open, setOpen] = useState(false);

	const connection = createWeb3JsRpc(umi, umi.rpc.getEndpoint()).connection;

	const form = useForm<SingleMintValues>({
		resolver: zodResolver(singleMintSchema),
		defaultValues: { mintAddress: "", amount: 1, ownerAddress: "" },
	});

	useEffect(() => {
		const sub = form.watch(async (vals, { name }) => {
			if (name === "mintAddress" && vals.mintAddress) {
				try {
					const mintPubkey = new PublicKey(vals.mintAddress);
					const info = await getMint(connection, mintPubkey);
					setDecimals(info.decimals);
				} catch {
					setDecimals(1);
				}
			}
		});
		return () => sub.unsubscribe();
	}, [form, connection]);

	const onSubmit = async (values: SingleMintValues) => {
		try {
			const tx = await mintSPLTokens({
				mintAddress: values.mintAddress,
				amount: values.amount * 10 ** decimals,
				recipientAddress: values.ownerAddress || undefined,
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
								<FormLabel>Mint Address</FormLabel>
								<FormControl>
									<Input
										{...field}
										placeholder="Enter mint address"
										className="font-mono"
									/>
								</FormControl>
								<FormMessage />
								{decimals > 1 && (
									<div className="flex items-center gap-2 mt-1">
										<Badge variant="secondary" className="text-xs">
											{decimals} decimals
										</Badge>
									</div>
								)}
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
										{...field}
										onChange={(e) => field.onChange(Number(e.target.value))}
										placeholder="Enter amount to mint"
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
								<FormLabel>Recipient Address (optional)</FormLabel>
								<FormControl>
									<Input
										{...field}
										placeholder="Leave empty to mint to connected wallet"
										className="font-mono"
									/>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>

					<Button
						type="submit"
						className="w-full"
						disabled={form.formState.isSubmitting}
						size="lg"
					>
						{form.formState.isSubmitting ? (
							<>
								<div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
								Minting...
							</>
						) : (
							"Mint Tokens"
						)}
					</Button>
				</form>
			</Form>

			<Dialog open={open} onOpenChange={setOpen}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<Coins className="h-5 w-5 text-green-500" />
							Mint Successful
						</DialogTitle>
						<DialogDescription>
							Your tokens have been minted successfully.
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-3 py-4">
						<div className="space-y-1">
							<p className="text-sm font-medium">Amount Minted:</p>
							<Badge variant="outline" className="font-mono">
								{result?.amountMinted.toString()}
							</Badge>
						</div>
						<div className="space-y-1">
							<p className="text-sm font-medium">Recipient ATA:</p>
							<code className="text-xs bg-muted p-2 rounded break-all block">
								{result?.recipientAta}
							</code>
						</div>
						<div className="space-y-1">
							<p className="text-sm font-medium">Transaction Signature:</p>
							<code className="text-xs bg-muted p-2 rounded break-all block">
								{result?.signature}
							</code>
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

function MultiMintForm() {
	const { umi } = useUmiStore.getState();

	const [decimals, setDecimals] = useState<number>(1);
	const [result, setResult] = useState<MintToMultipleResult | null>(null);
	const [open, setOpen] = useState(false);
	const [isProcessing, setIsProcessing] = useState(false);

	const connection = createWeb3JsRpc(umi, umi.rpc.getEndpoint()).connection;

	const form = useForm<MultiMintValues>({
		resolver: zodResolver(multiMintSchema),
		defaultValues: {
			mintAddress: "",
			recipients: [{ address: "", amount: 1 }],
			bulkInput: "",
		},
	});

	const { fields, append, remove } = useFieldArray({
		control: form.control,
		name: "recipients",
	});

	useEffect(() => {
		const sub = form.watch(async (vals, { name }) => {
			if (name === "mintAddress" && vals.mintAddress) {
				try {
					const mintPubkey = new PublicKey(vals.mintAddress);
					const info = await getMint(connection, mintPubkey);
					setDecimals(info.decimals);
				} catch {
					setDecimals(1);
				}
			}
		});
		return () => sub.unsubscribe();
	}, [form, connection]);

	const parseBulkInput = (input: string): MintToMultipleRecipient[] => {
		const lines = input
			.trim()
			.split("\n")
			.filter((line) => line.trim());
		const recipients: MintToMultipleRecipient[] = [];

		for (const line of lines) {
			// Support formats: "address,amount" or "address amount" or just "address" (default amount 1)
			const parts = line.trim().split(/[,\s]+/);
			if (parts.length >= 1) {
				const address = parts[0].trim();
				const amount = parts.length > 1 ? Number.parseInt(parts[1]) || 1 : 1;
				if (address) {
					recipients.push({ address, amount });
				}
			}
		}

		return recipients;
	};

	const handleBulkImport = () => {
		const bulkInput = form.getValues("bulkInput");
		if (bulkInput) {
			const recipients = parseBulkInput(bulkInput);
			if (recipients.length > 0) {
				form.setValue("recipients", recipients);
				form.setValue("bulkInput", "");
			}
		}
	};

	const addRecipient = () => {
		if (fields.length < 20) {
			append({ address: "", amount: 1 });
		}
	};

	const onSubmit = async (values: MultiMintValues) => {
		setIsProcessing(true);
		try {
			const adjustedRecipients = values.recipients.map((recipient) => ({
				...recipient,
				amount: recipient.amount * 10 ** decimals,
			}));

			const tx = await mintSPLTokensToMultiple({
				mintAddress: values.mintAddress,
				recipients: adjustedRecipients,
			});

			setResult(tx);
			setOpen(true);
			form.reset({
				mintAddress: "",
				recipients: [{ address: "", amount: 1 }],
				bulkInput: "",
			});
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			form.setError("mintAddress", { type: "manual", message });
		} finally {
			setIsProcessing(false);
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
								<FormLabel>Mint Address</FormLabel>
								<FormControl>
									<Input
										{...field}
										placeholder="Enter mint address"
										className="font-mono"
									/>
								</FormControl>
								<FormMessage />
								{decimals > 1 && (
									<div className="flex items-center gap-2 mt-1">
										<Badge variant="secondary" className="text-xs">
											{decimals} decimals
										</Badge>
									</div>
								)}
							</FormItem>
						)}
					/>

					{/* Bulk Import Section */}
					<div className="space-y-4 p-4 border rounded-lg bg-muted/50">
						<div className="flex items-center gap-2">
							<Upload className="h-4 w-4" />
							<h3 className="font-medium">Bulk Import (Optional)</h3>
						</div>
						<FormField
							control={form.control}
							name="bulkInput"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Paste recipient data</FormLabel>
									<FormControl>
										<Textarea
											{...field}
											placeholder="Format: address,amount (one per line)&#10;Example:&#10;11111111111111111111111111111111,100&#10;22222222222222222222222222222222,200"
											className="font-mono text-sm"
											rows={4}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
						<Button
							type="button"
							variant="secondary"
							onClick={handleBulkImport}
							className="w-full"
							disabled={!form.watch("bulkInput")}
						>
							<Upload className="h-4 w-4 mr-2" />
							Import Recipients
						</Button>
					</div>

					{/* Manual Recipients */}
					<div className="space-y-4">
						<div className="flex items-center justify-between">
							<h3 className="font-medium">Recipients ({fields.length}/20)</h3>
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={addRecipient}
								disabled={fields.length >= 20}
							>
								<Plus className="h-4 w-4 mr-1" />
								Add
							</Button>
						</div>

						<div className="space-y-3 max-h-96 overflow-y-auto">
							{fields.map((field, index) => (
								<div key={field.id} className="flex gap-2 items-end">
									<FormField
										control={form.control}
										name={`recipients.${index}.address`}
										render={({ field }) => (
											<FormItem className="flex-1">
												{index === 0 && <FormLabel>Address</FormLabel>}
												<FormControl>
													<Input
														{...field}
														placeholder="Recipient address"
														className="font-mono text-sm"
													/>
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>
									<FormField
										control={form.control}
										name={`recipients.${index}.amount`}
										render={({ field }) => (
											<FormItem className="w-24">
												{index === 0 && <FormLabel>Amount</FormLabel>}
												<FormControl>
													<Input
														type="number"
														{...field}
														onChange={(e) =>
															field.onChange(Number(e.target.value))
														}
														placeholder="Amount"
														className="text-sm"
													/>
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>
									{fields.length > 1 && (
										<Button
											type="button"
											variant="ghost"
											size="sm"
											onClick={() => remove(index)}
											className="text-red-500 hover:text-red-700 p-2"
										>
											<Trash2 className="h-4 w-4" />
										</Button>
									)}
								</div>
							))}
						</div>
					</div>

					<Button
						type="submit"
						className="w-full"
						disabled={form.formState.isSubmitting || isProcessing}
						size="lg"
					>
						{form.formState.isSubmitting || isProcessing ? (
							<>
								<div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
								Minting to {fields.length} recipients...
							</>
						) : (
							<>
								<Users className="h-4 w-4 mr-2" />
								Mint to {fields.length} Recipients
							</>
						)}
					</Button>
				</form>
			</Form>

			<Dialog open={open} onOpenChange={setOpen}>
				<DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<Users className="h-5 w-5 text-green-500" />
							Multi-Mint Successful
						</DialogTitle>
						<DialogDescription>
							Tokens have been minted to multiple recipients.
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4 py-4">
						<div className="grid grid-cols-2 gap-4">
							<div className="space-y-1">
								<p className="text-sm font-medium">Total Minted:</p>
								<Badge variant="outline" className="font-mono">
									{result?.totalAmountMinted.toString()}
								</Badge>
							</div>
							<div className="space-y-1">
								<p className="text-sm font-medium">Recipients:</p>
								<Badge variant="outline">{result?.recipients.length}</Badge>
							</div>
						</div>

						<div className="space-y-1">
							<p className="text-sm font-medium">Transaction Signature:</p>
							<code className="text-xs bg-muted p-2 rounded break-all block">
								{result?.signature}
							</code>
						</div>

						{result?.recipients && result.recipients.length > 0 && (
							<div className="space-y-2">
								<p className="text-sm font-medium">Successful Recipients:</p>
								<div className="max-h-48 overflow-y-auto space-y-1">
									{result.recipients.map((recipient) => (
										<div
											key={`${recipient.address}-${recipient.amountMinted}`}
											className="text-xs bg-muted p-2 rounded flex justify-between items-center"
										>
											<span className="font-mono truncate flex-1 mr-2">
												{recipient.address}
											</span>
											<Badge variant="secondary" className="text-xs">
												{recipient.amountMinted.toString()}
											</Badge>
										</div>
									))}
								</div>
							</div>
						)}

						{result?.failedRecipients && result.failedRecipients.length > 0 && (
							<div className="space-y-2">
								<p className="text-sm font-medium text-red-600">
									Failed Recipients:
								</p>
								<div className="max-h-32 overflow-y-auto space-y-1">
									{result.failedRecipients.map((failed) => (
										<div
											key={`failed-${failed.address}`}
											className="text-xs bg-red-50 dark:bg-red-900/20 p-2 rounded"
										>
											<p className="font-mono text-red-800 dark:text-red-200">
												{failed.address}
											</p>
											<p className="text-red-600 dark:text-red-400">
												{failed.error}
											</p>
										</div>
									))}
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

// Keep the old MintForm for backward compatibility but it won't be used

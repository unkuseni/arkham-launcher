"use client";
import { mintSPLTokens } from "@/lib/token/mint-token";
import useUmiStore from "@/store/useUmiStore";
import { zodResolver } from "@hookform/resolvers/zod";
import { createWeb3JsRpc } from "@metaplex-foundation/umi-rpc-web3js";
import { getMint } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import React, { useEffect, useState } from "react";
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

// Zod schema for mint form
const formSchema = z.object({
	mintAddress: z.string().nonempty("Mint address is required"),
	amount: z
		.number({ invalid_type_error: "Amount must be a number" })
		.min(1, "Amount must be at least 1"),
	ownerAddress: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;
type MintResult = { signature: string; amountMinted: bigint };

export default function MintTokens() {
	return (
		<div className="font-mono flex flex-col gap-4 max-w-4xl mx-auto">
			<article className="mx-auto text-center">
				<h1 className="text-4xl font-bold py-2.5 px-4 capitalize font-inter">
					Mint SPL Tokens
				</h1>
				<p>Mint additional tokens to a specified account.</p>
			</article>
			<Card>
				<CardHeader>
					<CardTitle>Mint Tokens</CardTitle>
					<CardDescription>
						Fill in the details below to mint your SPL tokens.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<MintForm />
				</CardContent>
			</Card>
		</div>
	);
}

function MintForm() {
	const { umi } = useUmiStore.getState();

	const [decimals, setDecimals] = useState<number>(1);
	const [result, setResult] = useState<MintResult | null>(null);
	const [open, setOpen] = useState(false);

	const connection = createWeb3JsRpc(umi, umi.rpc.getEndpoint()).connection;

	const form = useForm<FormValues>({
		resolver: zodResolver(formSchema),
		defaultValues: { mintAddress: "", amount: 1, ownerAddress: "" },
	});

	useEffect(() => {
		const sub = form.watch(async (vals, { name }) => {
			if (name === "mintAddress" && vals.mintAddress) {
				try {
					const mintPubkey = new PublicKey(vals.mintAddress);
					// use Umi’s connection under the hood
					const info = await getMint(connection, mintPubkey);
					setDecimals(info.decimals);
				} catch {
					setDecimals(1);
				}
			}
		});
		return () => sub.unsubscribe();
	}, [form, connection]);

	const onSubmit = async (values: FormValues) => {
		try {
			const owner = values.ownerAddress || "";
			const tx = await mintSPLTokens(
				values.mintAddress,
				values.amount * 10 ** decimals,
				owner,
			);
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
									<Input {...field} placeholder="Enter mint address" />
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
										{...field}
										onChange={(e) => field.onChange(Number(e.target.value))}
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
									<Input {...field} placeholder="Connected wallet if empty" />
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>

					<Button
						type="submit"
						className="w-full"
						disabled={form.formState.isSubmitting}
					>
						{form.formState.isSubmitting ? "Minting..." : "Mint Tokens"}
					</Button>
				</form>
			</Form>

			<Dialog open={open} onOpenChange={setOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Mint Successful</DialogTitle>
						<DialogDescription>
							Your tokens have been minted successfully.
						</DialogDescription>
					</DialogHeader>
					<div className="py-2">
						<p>Amount Minted: {result?.amountMinted.toString()}</p>
						<p>
							Signature: <code>{result?.signature}</code>
						</p>
					</div>
					<DialogFooter>
						<Button onClick={() => setOpen(false)}>Close</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}

"use client";
import {
	type FreezeTokenParams,
	type ThawTokenParams,
	freezeTokens,
	thawTokens,
} from "@/lib/token/freeze-token";
import useUmiStore from "@/store/useUmiStore";
import { zodResolver } from "@hookform/resolvers/zod";
import { Lock, Snowflake, Sun } from "lucide-react";
import React, { useState } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";

// Zod schema for freeze/thaw forms
const freezeThawSchema = z.object({
	mintAddress: z.string().nonempty("Mint address is required"),
	ownerAddress: z.string().optional(),
});

type FreezeThawValues = z.infer<typeof freezeThawSchema>;
type OperationResult = {
	signature: string;
	operation: "freeze" | "thaw";
};

export default function FreezeToken() {
	return (
		<div className="font-mono flex flex-col gap-6 max-w-4xl mx-auto p-4">
			<article className="mx-auto text-center space-y-2">
				<div className="flex items-center justify-center gap-2 mb-4">
					<Lock className="h-8 w-8 text-primary" />
					<h1 className="text-4xl font-bold font-inter">Token Freeze Management</h1>
				</div>
				<p className="text-muted-foreground text-lg">
					Freeze or thaw SPL tokens to control their transferability
				</p>
			</article>

			<Tabs defaultValue="freeze" className="w-full">
				<TabsList className="grid w-full grid-cols-2 mb-6">
					<TabsTrigger value="freeze" className="flex items-center gap-2">
						<Snowflake className="h-4 w-4" />
						Freeze Token
					</TabsTrigger>
					<TabsTrigger value="thaw" className="flex items-center gap-2">
						<Sun className="h-4 w-4" />
						Thaw Token
					</TabsTrigger>
				</TabsList>

				<TabsContent value="freeze">
					<Card className="border-2">
						<CardHeader className="pb-4">
							<CardTitle className="flex items-center gap-2">
								<Snowflake className="h-5 w-5 text-blue-500" />
								Freeze Token
							</CardTitle>
							<CardDescription>
								Freeze a token account to prevent transfers. You must be the freeze authority for this token.
							</CardDescription>
						</CardHeader>
						<CardContent>
							<FreezeForm />
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="thaw">
					<Card className="border-2">
						<CardHeader className="pb-4">
							<CardTitle className="flex items-center gap-2">
								<Sun className="h-5 w-5 text-orange-500" />
								Thaw Token
							</CardTitle>
							<CardDescription>
								Thaw a previously frozen token account to restore transferability. You must be the freeze authority for this token.
							</CardDescription>
						</CardHeader>
						<CardContent>
							<ThawForm />
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>
		</div>
	);
}

function FreezeForm() {
	const [result, setResult] = useState<OperationResult | null>(null);
	const [open, setOpen] = useState(false);

	const form = useForm<FreezeThawValues>({
		resolver: zodResolver(freezeThawSchema),
		defaultValues: { mintAddress: "", ownerAddress: "" },
	});

	const onSubmit = async (values: FreezeThawValues) => {
		try {
			const params: FreezeTokenParams = {
				mintAddress: values.mintAddress,
				ownerAddress: values.ownerAddress || undefined,
			};

			const tx = await freezeTokens(params);
			setResult({ signature: tx.signature, operation: "freeze" });
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
										placeholder="Enter mint address of the token to freeze"
										className="font-mono"
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
								<FormLabel>Token Owner Address (optional)</FormLabel>
								<FormControl>
									<Input
										{...field}
										placeholder="Leave empty to use connected wallet"
										className="font-mono"
									/>
								</FormControl>
								<FormMessage />
								<div className="text-sm text-muted-foreground">
									The owner of the token account to freeze. Defaults to your connected wallet.
								</div>
							</FormItem>
						)}
					/>

					<div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
						<div className="flex items-start gap-2">
							<Snowflake className="h-4 w-4 text-blue-500 mt-0.5" />
							<div className="text-sm">
								<p className="font-medium text-blue-900 dark:text-blue-100 mb-1">
									Important Notes:
								</p>
								<ul className="text-blue-700 dark:text-blue-300 space-y-1 text-xs">
									<li>• You must be the freeze authority for this token</li>
									<li>• Frozen tokens cannot be transferred until thawed</li>
									<li>• This action is reversible with the thaw operation</li>
								</ul>
							</div>
						</div>
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
								Freezing Token...
							</>
						) : (
							<>
								<Snowflake className="h-4 w-4 mr-2" />
								Freeze Token
							</>
						)}
					</Button>
				</form>
			</Form>

			<OperationSuccessDialog
				open={open}
				onOpenChange={setOpen}
				result={result}
			/>
		</>
	);
}

function ThawForm() {
	const [result, setResult] = useState<OperationResult | null>(null);
	const [open, setOpen] = useState(false);

	const form = useForm<FreezeThawValues>({
		resolver: zodResolver(freezeThawSchema),
		defaultValues: { mintAddress: "", ownerAddress: "" },
	});

	const onSubmit = async (values: FreezeThawValues) => {
		try {
			const params: ThawTokenParams = {
				mintAddress: values.mintAddress,
				ownerAddress: values.ownerAddress || undefined,
			};

			const tx = await thawTokens(params);
			setResult({ signature: tx.signature, operation: "thaw" });
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
										placeholder="Enter mint address of the token to thaw"
										className="font-mono"
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
								<FormLabel>Token Owner Address (optional)</FormLabel>
								<FormControl>
									<Input
										{...field}
										placeholder="Leave empty to use connected wallet"
										className="font-mono"
									/>
								</FormControl>
								<FormMessage />
								<div className="text-sm text-muted-foreground">
									The owner of the token account to thaw. Defaults to your connected wallet.
								</div>
							</FormItem>
						)}
					/>

					<div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
						<div className="flex items-start gap-2">
							<Sun className="h-4 w-4 text-orange-500 mt-0.5" />
							<div className="text-sm">
								<p className="font-medium text-orange-900 dark:text-orange-100 mb-1">
									Important Notes:
								</p>
								<ul className="text-orange-700 dark:text-orange-300 space-y-1 text-xs">
									<li>• You must be the freeze authority for this token</li>
									<li>• This will restore transferability to the token account</li>
									<li>• Only works on previously frozen token accounts</li>
								</ul>
							</div>
						</div>
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
								Thawing Token...
							</>
						) : (
							<>
								<Sun className="h-4 w-4 mr-2" />
								Thaw Token
							</>
						)}
					</Button>
				</form>
			</Form>

			<OperationSuccessDialog
				open={open}
				onOpenChange={setOpen}
				result={result}
			/>
		</>
	);
}

function OperationSuccessDialog({
	open,
	onOpenChange,
	result
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	result: OperationResult | null;
}) {
	const isFreeze = result?.operation === "freeze";

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						{isFreeze ? (
							<Snowflake className="h-5 w-5 text-blue-500" />
						) : (
							<Sun className="h-5 w-5 text-orange-500" />
						)}
						{isFreeze ? "Token Frozen Successfully" : "Token Thawed Successfully"}
					</DialogTitle>
					<DialogDescription>
						Your token {isFreeze ? "freeze" : "thaw"} operation completed successfully.
					</DialogDescription>
				</DialogHeader>
				<div className="space-y-3 py-4">
					<div className="space-y-1">
						<p className="text-sm font-medium">Operation:</p>
						<Badge
							variant="outline"
							className={isFreeze ? "text-blue-600 border-blue-300" : "text-orange-600 border-orange-300"}
						>
							{isFreeze ? "FREEZE" : "THAW"}
						</Badge>
					</div>
					<div className="space-y-1">
						<p className="text-sm font-medium">Transaction Signature:</p>
						<code className="text-xs bg-muted p-2 rounded break-all block">
							{result?.signature}
						</code>
					</div>
					<div className="space-y-1">
						<p className="text-sm font-medium">Solana Explorer:</p>
						<a
							href={`https://explorer.solana.com/tx/${result?.signature}?cluster=devnet`}
							target="_blank"
							rel="noopener noreferrer"
							className="text-xs text-primary hover:underline break-all block"
						>
							View on Solana Explorer
						</a>
					</div>
				</div>
				<DialogFooter>
					<Button onClick={() => onOpenChange(false)} className="w-full">
						Close
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

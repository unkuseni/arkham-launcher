"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import useUmiStore from "@/store/useUmiStore";
import { CheckCircle, Copy, ExternalLink, Rocket, Sparkles, Trophy } from "lucide-react";
import { useState } from "react";

interface TokenDetails {
	name: string;
	ticker: string;
	decimals: number;
	supply: number;
	description: string;
	imageUrl?: string; // Optional image URL
	pinataUrl?: string; // Optional Pinata URL for metadata
	txResult?: {
		mintAddress: string;
		signature: string;
		tokenAddress: string;
	};
	// Potentially add other fields like transaction signature, explorer URL etc.
}

interface TokenSuccessModalProps {
	isOpen: boolean;
	onClose: () => void;
	tokenDetails: TokenDetails | null;
}

const TokenSuccessModal = ({
	isOpen,
	onClose,
	tokenDetails,
}: TokenSuccessModalProps) => {
	const [copiedField, setCopiedField] = useState<string | null>(null);

	if (!tokenDetails) {
		return null;
	}

	// Function to safely open a URL in a new tab
	const openInNewTab = (url: string) => {
		window.open(url, "_blank", "noopener,noreferrer");
	};

	// Function to copy text to clipboard with visual feedback
	const copyToClipboard = async (text: string, fieldName: string) => {
		try {
			await navigator.clipboard.writeText(text);
			setCopiedField(fieldName);
			setTimeout(() => setCopiedField(null), 2000);
		} catch (err) {
			console.error('Failed to copy: ', err);
		}
	};

	const { umi } = useUmiStore();
	const network = umi.rpc.getCluster();

	const solanaExplorerBaseUrl = "https://explorer.solana.com";
	// Build explorer URL with cluster query when not mainnet-beta
	const buildExplorerUrl = (path: string) => {
		const clusterParam =
			network === "mainnet-beta" ? "" : `?cluster=${network}`;
		return `${solanaExplorerBaseUrl}/${path}${clusterParam}`;
	};

	return (
		<Dialog open={isOpen} onOpenChange={onClose}>
			<DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] sm:max-h-[85vh] overflow-y-auto bg-gradient-to-br from-background via-background/95 to-primary/5 border-2 border-primary/20 shadow-2xl backdrop-blur-xl mx-2 sm:mx-auto">
				{/* Animated Background Elements */}
				<div className="absolute inset-0 overflow-hidden pointer-events-none">
					<div className="absolute top-0 right-0 w-20 h-20 sm:w-32 sm:h-32 bg-gradient-to-br from-green-500/20 to-emerald-500/10 rounded-full blur-3xl animate-pulse" />
					<div className="absolute bottom-0 left-0 w-24 h-24 sm:w-40 sm:h-40 bg-gradient-to-tr from-blue-500/15 to-purple-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
					<div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-16 h-16 sm:w-24 sm:h-24 bg-gradient-to-r from-primary/10 to-secondary/10 rounded-full blur-2xl animate-ping opacity-20" />
				</div>

				<DialogHeader className="relative z-10 text-center pb-6 sm:pb-8 pt-4 sm:pt-6">
					{/* Success Animation Icon */}
					<div className="flex items-center justify-center mb-4 sm:mb-6">
						<div className="relative">
							<div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-2xl animate-bounce">
								<Trophy className="h-10 w-10 sm:h-12 sm:w-12 text-white" />
							</div>
							<div className="absolute inset-0 w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-green-400/50 to-emerald-500/50 animate-ping" />
							<div className="absolute -top-1 -right-1 sm:-top-2 sm:-right-2 w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center animate-pulse">
								<Sparkles className="h-3 w-3 sm:h-4 sm:w-4 text-white" />
							</div>
						</div>
					</div>

					<DialogTitle className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-green-600 via-emerald-600 to-green-700 bg-clip-text text-transparent mb-3 sm:mb-4 px-2">
						🎉 Token Successfully Launched!
					</DialogTitle>
					<DialogDescription className="text-base sm:text-lg text-muted-foreground max-w-sm sm:max-w-md mx-auto leading-relaxed px-2">
						Congratulations! Your token{" "}
						<span className="font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent break-words">
							{tokenDetails.name} ({tokenDetails.ticker})
						</span>{" "}
						is now live on the Solana blockchain.
					</DialogDescription>
				</DialogHeader>

				<div className="relative z-10 space-y-6 sm:space-y-8 px-1 sm:px-2">					{/* Token Image and Basic Info Card */}
					<div className="p-4 sm:p-6 lg:p-8 rounded-2xl bg-gradient-to-br from-card/80 via-card/60 to-card/40 backdrop-blur-sm border-2 border-primary/10 shadow-xl">
						<div className="flex flex-col items-center gap-4 sm:gap-6 lg:gap-8 lg:flex-row">
							{tokenDetails.imageUrl ? (
								<div className="relative group flex-shrink-0">
									<div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-2xl blur-lg group-hover:blur-xl transition-all duration-300" />
									<img
										src={tokenDetails.imageUrl}
										alt={tokenDetails.name}
										className="relative w-24 h-24 sm:w-28 sm:h-28 lg:w-32 lg:h-32 rounded-2xl border-4 border-primary/20 object-cover shadow-2xl group-hover:scale-105 transition-transform duration-300"
									/>
									<div className="absolute -bottom-1 -right-1 sm:-bottom-2 sm:-right-2 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg">
										<CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
									</div>
								</div>
							) : (
								<div className="w-24 h-24 sm:w-28 sm:h-28 lg:w-32 lg:h-32 rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center border-4 border-primary/20 shadow-xl flex-shrink-0">
									<Rocket className="h-12 w-12 sm:h-14 sm:w-14 lg:h-16 lg:w-16 text-primary/70" />
								</div>
							)}

							<div className="flex-1 space-y-3 sm:space-y-4 text-center lg:text-left w-full min-w-0">
								<div className="space-y-2">
									<h3 className="text-xl sm:text-2xl font-bold text-foreground break-words">{tokenDetails.name}</h3>
									<Badge variant="secondary" className="text-base sm:text-lg px-3 py-1 sm:px-4 sm:py-2 bg-gradient-to-r from-primary/20 to-blue-500/20 border border-primary/30">
										${tokenDetails.ticker}
									</Badge>
								</div>

								<div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-sm">
									<div className="p-3 rounded-xl bg-gradient-to-br from-blue-500/10 to-blue-500/5 border border-blue-500/20">
										<p className="text-blue-600 font-medium mb-1">Total Supply</p>
										<p className="text-base sm:text-lg font-bold text-foreground break-all">{tokenDetails.supply.toLocaleString()}</p>
									</div>
									<div className="p-3 rounded-xl bg-gradient-to-br from-purple-500/10 to-purple-500/5 border border-purple-500/20">
										<p className="text-purple-600 font-medium mb-1">Decimals</p>
										<p className="text-base sm:text-lg font-bold text-foreground">{tokenDetails.decimals}</p>
									</div>
								</div>
							</div>
						</div>
					</div>

					{/* Description Card */}
					{tokenDetails.description && (
						<div className="p-4 sm:p-6 rounded-2xl bg-gradient-to-br from-muted/50 to-muted/30 backdrop-blur-sm border border-border/50 shadow-lg">
							<div className="flex items-center gap-3 mb-3 sm:mb-4">
								<div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br from-indigo-500/20 to-indigo-500/10 flex items-center justify-center flex-shrink-0">
									<Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-indigo-600" />
								</div>
								<h4 className="text-base sm:text-lg font-semibold text-foreground">Token Description</h4>
							</div>
							<p className="text-sm sm:text-base text-muted-foreground leading-relaxed whitespace-pre-wrap break-words">
								{tokenDetails.description}
							</p>
						</div>
					)}

					{/* Links and Resources */}
					<div className="grid gap-3 sm:gap-4">
						{tokenDetails.pinataUrl && (
							<div className="p-3 sm:p-4 rounded-xl bg-gradient-to-r from-orange-500/10 to-amber-500/10 border border-orange-500/20 hover:border-orange-500/40 transition-colors group">
								<div className="flex items-center justify-between gap-3">
									<div className="flex items-center gap-3 min-w-0 flex-1">
										<div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-gradient-to-br from-orange-500/20 to-amber-500/20 flex items-center justify-center flex-shrink-0">
											<ExternalLink className="h-4 w-4 sm:h-5 sm:w-5 text-orange-600" />
										</div>
										<div className="min-w-0 flex-1">
											<p className="font-medium text-foreground text-sm sm:text-base">Metadata (IPFS)</p>
											<p className="text-xs sm:text-sm text-muted-foreground">View token metadata on IPFS</p>
										</div>
									</div>
									<Button
										variant="ghost"
										size="sm"
										className="text-orange-600 hover:text-orange-700 hover:bg-orange-500/10 flex-shrink-0"
										onClick={() => openInNewTab(tokenDetails.pinataUrl || "")}
									>
										<ExternalLink className="h-4 w-4" />
									</Button>
								</div>
							</div>
						)}
					</div>					{/* Transaction Details */}
					{tokenDetails.txResult && (
						<div className="p-4 sm:p-6 rounded-2xl bg-gradient-to-br from-slate-500/5 to-slate-500/3 backdrop-blur-sm border border-border/50 shadow-lg">
							<div className="flex items-center gap-3 mb-4 sm:mb-6">
								<div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br from-green-500/20 to-green-500/10 flex items-center justify-center flex-shrink-0">
									<CheckCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-600" />
								</div>
								<h4 className="text-base sm:text-lg font-semibold text-foreground">Blockchain Details</h4>
							</div>

							<div className="space-y-3 sm:space-y-4">
								{tokenDetails.txResult.mintAddress && (
									<div className="p-3 sm:p-4 rounded-xl bg-gradient-to-r from-blue-500/5 to-blue-500/3 border border-blue-500/20 group hover:border-blue-500/40 transition-colors">
										<div className="flex items-center justify-between mb-2 gap-2">
											<p className="text-xs sm:text-sm font-medium text-blue-600 flex-shrink-0">Mint Address</p>
											<div className="flex gap-1 sm:gap-2 flex-shrink-0">
												<Button
													variant="ghost"
													size="sm"
													className="h-7 w-7 sm:h-8 sm:w-8 p-0 text-blue-600 hover:bg-blue-500/10"
													onClick={() => copyToClipboard(tokenDetails.txResult?.mintAddress || "", "mint")}
													title="Copy address"
												>
													{copiedField === "mint" ? (
														<CheckCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-600" />
													) : (
														<Copy className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
													)}
												</Button>
												<Button
													variant="ghost"
													size="sm"
													className="h-7 w-7 sm:h-8 sm:w-8 p-0 text-blue-600 hover:bg-blue-500/10"
													onClick={() => openInNewTab(buildExplorerUrl(`address/${tokenDetails.txResult?.mintAddress}`))}
													title="View on Solana Explorer"
												>
													<ExternalLink className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
												</Button>
											</div>
										</div>
										<p className="text-xs font-mono text-muted-foreground break-all">
											{tokenDetails.txResult.mintAddress}
										</p>
									</div>
								)}

								{tokenDetails.txResult.tokenAddress && (
									<div className="p-3 sm:p-4 rounded-xl bg-gradient-to-r from-purple-500/5 to-purple-500/3 border border-purple-500/20 group hover:border-purple-500/40 transition-colors">
										<div className="flex items-center justify-between mb-2 gap-2">
											<p className="text-xs sm:text-sm font-medium text-purple-600 flex-shrink-0">Token Address</p>
											<div className="flex gap-1 sm:gap-2 flex-shrink-0">
												<Button
													variant="ghost"
													size="sm"
													className="h-7 w-7 sm:h-8 sm:w-8 p-0 text-purple-600 hover:bg-purple-500/10"
													onClick={() => copyToClipboard(tokenDetails.txResult?.tokenAddress || "", "token")}
													title="Copy address"
												>
													{copiedField === "token" ? (
														<CheckCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-600" />
													) : (
														<Copy className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
													)}
												</Button>
												<Button
													variant="ghost"
													size="sm"
													className="h-7 w-7 sm:h-8 sm:w-8 p-0 text-purple-600 hover:bg-purple-500/10"
													onClick={() => openInNewTab(buildExplorerUrl(`address/${tokenDetails.txResult?.tokenAddress}`))}
													title="View on Solana Explorer"
												>
													<ExternalLink className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
												</Button>
											</div>
										</div>
										<p className="text-xs font-mono text-muted-foreground break-all">
											{tokenDetails.txResult.tokenAddress}
										</p>
									</div>
								)}

								{tokenDetails.txResult.signature && (
									<div className="p-3 sm:p-4 rounded-xl bg-gradient-to-r from-green-500/5 to-green-500/3 border border-green-500/20 group hover:border-green-500/40 transition-colors">
										<div className="flex items-center justify-between mb-2 gap-2">
											<p className="text-xs sm:text-sm font-medium text-green-600 flex-shrink-0">Transaction Signature</p>
											<div className="flex gap-1 sm:gap-2 flex-shrink-0">
												<Button
													variant="ghost"
													size="sm"
													className="h-7 w-7 sm:h-8 sm:w-8 p-0 text-green-600 hover:bg-green-500/10"
													onClick={() => copyToClipboard(tokenDetails.txResult?.signature || "", "signature")}
													title="Copy signature"
												>
													{copiedField === "signature" ? (
														<CheckCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-600" />
													) : (
														<Copy className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
													)}
												</Button>
												<Button
													variant="ghost"
													size="sm"
													className="h-7 w-7 sm:h-8 sm:w-8 p-0 text-green-600 hover:bg-green-500/10"
													onClick={() => openInNewTab(buildExplorerUrl(`tx/${tokenDetails.txResult?.signature}`))}
													title="View transaction on Solana Explorer"
												>
													<ExternalLink className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
												</Button>
											</div>
										</div>
										<p className="text-xs font-mono text-muted-foreground break-all">
											{tokenDetails.txResult.signature}
										</p>
									</div>
								)}
							</div>
						</div>
					)}
				</div>

				<DialogFooter className="relative z-10 pt-6 sm:pt-8 pb-4 sm:pb-6 flex flex-col gap-4">
					<div className="text-center">
						<p className="text-xs sm:text-sm text-muted-foreground px-2">
							🎊 Your token is now live on Solana! Share it with the world.
						</p>
					</div>
					<div className="flex flex-col sm:flex-row gap-3 sm:gap-3 w-full">
						{tokenDetails.txResult?.mintAddress && (
							<Button
								type="button"
								variant="outline"
								className="flex-1 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-blue-500/30 hover:border-blue-500/50 text-blue-700 dark:text-blue-300 text-sm sm:text-base"
								onClick={() => openInNewTab(buildExplorerUrl(`address/${tokenDetails.txResult?.mintAddress}`))}
							>
								<ExternalLink className="h-4 w-4 mr-2 flex-shrink-0" />
								<span className="truncate">View on Explorer</span>
							</Button>
						)}
						<Button
							type="button"
							className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 shadow-lg hover:shadow-xl transition-all duration-300 min-w-[120px] text-sm sm:text-base"
							onClick={onClose}
						>
							<CheckCircle className="h-4 w-4 mr-2 flex-shrink-0" />
							Perfect!
						</Button>
					</div>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};

export default TokenSuccessModal;
export type { TokenDetails };

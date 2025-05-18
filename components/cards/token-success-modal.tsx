"use client";

import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
	DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, ExternalLink } from "lucide-react"; // Added ExternalLink
import useUmiStore from "@/store/useUmiStore";

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
	if (!tokenDetails) {
		return null;
	}

	// Function to safely open a URL in a new tab
	const openInNewTab = (url: string) => {
		window.open(url, "_blank", "noopener,noreferrer");
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
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2 text-xl">
						<CheckCircle className="h-6 w-6 text-green-500" />
						Token Created Successfully!
					</DialogTitle>
					<DialogDescription>
						Your new token{" "}
						<span className="font-semibold">
							{tokenDetails.name} ({tokenDetails.ticker})
						</span>{" "}
						has been minted.
					</DialogDescription>
				</DialogHeader>
				<div className="space-y-4 py-4">
					{tokenDetails.imageUrl && (
						<div className="flex items-center justify-center my-4">
							<img
								src={tokenDetails.imageUrl}
								alt={tokenDetails.name}
								className="w-28 h-28 rounded-full border-2 border-primary object-cover shadow-lg"
							/>
						</div>
					)}
					<div className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-3 items-center text-sm">
						<p className="font-medium text-muted-foreground">Name:</p>
						<p>{tokenDetails.name}</p>

						<p className="font-medium text-muted-foreground">Symbol:</p>
						<p>
							<Badge variant="secondary" className="text-base">
								{tokenDetails.ticker}
							</Badge>
						</p>

						<p className="font-medium text-muted-foreground">Decimals:</p>
						<p>{tokenDetails.decimals}</p>

						<p className="font-medium text-muted-foreground">Total Supply:</p>
						<p>{tokenDetails.supply.toLocaleString()}</p>
					</div>

					{tokenDetails.description && (
						<div className="pt-2">
							<p className="font-medium text-sm text-muted-foreground">
								Description:
							</p>
							<p className="text-sm text-foreground/90 whitespace-pre-wrap break-words">
								{tokenDetails.description}
							</p>
						</div>
					)}

					{tokenDetails.pinataUrl && (
						<div className="pt-2">
							<p className="font-medium text-sm text-muted-foreground">
								Metadata (IPFS):
							</p>
							<Button
								variant="link"
								className="p-0 h-auto text-sm text-blue-500 hover:underline flex items-center gap-1"
								onClick={() => openInNewTab(tokenDetails.pinataUrl!)}
							>
								View on IPFS <ExternalLink className="h-3 w-3" />
							</Button>
						</div>
					)}

					{/* Transaction Details Section */}
					{tokenDetails.txResult && (
						<div className="pt-3 space-y-2">
							<p className="font-medium text-sm text-muted-foreground">
								Transaction Details:
							</p>
							<div className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 items-center text-sm">
								{tokenDetails.txResult.mintAddress && (
									<>
										<p className="font-medium text-xs text-muted-foreground">
											Mint Address:
										</p>
										<Button
											variant="link"
											className="p-0 h-auto text-xs text-blue-500 hover:underline flex items-center gap-1 justify-start truncate"
											onClick={() =>
												openInNewTab(
													buildExplorerUrl(
														`address/${tokenDetails.txResult?.mintAddress}`,
													),
												)
											}
											title={tokenDetails.txResult.mintAddress}
										>
											<span className="truncate">
												{tokenDetails.txResult.mintAddress}
											</span>
											<ExternalLink className="h-3 w-3 flex-shrink-0" />
										</Button>
									</>
								)}
								{tokenDetails.txResult.tokenAddress && (
									<>
										<p className="font-medium text-xs text-muted-foreground">
											Token Address:
										</p>
										<Button
											variant="link"
											className="p-0 h-auto text-xs text-blue-500 hover:underline flex items-center gap-1 justify-start truncate"
											onClick={() =>
												openInNewTab(
													buildExplorerUrl(
														`address/${tokenDetails.txResult?.tokenAddress}`,
													),
												)
											}
											title={tokenDetails.txResult.tokenAddress}
										>
											<span className="truncate">
												{tokenDetails.txResult.tokenAddress}
											</span>
											<ExternalLink className="h-3 w-3 flex-shrink-0" />
										</Button>
									</>
								)}
								{tokenDetails.txResult.signature && (
									<>
										<p className="font-medium text-xs text-muted-foreground">
											Signature:
										</p>
										<Button
											variant="link"
											className="p-0 h-auto text-xs text-blue-500 hover:underline flex items-center gap-1 justify-start truncate"
											onClick={() =>
												openInNewTab(
													buildExplorerUrl(
														`tx/${tokenDetails.txResult?.signature}`,
													),
												)
											}
											title={tokenDetails.txResult.signature}
										>
											<span className="truncate">
												{tokenDetails.txResult.signature}
											</span>
											<ExternalLink className="h-3 w-3 flex-shrink-0" />
										</Button>
									</>
								)}
							</div>
						</div>
					)}
				</div>
				<DialogFooter className="sm:justify-end gap-2 pt-2">
					{/* Optionally, add a button to view on explorer if you have the explorer URL */}
					{/* <Button type="button" variant="outline" onClick={() => openInNewTab(`explorer-url/${tokenDetails.transactionSignature}`)}>View on Explorer</Button> */}
					<Button type="button" variant="default" onClick={onClose}>
						Done
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};

export default TokenSuccessModal;
export type { TokenDetails };

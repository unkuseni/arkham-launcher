"use client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	type WalletModalProps,
	useWalletModal,
} from "@/context/useWalletModal";
import { cn } from "@/lib/utils";
import { type WalletName, WalletReadyState } from "@solana/wallet-adapter-base";
import { type Wallet, useWallet } from "@solana/wallet-adapter-react";
import { ChevronDown } from "lucide-react";
import {
	type FC,
	type MouseEvent,
	type MouseEventHandler,
	useCallback,
	useMemo,
	useState,
} from "react";
import {
	BaseWalletConnectionButton,
	type ButtonProps,
	ConnectButton,
	WalletIcon,
} from "./index";
import { WalletSVG } from "./wallet-svg";

export const WalletModalButton: FC<ButtonProps> = ({
	children = "Connect Wallet",
	onClick,
	...props
}) => {
	const { visible, setVisible } = useWalletModal();

	const handleClick = useCallback(
		(event: MouseEvent<HTMLButtonElement>) => {
			if (onClick) onClick(event);
			if (!event.defaultPrevented) setVisible(!visible);
		},
		[onClick, setVisible, visible],
	);

	return (
		<BaseWalletConnectionButton {...props} className="" onClick={handleClick}>
			{children}
		</BaseWalletConnectionButton>
	);
};

export const WalletModal: FC<WalletModalProps> = ({ className = "" }) => {
	const { wallets, select } = useWallet();
	const { visible, setVisible } = useWalletModal();
	const [expanded, setExpanded] = useState(false);

	const [listedWallets, collapsedWallets] = useMemo(() => {
		const installed: Wallet[] = [];
		const notInstalled: Wallet[] = [];

		for (const wallet of wallets) {
			if (wallet.readyState === WalletReadyState.Installed) {
				installed.push(wallet);
			} else {
				notInstalled.push(wallet);
			}
		}

		return installed.length ? [installed, notInstalled] : [notInstalled, []];
	}, [wallets]);

	const handleWalletClick = useCallback(
		(event: MouseEvent, walletName: WalletName) => {
			select(walletName);
			setVisible(false);
		},
		[select, setVisible],
	);

	return (
		<Dialog open={visible} onOpenChange={setVisible}>
			<DialogContent className={cn("sm:max-w-[425px]", className)}>
				<DialogHeader>
					<DialogTitle className="text-center font-mono">
						{listedWallets.length
							? "Connect a wallet on Solana to continue"
							: "You'll need a wallet on Solana to continue"}
					</DialogTitle>
					<DialogClose className="absolute right-4 top-4" />
				</DialogHeader>

				{listedWallets.length ? (
					<div className="flex flex-col gap-4">
						<ul className="grid gap-2">
							{listedWallets.map((wallet) => (
								<WalletListItem
									key={wallet.adapter.name}
									handleClick={(event) =>
										handleWalletClick(event, wallet.adapter.name)
									}
									wallet={wallet}
								/>
							))}
						</ul>

						{collapsedWallets.length > 0 && (
							<Collapsible open={expanded} onOpenChange={setExpanded}>
								<CollapsibleContent className="grid gap-2">
									{collapsedWallets.map((wallet) => (
										<WalletListItem
											key={wallet.adapter.name}
											handleClick={(event) =>
												handleWalletClick(event, wallet.adapter.name)
											}
											wallet={wallet}
										/>
									))}
								</CollapsibleContent>

								<CollapsibleTrigger asChild>
									<Button
										variant="ghost"
										className={`
					rounded-md border px-4 py-2 font-mono text-sm bg-white text-black dark:bg-black dark:text-white justify-between hover:bg-accent dark:hover:bg-accent-foreground ${expanded ? "justify-start mt-4" : ""}`}
									>
										{expanded ? "Less" : "More"} options
										<ChevronDown
											className={`ml-2 h-4 w-4 transition-transform ${
												expanded ? "rotate-180" : ""
											}`}
										/>
									</Button>
								</CollapsibleTrigger>
							</Collapsible>
						)}
					</div>
				) : (
					<div className="flex flex-col items-center gap-6">
						<WalletSVG />

						{collapsedWallets.length > 0 && (
							<Collapsible
								open={expanded}
								onOpenChange={setExpanded}
								className="w-full"
							>
								<CollapsibleContent className="grid gap-2">
									{collapsedWallets.map((wallet) => (
										<WalletListItem
											key={wallet.adapter.name}
											handleClick={(event) =>
												handleWalletClick(event, wallet.adapter.name)
											}
											wallet={wallet}
										/>
									))}
								</CollapsibleContent>

								<CollapsibleTrigger asChild>
									<Button variant="ghost" className="w-full">
										{expanded ? "Hide" : "View"} wallet options
										<ChevronDown
											className={`ml-2 h-4 w-4 transition-transform ${
												expanded ? "rotate-180" : ""
											}`}
										/>
									</Button>
								</CollapsibleTrigger>
							</Collapsible>
						)}
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
};

export interface WalletListItemProps {
	handleClick: MouseEventHandler<HTMLButtonElement>;
	tabIndex?: number;
	wallet: Wallet;
}

export const WalletListItem: FC<WalletListItemProps> = ({
	handleClick,
	tabIndex,
	wallet,
}) => {
	return (
		<li className="list-none">
			<Button
				className={
					"rounded-md border px-4 py-2 font-mono text-sm bg-white text-black dark:bg-black dark:text-white justify-between w-full hover:bg-accent dark:hover:bg-accent-foreground"
				}
				onClick={handleClick}
				tabIndex={tabIndex}
			>
				<div className="flex items-center gap-2">
					<div className="w-6 h-6">
						<WalletIcon wallet={wallet} width={24} height={24} />
					</div>
					<span className="font-medium">{wallet.adapter.name}</span>
				</div>

				{wallet.readyState === WalletReadyState.Installed && (
					<Badge variant="secondary" className={"ml-2 inline-block"}>
						Detected
					</Badge>
				)}
			</Button>
		</li>
	);
};

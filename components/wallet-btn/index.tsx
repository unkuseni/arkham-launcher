"use client";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useWalletModal } from "@/context/useWalletModal";
import type { WalletName } from "@solana/wallet-adapter-base";
import { useWalletMultiButton } from "@solana/wallet-adapter-base-ui";
import type { Wallet } from "@solana/wallet-adapter-react";
import Image from "next/image";
import {
	type CSSProperties,
	type ComponentProps,
	type FC,
	type MouseEvent,
	type PropsWithChildren,
	type ReactElement,
	useCallback,
	useMemo,
	useState,
} from "react";

const LABELS = {
	"change-wallet": "Change wallet",
	connecting: "Connecting ...",
	"copy-address": "Copy address",
	copied: "Copied",
	disconnect: "Disconnect",
	"has-wallet": "Install Wallet",
	"no-wallet": "Connect Wallet",
} as const;

type MultiWalletButtonProps = ButtonProps & {
	labels?: typeof LABELS;
};

export const MultiWalletButton = ({
	labels = LABELS,
	...props
}: MultiWalletButtonProps) => {
	return (
		<BaseMultiWalletButton
			labels={labels}
			{...props}
			className={
				"rounded-full border border-solid border-black/[.08] dark:border-white/[.145] transition-colors flex items-center justify-center hover:bg-black/30 hover:text-black dark:hover:bg-white/30 dark:hover:text-white hover:border-transparent font-medium text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 w-full sm:w-auto md:w-[158px]"
			}
		/>
	);
};

type BaseMultiWalletButtonProps = ButtonProps & {
	labels: Omit<
		{
			[TButtonState in ReturnType<
				typeof useWalletMultiButton
			>["buttonState"]]: string;
		},
		"connected" | "disconnecting"
	> & {
		"copy-address": string;
		copied: string;
		"change-wallet": string;
		disconnect: string;
	};
};

const BaseMultiWalletButton = ({
	children,
	labels,
	...props
}: BaseMultiWalletButtonProps) => {
	const { setVisible: setModalVisible } = useWalletModal();
	const {
		buttonState,
		onConnect,
		onDisconnect,
		publicKey,
		walletIcon,
		walletName,
	} = useWalletMultiButton({
		onSelectWallet() {
			setModalVisible(true);
		},
	});

	const [copied, setCopied] = useState(false);

	const content = useMemo(() => {
		if (children) return children;
		if (publicKey)
			return `${publicKey.toBase58().slice(0, 4)}..${publicKey.toBase58().slice(-4)}`;
		return labels[buttonState as keyof typeof labels] || labels["no-wallet"];
	}, [children, publicKey, buttonState, labels]);

	const handleClick = useCallback(() => {
		switch (buttonState) {
			case "no-wallet":
				setModalVisible(true);
				break;
			case "has-wallet":
				onConnect?.();
				break;
			case "connected":
				break;
		}
	}, [buttonState, onConnect, setModalVisible]);

	// Don't use dropdown when not connected
	if (buttonState !== "connected") {
		return (
			<BaseWalletConnectionButton
				{...props}
				walletIcon={walletIcon}
				walletName={walletName}
				onClick={handleClick}
			>
				{content}
			</BaseWalletConnectionButton>
		);
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					className={props.className || ""}
					disabled={props.disabled}
					style={props.style}
					tabIndex={props.tabIndex}
					type="button"
				>
					{walletIcon && walletName && (
						<span className="">
							<WalletIcon
								wallet={{ adapter: { name: walletName, icon: walletIcon } }}
							/>
						</span>
					)}
					<span>{content}</span>
					{props.endIcon && <span className="">{props.endIcon}</span>}
				</Button>
			</DropdownMenuTrigger>

			<DropdownMenuContent align="end" className="min-w-[180px] font-inter">
				{publicKey && (
					<DropdownMenuItem
						onClick={async () => {
							await navigator.clipboard.writeText(publicKey.toBase58());
							setCopied(true);
							setTimeout(() => setCopied(false), 400);
						}}
					>
						{copied ? labels.copied : labels["copy-address"]}
					</DropdownMenuItem>
				)}

				<DropdownMenuItem onClick={() => setModalVisible(true)}>
					{labels["change-wallet"]}
				</DropdownMenuItem>

				{onDisconnect && (
					<DropdownMenuItem
						onClick={() => onDisconnect()}
						className="text-red-600 focus:bg-red-50"
					>
						{labels.disconnect}
					</DropdownMenuItem>
				)}
			</DropdownMenuContent>
		</DropdownMenu>
	);
};

type BaseWalletConnectionButtonProps = ComponentProps<typeof ConnectButton> & {
	walletIcon?: string;
	walletName?: WalletName;
};

export const BaseWalletConnectionButton: FC<
	BaseWalletConnectionButtonProps
> = ({ walletIcon, walletName, ...props }) => {
	return (
		<ConnectButton
			{...props}
			className=""
			startIcon={
				walletIcon && walletName ? (
					<WalletIcon
						wallet={{ adapter: { name: walletName, icon: walletIcon } }}
					/>
				) : undefined
			}
		/>
	);
};

export const ConnectButton: FC<ButtonProps> = ({
	className,
	disabled,
	endIcon,
	startIcon,
	style,
	onClick,
	tabIndex = 0,
	children,
}) => {
	return (
		<Button
			className={
				className ||
				"rounded-full border border-solid border-black/[.08] dark:border-white/[.145] transition-colors flex gap-2 items-center justify-center hover:bg-[#f2f2f2] dark:hover:bg-[#1a1a1a] hover:text-black hover:border-transparent font-medium text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 w-fit sm:w-auto md:w-[158px]"
			}
			disabled={disabled}
			style={style}
			onClick={onClick}
			tabIndex={tabIndex}
			type="button"
		>
			{startIcon && <span>{startIcon}</span>}
			<div className="">{children || "Connect"}</div>
			{endIcon && <span>{endIcon}</span>}
		</Button>
	);
};

export interface WalletIconProps {
	wallet: { adapter: Pick<Wallet["adapter"], "name" | "icon"> } | null;
	width?: number;
	height?: number;
	className?: string;
	priority?: boolean;
}

export const WalletIcon: FC<WalletIconProps> = ({
	wallet,
	width = 24,
	height = 24,
	className,
	priority = false,
}) => {
	return wallet ? (
		<Image
			src={wallet.adapter.icon}
			alt={wallet.adapter.name}
			width={width}
			height={height}
			className={className}
			priority={priority}
		/>
	) : null;
};

export type ButtonProps = PropsWithChildren<{
	className?: string;
	disabled?: boolean;
	endIcon?: ReactElement;
	onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
	startIcon?: ReactElement;
	style?: CSSProperties;
	tabIndex?: number;
}>;

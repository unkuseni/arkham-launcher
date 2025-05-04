"use client";
import { WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import {
	PhantomWalletAdapter,
	SolflareWalletAdapter,
	TrustWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import { type ReactNode, useMemo } from "react";
import "@solana/wallet-adapter-react-ui/styles.css";

type Props = {
	children: ReactNode;
};

export const WalletAdapterProvider = ({ children }: Props) => {
	const wallets = useMemo(
		() => [
			new PhantomWalletAdapter(),
			new TrustWalletAdapter(),
			new SolflareWalletAdapter(),
		],
		[],
	);
	return (
		<WalletProvider wallets={wallets} autoConnect>
			<WalletModalProvider>{children}</WalletModalProvider>
		</WalletProvider>
	);
};

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

/**
 * A component that wraps the `WalletProvider` and `WalletModalProvider` from
 * `@solana/wallet-adapter-react` and `@solana/wallet-adapter-react-ui` respectively.
 *
 * It provides the `WalletProvider` with a list of wallets to use, and wraps the
 * `WalletModalProvider` around the children.
 *
 * @param children The children to render inside the `WalletModalProvider`.
 */
export const WalletAdapterProvider = ({ children }: Props) => {
	/**
	 * The list of wallets to use.
	 *
	 * This list is memoized to prevent re-renders of the component when the props
	 * change.
	 */
	const wallets = useMemo(
		() => [
			/**
			 * The Phantom wallet adapter.
			 */
			new PhantomWalletAdapter(),
			/**
			 * The Trust wallet adapter.
			 */
			new TrustWalletAdapter(),
			/**
			 * The Solflare wallet adapter.
			 */
			new SolflareWalletAdapter(),
		],
		[],
	);
	return (
		<WalletProvider
			/**
			 * The wallets to use.
			 */
			wallets={wallets}
			/**
			 * If true, the wallet will automatically connect to the user's wallet.
			 */
			autoConnect
		>
			<WalletModalProvider>
				{/**
				 * The children to render inside the `WalletModalProvider`.
				 */}
				{children}
			</WalletModalProvider>
		</WalletProvider>
	);
};

type Props = {
	/**
	 * The children to render inside the `WalletModalProvider`.
	 */
	children: ReactNode;
};

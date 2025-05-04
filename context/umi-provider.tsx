"use client";
import useUmiStore from "@/store/useUmiStore";
import {
	ConnectionStatus,
	type Network,
	type NetworkConfig,
} from "@/store/useUmiStore";
import type { WalletAdapter } from "@solana/wallet-adapter-base";
import { useWallet } from "@solana/wallet-adapter-react";
import { createContext, useContext, useEffect } from "react";

interface UmiContextType {
	connectionStatus: ConnectionStatus;
	connectionError: string | null;
	network: Network;
	networkConfig: NetworkConfig;
	changeNetwork: (network: Network, customEndpoint?: string) => void;
	reconnect: () => Promise<boolean>;
	isConnected: boolean;
}

const UmiContext = createContext<UmiContextType | undefined>(undefined);

export const useUmi = () => {
	const context = useContext(UmiContext);
	if (!context) {
		throw new Error("useUmi must be used within a UmiProvider");
	}
	return context;
};

export const UmiProvider = ({ children }: { children: React.ReactNode }) => {
	const wallet = useWallet();
	const umiStore = useUmiStore();
	const {
		connectionStatus,
		connectionError,
		network,
		networkConfig,
		setNetwork,
		reconnect,
		checkConnection,
	} = umiStore;

	useEffect(() => {
		if (!wallet.publicKey) return;

		umiStore.updateSigner(wallet as unknown as WalletAdapter);
	}, [wallet, umiStore]);

	useEffect(() => {
		// Check connection when component mounts
		checkConnection();

		const interval = setInterval(() => {
			checkConnection();
		}, 30000); // Every 30 seconds

		return () => clearInterval(interval);
	}, [checkConnection]);

	// Handle wallet disconnection
	useEffect(() => {
		if (!wallet.connected && umiStore.signer) {
			umiStore.clearSigner();
		}
	}, [wallet.connected, umiStore]);

	const contextValue: UmiContextType = {
		connectionStatus,
		connectionError,
		network,
		networkConfig,
		changeNetwork: setNetwork,
		reconnect,
		isConnected: connectionStatus === ConnectionStatus.CONNECTED,
	};

	return (
		<UmiContext.Provider value={contextValue}>{children}</UmiContext.Provider>
	);
};

export default UmiProvider;

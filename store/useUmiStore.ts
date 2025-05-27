import { tokenBalances } from "@/lib/token/token-balances";
import { mplCore } from "@metaplex-foundation/mpl-core";
import { mplTokenMetadata } from "@metaplex-foundation/mpl-token-metadata";
import { mplToolbox } from "@metaplex-foundation/mpl-toolbox";
import {
	type PublicKey,
	type Signer,
	type TransactionBuilder,
	type Umi,
	createNoopSigner,
	publicKey,
	signerIdentity,
} from "@metaplex-foundation/umi";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { createWeb3JsRpc } from "@metaplex-foundation/umi-rpc-web3js";
import { createSignerFromWalletAdapter } from "@metaplex-foundation/umi-signer-wallet-adapters";
import type { WalletAdapter } from "@solana/wallet-adapter-base";
import type { Connection } from "@solana/web3.js";
import { create } from "zustand";

export enum ConnectionStatus {
	CONNECTED = "connected",
	DISCONNECTED = "disconnected",
	CONNECTING = "connecting",
	RECONNECTING = "reconnecting",
	ERROR = "error",
}

/**
 * Interface defining the state shape for Umi.
 */
interface UmiState {
	/**
	 * The Umi instance for interacting with the Solana network.
	 */
	umi: Umi;
	/**
	 * The signer for signing transactions.
	 */
	signer: Signer | undefined;
	/**
	 * The RPC endpoint URL for the Solana network.
	 */
	rpcEndpoint: string;
	/**
	 * The network to use for the Umi instance.
	 */
	network: Network;
	/**
	 * The network configuration for the current network.
	 */
	networkConfig: NetworkConfig;
	/**
	 * The current connection status to the RPC endpoint.
	 */
	connectionStatus: ConnectionStatus;
	/**
	 * Error message if connection fails.
	 */
	connectionError: string | null;
	/**
	 * Number of connection retry attempts.
	 */
	retryCount: number;
	/**
	 * Maximum number of retry attempts.
	 */
	maxRetries: number;
	/**
	 * Clear the signer by setting it to undefined.
	 */
	clearSigner: () => void;
	/**
	 * Update the signer in the state if it differs from the current one.
	 * @param {WalletAdapter} signer - The new wallet adapter to set as signer.
	 */
	updateSigner: (signer: WalletAdapter) => void;

	connection: () => Connection;
	/**
	 * Update the RPC endpoint and reinitialize Umi with the new endpoint.
	 * @param {string} endpoint - The new RPC endpoint URL.
	 */
	updateRpcEndpoint: (endpoint: string) => void;
	/**
	 * Set the network to use for the Umi instance.
	 * @param {Network} network - The network to use.
	 * @param {string} [customEndpoint] - The custom RPC endpoint URL to use.
	 */
	setNetwork: (network: Network, customEndpoint?: string) => void;

	getTokenBalances: () => Promise<
		{
			mint: PublicKey;
			amount: bigint;
			owner: PublicKey;
			tokenAddress: PublicKey;
			decimals: number;
			symbol: string;
			name: string;
		}[]
	>;
	/**
	 * Get the network configuration for the current network.
	 * @returns {Record<Network, NetworkConfig>} - The network configuration.
	 */
	getNetworkConfig: () => Record<Network, NetworkConfig>;
	/**
	 * Check the connection status with the RPC endpoint.
	 * @returns {Promise<boolean>} - Promise resolving to true if connected successfully.
	 */
	checkConnection: () => Promise<boolean>;
	/**
	 * Attempt to reconnect to the RPC endpoint with retry logic.
	 * @returns {Promise<boolean>} - Promise resolving to true if reconnected successfully.
	 */
	reconnect: () => Promise<boolean>;
	/**
	 * Set the maximum number of retry attempts for connections.
	 * @param {number} count - The maximum number of retries.
	 */
	setMaxRetries: (count: number) => void;
	/**
	 * Fetch and calculate priority fee for a transaction based on recent fees.
	 * @param transaction - The TransactionBuilder to analyze
	 */
	getPriorityFee: (transaction: TransactionBuilder) => Promise<number>;
}

export enum Network {
	/**
	 * The devnet network.
	 */
	DEVNET = "devnet",
	/**
	 * The testnet network.
	 */
	TESTNET = "testnet",
	/**
	 * The mainnet-beta network.
	 */
	MAINNET = "mainnet-beta",
	/**
	 * A custom network.
	 */
	CUSTOM = "custom",
}

export type NetworkConfig = {
	/**
	 * The name of the network.
	 */
	name: Network;
	/**
	 * The RPC endpoint URL for the network.
	 */
	endpoint: string;
	/**
	 * The websocket endpoint URL for the network.
	 */
	websocket?: string;
};

// Default RPC host environment variable or fallback to a default.

// Default network configurations
const NETWORK_CONFIGS: Record<Network, NetworkConfig> = {
	[Network.MAINNET]: {
		name: Network.MAINNET,
		endpoint:
			"https://mainnet.helius-rpc.com/?api-key=7249b645-b969-4853-aa40-f440ee4a5762",
		websocket: "wss://api.mainnet-beta.solana.com",
	},
	[Network.DEVNET]: {
		name: Network.DEVNET,
		endpoint: "https://api.devnet.solana.com",
		websocket: "wss://api.devnet.solana.com",
	},
	[Network.TESTNET]: {
		name: Network.TESTNET,
		endpoint: "https://api.testnet.solana.com",
		websocket: "wss://api.testnet.solana.com",
	},
	[Network.CUSTOM]: {
		name: Network.CUSTOM,
		endpoint: "",
	},
};

const defaultNetwork =
	(process.env.NEXT_PUBLIC_SOLANA_NETWORK as Network) || Network.DEVNET;
const defaultEndpoint =
	process.env.NEXT_PUBLIC_SOLANA_RPC_HOST ||
	NETWORK_CONFIGS[defaultNetwork].endpoint;

// Zustand store for managing Umi state
const useUmiStore = create<UmiState>()((set, get) => ({
	// Initialize Umi with the RPC host and necessary plugins
	umi: createUmi(defaultEndpoint)
		.use(
			signerIdentity(
				createNoopSigner(publicKey("11111111111111111111111111111111")),
			),
		)
		.use(mplCore())
		.use(mplToolbox())
		.use(mplTokenMetadata()),

	signer: undefined,

	rpcEndpoint: defaultEndpoint,

	network: defaultNetwork,

	networkConfig: NETWORK_CONFIGS[defaultNetwork],

	connectionStatus: ConnectionStatus.CONNECTING,

	connectionError: null,

	retryCount: 0,

	maxRetries: 5,

	connection: () => {
		const { umi } = get();
		return createWeb3JsRpc(umi, umi.rpc.getEndpoint()).connection;
	},
	clearSigner: () => {
		// Clear the signer by setting it to undefined
		set(() => ({ signer: undefined }));
	},
	/**
	 * Update the signer in the state if it differs from the current one.
	 * @param {WalletAdapter} signer - The new wallet adapter to set as signer.
	 */
	updateSigner: (signer) => {
		const currentSigner = get().signer;
		const newSigner = createSignerFromWalletAdapter(signer);

		if (
			!currentSigner ||
			currentSigner.publicKey.toString() !== newSigner.publicKey.toString()
		) {
			set(() => ({ signer: newSigner }));
		}
	},
	/**
	 * Update the RPC endpoint and reinitialize Umi with the new endpoint.
	 * @param {string} endpoint - The new RPC endpoint URL.
	 */
	updateRpcEndpoint(endpoint: string) {
		const newUmi = createUmi(endpoint)
			.use(
				signerIdentity(
					createNoopSigner(publicKey("11111111111111111111111111111111")),
				),
			)
			.use(mplCore())
			.use(mplToolbox())
			.use(mplTokenMetadata());

		set(() => ({ umi: newUmi, rpcEndpoint: endpoint }));
		get().checkConnection();
	},
	/**
	 * Set the network to use for the Umi instance.
	 * @param {Network} network - The network to use.
	 * @param {string} [customEndpoint] - The custom RPC endpoint URL to use.
	 */
	setNetwork: (network: Network, customEndpoint?: string) => {
		const config = { ...NETWORK_CONFIGS[network] };
		if (network === Network.CUSTOM && customEndpoint) {
			config.endpoint = customEndpoint;
		}
		const endpoint = config.endpoint || defaultEndpoint;
		const newUmi = createUmi(endpoint)
			.use(
				signerIdentity(
					createNoopSigner(publicKey("11111111111111111111111111111111")),
				),
			)
			.use(mplCore())
			.use(mplToolbox())
			.use(mplTokenMetadata());

		set(() => ({
			umi: newUmi,
			rpcEndpoint: endpoint,
			network: network,
			networkConfig: config,
		}));
		get().checkConnection();
	},

	getTokenBalances: (): Promise<
		{
			mint: PublicKey;
			amount: bigint;
			owner: PublicKey;
			tokenAddress: PublicKey;
			decimals: number;
			symbol: string;
			name: string;
		}[]
	> => {
		const { umi, signer } = get();
		if (!signer) {
			return Promise.resolve([]);
		}
		return tokenBalances(umi, signer);
	},

	getNetworkConfig: () => NETWORK_CONFIGS,

	/**
	 * Check connection status with the RPC endpoint.
	 */
	checkConnection: async () => {
		const { umi, reconnect } = get();

		set(() => ({ connectionStatus: ConnectionStatus.CONNECTING }));

		try {
			// Attempt to get recent blockhash as a connection test
			const latestBlockhash = await umi.rpc.getLatestBlockhash();

			// If successful, set connected status
			set(() => ({
				connectionStatus: ConnectionStatus.CONNECTED,
				connectionError: null,
				retryCount: 0,
			}));
			return true;
		} catch (error) {
			// Set error status and attempt reconnect
			set(() => ({
				connectionStatus: ConnectionStatus.ERROR,
				connectionError: error instanceof Error ? error.message : String(error),
			}));

			// Attempt to reconnect
			return reconnect();
		}
	},
	/**
	 * Attempt to reconnect to the RPC with exponential backoff
	 */
	reconnect: async () => {
		const { retryCount, maxRetries, umi, rpcEndpoint } = get();

		// If max retries exceeded, set to disconnected state
		if (retryCount >= maxRetries) {
			set(() => ({
				connectionStatus: ConnectionStatus.DISCONNECTED,
				connectionError: `Failed to connect after ${maxRetries} attempts`,
			}));
			return false;
		}

		// Set reconnecting state
		set(() => ({
			connectionStatus: ConnectionStatus.RECONNECTING,
			retryCount: retryCount + 1,
		}));
		// Calculate backoff time: 2^retry * 1000ms (1s, 2s, 4s, 8s, 16s)
		const backoffTime = Math.min(2 ** retryCount * 1000, 30000);

		// Wait for backoff time
		await new Promise((resolve) => setTimeout(resolve, backoffTime));

		try {
			// Attempt to get recent blockhash as a connection test
			const latestBlockhash = await umi.rpc.getLatestBlockhash();

			// If successful, set connected status
			set(() => ({
				connectionStatus: ConnectionStatus.CONNECTED,
				connectionError: null,
				retryCount: 0,
			}));
			return true;
		} catch (error) {
			// Try again with recursive call
			return get().reconnect();
		}
	},
	/**
	 * Set maximum number of retry attempts
	 */
	setMaxRetries: (count: number) => {
		set(() => ({ maxRetries: count }));
	},
	/**
	 * Calculate average priority fee for a transaction by querying the RPC endpoint.
	 */
	getPriorityFee: async (transaction: TransactionBuilder): Promise<number> => {
		const { umi } = get();
		// Collect distinct writable keys
		const keys = new Set<string>();
		for (const item of transaction.items) {
			for (const keyMeta of item.instruction.keys) {
				if (keyMeta.isWritable) {
					keys.add(keyMeta.pubkey.toString());
				}
			}
		}
		// RPC call to getRecentPrioritizationFees
		const response = await fetch(umi.rpc.getEndpoint(), {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				jsonrpc: "2.0",
				id: 1,
				method: "getRecentPrioritizationFees",
				params: [Array.from(keys)],
			}),
		});
		if (!response.ok) {
			throw new Error(`Failed to fetch priority fees: ${response.status}`);
		}
		const data = (await response.json()) as {
			result: { prioritizationFee: number }[];
		};
		const fees = data.result?.map((e) => e.prioritizationFee) || [];
		const topFees = fees.sort((a, b) => b - a).slice(0, 100);
		if (topFees.length > 0) {
			const sum = topFees.reduce((acc, fee) => acc + fee, 0);
			return Math.ceil(sum / topFees.length);
		}
		return 0;
	},
}));

// Initialize connection check on store creation
setTimeout(() => {
	useUmiStore.getState().checkConnection();
}, 0);

export default useUmiStore;

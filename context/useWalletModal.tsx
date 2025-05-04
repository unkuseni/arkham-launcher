import { WalletModal } from "@/components/wallet-btn/wallet-modal";
import {
	type FC,
	type ReactNode,
	createContext,
	useContext,
	useMemo,
	useState,
} from "react";

export interface WalletModalContextState {
	visible: boolean;
	setVisible: (open: boolean) => void;
}

const DEFAULT_CONTEXT = {
	setVisible(_open: boolean) {
		console.error(constructMissingProviderErrorMessage("call", "setVisible"));
	},
	visible: false,
};
Object.defineProperty(DEFAULT_CONTEXT, "visible", {
	get() {
		console.error(constructMissingProviderErrorMessage("read", "visible"));
		return false;
	},
});

function constructMissingProviderErrorMessage(
	action: string,
	valueName: string,
) {
	return `You have tried to  ${action} "${valueName}" on a WalletModalContext without providing one. Make sure to render a WalletModalProvider as an ancestor of the component that uses WalletModalContext`;
}

export const WalletModalContext = createContext<WalletModalContextState>(
	DEFAULT_CONTEXT as WalletModalContextState,
);

export function useWalletModal(): WalletModalContextState {
	return useContext(WalletModalContext);
}

export interface WalletModalProviderProps extends WalletModalProps {
	children: ReactNode;
}

export const WalletModalProvider: FC<WalletModalProviderProps> = ({
	children,
	...modalProps
}) => {
	const [visible, setVisible] = useState(false);

	const contextValue = useMemo(
		() => ({
			visible,
			setVisible,
		}),
		[visible],
	); // Only update context when visibility changes

	return (
		<WalletModalContext.Provider value={contextValue}>
			{children}
			{visible && <WalletModal {...modalProps} />}
		</WalletModalContext.Provider>
	);
};

export interface WalletModalProps {
	className?: string;
	container?: string;
}

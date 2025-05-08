import { ThemeSwitcher } from "@/components/ui/mode-toggle";
import { useWallet } from "@solana/wallet-adapter-react";
import { MultiWalletButton } from "../wallet-btn";
export const Header = () => {
	const { connected } = useWallet();
	return (
		<header className="min-w-full px-4 py-2.5 md:px-6 md:py-4 xl:px-8 xl:py-6 mx-auto">
			<div className="flex justify-between items-center max-w-7xl mx-auto w-full">
				{connected && (
					<h1 className="flex items-center justify-center text-xl capitalize font-bold font-inter tracking-[-0.1] before:content-[' '] before:rounded-full before:w-2 before:h-2 before:bg-green-500 before:mr-4 before:inline-flex before:justify-center before:items-center before:animate-pulse">
						Connected
					</h1>
				)}
				<h1 className="text-xl capitalize font-bold font-inter tracking-[-0.1]">
					arkham
				</h1>
				<div className="flex items-center gap-2">
					<MultiWalletButton />
					<ThemeSwitcher />
				</div>
			</div>
		</header>
	);
};

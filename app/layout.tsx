import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import { ThemeProviderWrapper } from "@/context/theme-provider";
import UmiProvider from "@/context/umi-provider";
import { WalletAdapterProvider } from "@/context/wallet-adapter-provider";

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
	preload: true,
	weight: ["400", "500", "600", "700", "800", "900"],
	display: "swap",
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
	preload: true,
	weight: ["400", "500", "600", "700", "800", "900"],
	display: "swap",
});

const inter = Inter({
	subsets: ["latin"],
	variable: "--font-inter",
	weight: ["400", "500", "600", "700", "800", "900"],
	display: "swap",
	preload: true,
});

export const metadata: Metadata = {
	title: "Arkham Launcher",
	description: "Launch your x1000 memecoin using Arkham",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<WalletAdapterProvider>
			<UmiProvider>
				<html lang="en" suppressHydrationWarning>
					<body
						className={`${geistSans.variable} ${geistMono.variable} ${inter.variable} antialiased`}
					>
						<ThemeProviderWrapper>{children}</ThemeProviderWrapper>
					</body>
				</html>
			</UmiProvider>
		</WalletAdapterProvider>
	);
}

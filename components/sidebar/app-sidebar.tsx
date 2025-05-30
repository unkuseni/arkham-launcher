"use client";
import { Coins, Droplets, House } from "lucide-react";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarHeader,
} from "../ui/sidebar";
import { MultiWalletButton } from "../wallet-btn";
import { IconHeader } from "./icon-header";
import SidebarMain from "./sidebar-main";

const data = [
	{
		label: "Dashboard",
		title: "Home",
		url: "",
		icon: House,
		items: [],
	},
	{
		label: "Launchpad",
		title: "Token Management",
		url: "token/create-token",
		icon: Coins,
		items: [
			{
				title: "Create a Token",
				url: "token/create-token",
			},
			{
				title: "Mint a Token",
				url: "token/mint-token",
			},
			{
				title: "Update a Token",
				url: "token/update-token",
			},
			{
				title: "Transfer a Token",
				url: "token/transfer-token",
			},
			{
				title: "Delegate a Token",
				url: "token/delegate-token",
			},
			{
				title: "Burn a Token",
				url: "token/burn-token",
			},
			{
				title: "Freeze a Token",
				url: "token/freeze-token",
			},
		],
	},
	{
		label: "Pools",
		title: "Liquidity Management",
		url: "create-pool",
		icon: Droplets,
		items: [
			{
				title: "Create a Pool",
				url: "liquidity/create-pool",
			},
			{
				title: "Add Liquidity",
				url: "liquidity/add-liquidity",
			},
			{
				title: "Remove Liquidity",
				url: "liquidity/remove-liquidity",
			},
			{
				title: "Swap Tokens",
				url: "liquidity/swap-tokens",
			},
			{ title: "Lock Liquidity", url: "liquidity/lock" },
			{
				title: "View Pool Info",
				url: "liquidity/view-pool-info",
			},

		],
	},
];

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
	return (
		<Sidebar collapsible="offcanvas" {...props}>
			<SidebarHeader>
				<IconHeader text="Arkham" />
			</SidebarHeader>
			<SidebarContent>
				<SidebarMain links={data} />
			</SidebarContent>
			<SidebarFooter className="flex items-center">
				<MultiWalletButton />
			</SidebarFooter>
		</Sidebar>
	);
}

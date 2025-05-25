"use client";
import { Coins, Droplets, House } from "lucide-react";
import { title } from "process";
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
		url: "create-token",
		icon: Coins,
		items: [
			{
				title: "Create a Token",
				url: "create-token",
			},
			{
				title: "Mint a Token",
				url: "mint-token",
			},
			{
				title: "Update a Token",
				url: "update-token",
			},
			{
				title: "Transfer a Token",
				url: "transfer-token",
			},
			{
				title: "Delegate a Token",
				url: "delegate-token",
			},
			{
				title: "Burn a Token",
				url: "burn-token",
			},
			{
				title: "Freeze a Token",
				url: "freeze-token",
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
				url: "create-pool",
			},
			{
				title: "Add Liquidity",
				url: "add-liquidity",
			},
			{
				title: "Remove Liquidity",
				url: "remove-liquidity",
			},
			{
				title: "Swap Tokens",
				url: "swap-tokens",
			},
			{
				title: "View Pool Info",
				url: "view-pool-info",
			},
		]
	}
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

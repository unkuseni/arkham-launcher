"use client";
import { Coins } from "lucide-react";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarHeader,
	SidebarRail,
} from "../ui/sidebar";
import { MultiWalletButton } from "../wallet-btn";
import { IconHeader } from "./icon-header";
import SidebarMain from "./sidebar-main";

const data = [
	{
		label: "Dashboard",
		title: "Create a token",
		url: "dashboard",
		icon: Coins,
		items: [],
	},
];

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
	return (
		<Sidebar collapsible="icon" {...props}>
			<SidebarHeader>
				<IconHeader text="Arkham" />
			</SidebarHeader>
			<SidebarContent>
				<SidebarMain items={data} />
			</SidebarContent>
			<SidebarFooter className="flex items-center">
				<MultiWalletButton />
			</SidebarFooter>
			<SidebarRail />
		</Sidebar>
	);
}

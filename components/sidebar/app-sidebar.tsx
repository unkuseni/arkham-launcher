"use client";
import { Coins } from "lucide-react";
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
		icon: Coins,
		items: [],
	},
	{
		label: "Launchpad",
		title: "Create a token",
		url: "create-token",
		icon: Coins,
		items: [],
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

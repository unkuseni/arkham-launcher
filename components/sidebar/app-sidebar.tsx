"use client";
import { Coins } from "lucide-react";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarHeader,
	SidebarRail,
} from "../ui/sidebar";
import { IconHeader } from "./icon-header";
import SidebarMain from "./sidebar-main";

const data = [
	{
		label: "Dashboard",
		title: "Create a token",
		url: "/",
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
			<SidebarFooter></SidebarFooter>
			<SidebarRail />
		</Sidebar>
	);
}

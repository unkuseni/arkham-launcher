"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { title } from "process";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "./ui/collapsible";
import { ThemeSwitcher } from "./ui/mode-toggle";
import {
	Sidebar,
	SidebarContent,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarProvider,
	SidebarRail,
} from "./ui/sidebar";

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
	const path = usePathname();
	const currentPath = path.split("/").pop();

	return (
		<Sidebar {...props}>
			<SidebarHeader className="flex flex-row items-center justify-between px-4 py-2.5">
				<Link href={"/dashboard"}>
					<h2 className="font-sans font-bold">Home</h2>
				</Link>
				<ThemeSwitcher />
			</SidebarHeader>
			<SidebarContent className="gap-0">
				{data.navSections.map((section) => (
					<Collapsible
						key={section.title}
						title={section.title}
						defaultOpen
						className="group/collapsible"
					>
						<SidebarGroup>
							<SidebarGroupLabel
								asChild
								className="group/label text-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
							>
								<CollapsibleTrigger>{section.title}</CollapsibleTrigger>
							</SidebarGroupLabel>
							<CollapsibleContent>
								<SidebarGroupContent>
									<SidebarMenu>
										{section.items.map((item) => (
											<SidebarMenuItem key={item.title}>
												<SidebarMenuButton
													asChild
													isActive={item.url === currentPath}
												>
													<Link href={`/dashboard/${item.url}`}>
														{item.title}
													</Link>
												</SidebarMenuButton>
											</SidebarMenuItem>
										))}
									</SidebarMenu>
								</SidebarGroupContent>
							</CollapsibleContent>
						</SidebarGroup>
					</Collapsible>
				))}
			</SidebarContent>
			<SidebarRail />
		</Sidebar>
	);
}

const data = {
	navSections: [
		{
			title: "Home",
			url: "#",
			items: [],
		},
		{
			title: "Account",
			items: [
				{
					title: "Profile",
					url: "profile",
				},
				{
					title: "Settings",
					url: "settings",
				},
			],
		},
		{
			title: "Launchpad",
			items: [
				{
					title: "Token Launchpad",
					url: "launchpad",
				},
				{
					title: "NFT Launchpad",
					url: "nft-launchpad",
				},
				{
					title: "Marketplace",
					url: "marketplace",
				},
			],
		},
	],
};

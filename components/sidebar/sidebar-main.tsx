import { ChevronRight, House, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { FC } from "react";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "../ui/collapsible";
import {
	SidebarGroup,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSub,
	SidebarMenuSubButton,
	SidebarMenuSubItem,
} from "../ui/sidebar";

interface SidebarMainItem {
	label?: string;
	title: string;
	url: string;
	icon?: LucideIcon;
	items?: {
		title: string;
		url: string;
	}[];
}

interface SidebarMainProps {
	items: SidebarMainItem[];
}

const data = [
	{
		label: "Dashboard",
		title: "Home",
		url: "dashboard",
		icon: House,
		items: [],
	},
];

export const SidebarMain = ({ items = data }: SidebarMainProps) => {
	const pathname = usePathname();

	const currentPath = pathname.split("/").pop();
	console.log(currentPath);
	return (
		<SidebarGroup>
			<SidebarGroupLabel className="font-sans font-semibold text-sm">
				Dashboard
			</SidebarGroupLabel>
			<SidebarMenu>
				{items.map((item) => {
					if (item.items?.length === 0) {
						return (
							<SidebarMenuItem key={item.title}>
								<SidebarMenuButton
									tooltip={item.title}
									className="font-inter font-bold active:bg-green-500"
									isActive={currentPath === item.url}
								>
									{item.icon && <item.icon className="size-4" />}
									<span>{item.title}</span>
								</SidebarMenuButton>
							</SidebarMenuItem>
						);
					}
					return (
						<Collapsible
							key={item.title}
							defaultOpen={currentPath === item.url}
							className="group/collapsible"
							asChild
						>
							<SidebarMenuItem>
								<CollapsibleTrigger asChild>
									<SidebarMenuButton
										tooltip={item.title}
										className="font-inter font-bold"
									>
										{item.icon && <item.icon className="size-4" />}
										<span>{item.title}</span>
										<ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
									</SidebarMenuButton>
								</CollapsibleTrigger>
								<CollapsibleContent>
									<SidebarMenuSub>
										{item.items?.map((subItem) => (
											<SidebarMenuSubItem key={subItem.title}>
												<SidebarMenuSubButton asChild className="font-inter">
													<Link href={subItem.url}>{subItem.title}</Link>
												</SidebarMenuSubButton>
											</SidebarMenuSubItem>
										))}
									</SidebarMenuSub>
								</CollapsibleContent>
							</SidebarMenuItem>
						</Collapsible>
					);
				})}
			</SidebarMenu>
		</SidebarGroup>
	);
};

export default SidebarMain;

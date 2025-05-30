import { ChevronRight, House, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment } from "react";
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
	links: SidebarMainItem[];
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

export const SidebarMain = ({ links = data }: SidebarMainProps) => {
	const pathname = usePathname();
	const currentPath = pathname.split("/").pop();
	return (
		<SidebarGroup>
			{links.map((item) => {
				const itemKey = item.url || item.title;
				if (item.items?.length === 0) {
					return (
						<Fragment key={itemKey}>
							<SidebarGroupLabel className="font-sans font-semibold text-sm">
								{item.label}
							</SidebarGroupLabel>
							<SidebarMenu>
								<SidebarMenuItem>
									<SidebarMenuButton
										tooltip={item.title}
										className="font-inter font-bold"
										isActive={currentPath === item.url}
										asChild
									>
										<Link
											href={`/dashboard/${item.url}`}
											className="flex items-center gap-2"
											prefetch={true}
										>
											{item.icon && <item.icon className="size-4" />}
											{item.title}
										</Link>
									</SidebarMenuButton>
								</SidebarMenuItem>
							</SidebarMenu>
						</Fragment>
					);
				}
				return (
					<Fragment key={itemKey}>
						<SidebarGroupLabel className="font-sans font-semibold text-sm">
							{item.label}
						</SidebarGroupLabel>
						<SidebarMenu>
							<Collapsible
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
													<SidebarMenuSubButton
														asChild
														className="font-inter"
														isActive={currentPath === subItem.url}
													>
														<Link href={`/dashboard/${subItem.url}`} prefetch={true}>
															{subItem.title}
														</Link>
													</SidebarMenuSubButton>
												</SidebarMenuSubItem>
											))}
										</SidebarMenuSub>
									</CollapsibleContent>
								</SidebarMenuItem>
							</Collapsible>
						</SidebarMenu>
					</Fragment>
				);
			})}
		</SidebarGroup>
	);
};

export default SidebarMain;

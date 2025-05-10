"use client";
import {
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@/components/ui/sidebar";

import { Rocket } from "lucide-react";
import Link from "next/link";
import { ThemeSwitcher } from "../ui/mode-toggle";

export function IconHeader({
	logo = "/next.svg",
	text = "Vercel",
	url = "/",
}: { logo?: string; text: string; url?: string }) {
	if (!logo || !text || !url) {
		return null;
	}

	return (
		<SidebarMenu>
			<SidebarMenuItem>
				<SidebarMenuButton
					size="lg"
					className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground justify-between"
				>
					<div className="flex items-center justify-between w-full">
						<div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-gray-300 dark:bg-gray-600">
							<Link href={url}>
								<Rocket className="size-4" />
							</Link>
						</div>
						<Link href={url} className="flex items-center gap-5 ">
							<h2 className="text-xs font-bold font-inter">{text}</h2>
						</Link>
						<ThemeSwitcher />
					</div>
				</SidebarMenuButton>
			</SidebarMenuItem>
		</SidebarMenu>
	);
}

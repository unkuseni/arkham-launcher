"use client";
import {
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@/components/ui/sidebar";

import { Rocket } from "lucide-react";
import Image from "next/image";
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
				{/* This div will act as the flex container for the link and the theme switcher */}
				<div className="flex items-center justify-between w-full">
					{/* Wrap the SidebarMenuButton with Next.js Link and make SidebarMenuButton render as an anchor tag */}
					<Link href={url} className="w-2/3">
						<SidebarMenuButton
							size="lg"
							className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground flex-grow items-center" // flex-grow to take available space
						>
							<div className="flex items-center justify-between w-full">
								{" "}
								{/* Inner div for content alignment */}
								<div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-gray-300 dark:bg-gray-600">
									{/* Use img tag for dynamic logo, fallback to Rocket icon */}
									{logo && logo !== "/next.svg" ? (
										<Image
											src={logo}
											alt={text}
											className="h-4 w-4 object-contain"
										/>
									) : (
										<Rocket className="size-4" />
									)}
								</div>
								<h2 className="text-xs font-bold font-inter ml-2">{text}</h2>
							</div>
						</SidebarMenuButton>
					</Link>

					{/* ThemeSwitcher is now a sibling to the Link/SidebarMenuButton */}
					<ThemeSwitcher />
				</div>
			</SidebarMenuItem>
		</SidebarMenu>
	);
}
// ...existing code...

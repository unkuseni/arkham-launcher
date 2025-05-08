"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

export const ThemeSwitcher = () => {
	const { theme, setTheme } = useTheme();

	return (
		<Button
			size={"icon"}
			variant={"ghost"}
			className={cn("")}
			onClick={() => setTheme(theme === "light" ? "dark" : "light")}
		>
			{theme === "light" ? (
				<Moon height={24} width={24} />
			) : (
				<Sun height={24} width={24} />
			)}
		</Button>
	);
};

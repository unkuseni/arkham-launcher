"use client";

import { cn } from "@/lib/utils";
import { MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "../ui/button";

const ThemeSwitcher = () => {
	const { theme, setTheme } = useTheme();

	let currentTheme = theme;

	if (theme === "system") {
		currentTheme =
			typeof window !== "undefined" &&
			window.matchMedia("(prefers-color-scheme: dark)").matches
				? "dark"
				: "light";
	}

	return (
		<Button size={"icon"} className={cn("")}>
			{currentTheme === "light" ? (
				<MoonIcon height={24} width={24} onClick={() => setTheme("dark")} />
			) : (
				<SunIcon height={24} width={24} onClick={() => setTheme("light")} />
			)}
		</Button>
	);
};

export default ThemeSwitcher;

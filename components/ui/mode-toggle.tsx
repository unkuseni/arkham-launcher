'use client';

import { cn } from "@/lib/utils";
import { MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "../ui/button";
import { useEffect, useState } from "react";

const ThemeSwitcher = () => {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <Button size="icon" className={cn("")} />;
  }

  const currentTheme = theme === "system" 
    ? typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light"
    : theme;

  return (
    <Button 
      size="icon" 
      className={cn("")}
      onClick={() => setTheme(currentTheme === "light" ? "dark" : "light")}
    >
      {currentTheme === "light" ? (
        <MoonIcon height={24} width={24} />
      ) : (
        <SunIcon height={24} width={24} />
      )}
    </Button>
  );
};

export default ThemeSwitcher;
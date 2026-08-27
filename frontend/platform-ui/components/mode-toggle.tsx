"use client";

import * as React from "react";
import { Moon, Sun, SunMedium } from "lucide-react";
import { useTheme } from "@/components/theme-provider";

import { Button } from "@/components/ui/button";

export function ModeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const cycleTheme = () => {
    if (theme === "light") setTheme("dim");
    else if (theme === "dim") setTheme("dark");
    else setTheme("light");
  };

  const getThemeTitle = () => {
    if (!mounted) return undefined;
    if (theme === "dim") return "Theme: Dim Slate Mode (Click to toggle)";
    if (theme === "dark") return "Theme: Dark Mode (Click to toggle)";
    return "Theme: Light Mode (Click to toggle)";
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={cycleTheme}
      className="rounded-full h-8 w-8 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors relative"
      title={getThemeTitle()}
    >
      {mounted && theme === "light" && <Sun className="h-[1.1rem] w-[1.1rem] text-amber-500" />}
      {mounted && theme === "dim" && <SunMedium className="h-[1.1rem] w-[1.1rem] text-indigo-400" />}
      {mounted && theme === "dark" && <Moon className="h-[1.1rem] w-[1.1rem] text-slate-200" />}
      {!mounted && <Sun className="h-[1.1rem] w-[1.1rem]" />}
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}


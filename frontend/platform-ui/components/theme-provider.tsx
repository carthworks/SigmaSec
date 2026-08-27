"use client";

import * as React from "react";

export type Theme = "dark" | "light" | "system";

export interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: string;
  attribute?: string;
  enableSystem?: boolean;
  themes?: string[];
  disableTransitionOnChange?: boolean;
}

const ThemeContext = React.createContext<{
  theme: string;
  setTheme: (theme: string) => void;
  themes?: string[];
}>({
  theme: "dark",
  setTheme: () => {},
  themes: ["light", "dark", "system"],
});

export function ThemeProvider({
  children,
  defaultTheme = "dark",
}: ThemeProviderProps) {
  const [theme, setThemeState] = React.useState<string>(defaultTheme);

  React.useEffect(() => {
    const saved = localStorage.getItem("theme") || defaultTheme;
    setThemeState(saved);
    applyTheme(saved);
  }, [defaultTheme]);

  const applyTheme = (t: string) => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.classList.remove("light", "dark", "dim");
    if (t === "system") {
      const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      root.classList.add(systemDark ? "dark" : "light");
    } else {
      root.classList.add(t);
    }
  };

  const setTheme = (t: string) => {
    setThemeState(t);
    try {
      localStorage.setItem("theme", t);
    } catch {}
    applyTheme(t);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themes: ["light", "dark", "system"] }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => React.useContext(ThemeContext);

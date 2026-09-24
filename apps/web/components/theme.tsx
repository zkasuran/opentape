// SPDX-License-Identifier: LicenseRef-zkasuran-SAND-1.0
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Moon, Sun } from "lucide-react";
import type { ThemeName } from "../lib/palette";

interface ThemeState {
  theme: ThemeName;
  mounted: boolean;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeState | null>(null);

// The inline <head> script in layout.tsx has already set data-theme before paint,
// so on the client we read the real value back; on the server we assume dark so the
// first render is deterministic (the toggle icon only renders after mount).
function readTheme(): ThemeName {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemeName>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setTheme(readTheme());
    setMounted(true);
  }, []);

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next: ThemeName = prev === "dark" ? "light" : "dark";
      try {
        localStorage.setItem("theme", next);
      } catch {
        /* private mode or storage disabled, keep the in-memory choice */
      }
      document.documentElement.setAttribute("data-theme", next);
      return next;
    });
  }, []);

  const value = useMemo<ThemeState>(() => ({ theme, mounted, toggle }), [theme, mounted, toggle]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeState {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

export function ThemeToggle() {
  const { theme, mounted, toggle } = useTheme();
  const isDark = theme === "dark";
  return (
    <button
      type="button"
      className="btn btn-icon"
      onClick={toggle}
      aria-pressed={mounted ? isDark : undefined}
      aria-label={
        mounted ? (isDark ? "Switch to light theme" : "Switch to dark theme") : "Toggle color theme"
      }
      title="Toggle theme"
    >
      {!mounted ? (
        <Sun size={17} style={{ opacity: 0 }} aria-hidden="true" />
      ) : isDark ? (
        <Sun size={17} aria-hidden="true" />
      ) : (
        <Moon size={17} aria-hidden="true" />
      )}
    </button>
  );
}

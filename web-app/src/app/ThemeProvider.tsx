import { createContext, useContext, useLayoutEffect, useState, type ReactNode } from "react";

type Theme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const THEME_KEY = "chs.admin.theme";

/**
 * The admin's last choice on this browser; with none, the system's
 * preference. Storage can be blocked (a private window, a locked-down
 * browser), and then the choice lasts for the tab.
 */
function initialTheme(): Theme {
  try {
    const stored = globalThis.localStorage?.getItem(THEME_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // Unreadable storage: fall through to the system preference.
  }
  return globalThis.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/**
 * Theme is one attribute on the document element (data-theme="dark"), which
 * re-points the CSS custom properties in styles/tokens.css. See README.md,
 * "Colour — dark". It is applied before paint, so a reload in dark mode does
 * not flash light first.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(initialTheme);

  useLayoutEffect(() => {
    if (theme === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
  }, [theme]);

  // Only an explicit toggle is stored; until then the system preference keeps deciding.
  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    try {
      globalThis.localStorage?.setItem(THEME_KEY, next);
    } catch {
      // See initialTheme: in-memory only.
    }
  };

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}

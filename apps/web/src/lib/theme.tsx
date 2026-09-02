import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  /** True when the theme is following the operating system rather than a stored choice. */
  followsSystem: boolean;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const STORAGE_KEY = "c26_theme";

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

/**
 * Reads the stored choice, if the user has made one.
 *
 * Wrapped in try/catch because a browser in private mode, or one configured to
 * block site data, throws on access rather than returning null. A theme is not
 * worth a blank screen.
 */
function readStoredTheme(): Theme | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : null;
  } catch {
    return null;
  }
}

function systemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/**
 * Theme, resolved from the stored choice and otherwise from the operating
 * system.
 *
 * Two things changed here and both were user-visible. The theme used to default
 * to light and ignore `prefers-color-scheme` entirely, so someone whose phone
 * is set to dark got a white screen until they found the toggle. And the class
 * was only ever added or removed, never set explicitly, which the token layer
 * in index.css now needs — it distinguishes "chose light", "chose dark", and
 * "has not chosen", and only the last one follows the system.
 *
 * The white flash on load is handled in index.css rather than here, with a
 * `prefers-color-scheme` fallback that paints before React mounts. The usual
 * fix is a small inline <script> in the document head; the CSP forbids inline
 * scripts outright (PLAN/13 §7), so the fallback has to be CSS.
 */
export function ThemeProvider({ children }: { children: ReactNode }): ReactNode {
  const [stored, setStored] = useState<Theme | null>(() => readStoredTheme());
  const [system, setSystem] = useState<Theme>(() => systemTheme());

  const theme = stored ?? system;

  // Follow the operating system while the user has expressed no preference of
  // their own. Someone whose phone flips to dark at sunset should not have to
  // reload the page.
  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (event: MediaQueryListEvent): void => {
      setSystem(event.matches ? "dark" : "light");
    };
    query.addEventListener("change", onChange);
    return () => {
      query.removeEventListener("change", onChange);
    };
  }, []);

  useEffect(() => {
    // Both classes are written explicitly, never merely toggled: index.css
    // treats "neither class present" as "follow the system", and Tailwind's
    // `dark:` variants key off `.dark`.
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.classList.toggle("light", theme === "light");
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    setStored(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // The choice still applies for this session; it simply will not survive
      // a reload. Better than failing the render.
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [setTheme, theme]);

  const value = useMemo(
    () => ({ theme, followsSystem: stored === null, setTheme, toggleTheme }),
    [theme, stored, setTheme, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}

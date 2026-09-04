import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { ThemeProvider, useTheme } from "./theme.tsx";

/**
 * Which theme the application is in, and who decided.
 *
 * Two behaviours here were bugs before they were features. The theme used to
 * default to light and ignore `prefers-color-scheme` entirely, so somebody whose
 * phone is set to dark got a white screen until they found the toggle. And the
 * class was only ever added or removed, never set explicitly — which the token
 * layer in `index.css` now needs, because it distinguishes "chose light",
 * "chose dark", and "has not chosen", and only the last one follows the system.
 */

const STORAGE_KEY = "c26_theme";

function mockSystemPrefersDark(prefersDark: boolean): void {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches: prefersDark && query.includes("dark"),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
      onchange: null,
    })),
  );
}

function wrapper({ children }: { children: ReactNode }): ReactNode {
  return <ThemeProvider>{children}</ThemeProvider>;
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.className = "";
  mockSystemPrefersDark(false);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("with no choice stored", () => {
  it("follows a system set to dark", () => {
    // The bug this closes: a white screen on a phone set to dark, until the
    // user went looking for a toggle.
    mockSystemPrefersDark(true);
    const { result } = renderHook(() => useTheme(), { wrapper });

    expect(result.current.theme).toBe("dark");
    expect(result.current.followsSystem).toBe(true);
  });

  it("follows a system set to light", () => {
    const { result } = renderHook(() => useTheme(), { wrapper });

    expect(result.current.theme).toBe("light");
    expect(result.current.followsSystem).toBe(true);
  });
});

describe("with a choice stored", () => {
  it("uses it in preference to the system", () => {
    mockSystemPrefersDark(true);
    localStorage.setItem(STORAGE_KEY, "light");

    const { result } = renderHook(() => useTheme(), { wrapper });

    expect(result.current.theme).toBe("light");
    expect(result.current.followsSystem).toBe(false);
  });

  it("ignores a stored value that means nothing", () => {
    // Anything but the two words is treated as no choice at all, rather than
    // read as a theme name and rendered as neither.
    localStorage.setItem(STORAGE_KEY, "aubergine");
    const { result } = renderHook(() => useTheme(), { wrapper });

    expect(result.current.theme).toBe("light");
    expect(result.current.followsSystem).toBe(true);
  });
});

describe("the class on the document", () => {
  it("is written explicitly, not merely toggled", () => {
    // `index.css` reads "neither class present" as "follow the system", so
    // removing one without adding the other means a third, unintended state.
    render(<ThemeProvider>{null}</ThemeProvider>);

    expect(document.documentElement.classList.contains("light")).toBe(true);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("swaps both classes when the theme changes", () => {
    const { result } = renderHook(() => useTheme(), { wrapper });

    act(() => {
      result.current.setTheme("dark");
    });

    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.documentElement.classList.contains("light")).toBe(false);
  });
});

describe("choosing a theme", () => {
  it("remembers the choice for next time", () => {
    const { result } = renderHook(() => useTheme(), { wrapper });

    act(() => {
      result.current.setTheme("dark");
    });

    expect(localStorage.getItem(STORAGE_KEY)).toBe("dark");
    expect(result.current.followsSystem).toBe(false);
  });

  it("toggles to the other one", () => {
    const { result } = renderHook(() => useTheme(), { wrapper });

    act(() => {
      result.current.toggleTheme();
    });
    expect(result.current.theme).toBe("dark");

    act(() => {
      result.current.toggleTheme();
    });
    expect(result.current.theme).toBe("light");
  });

  it("still applies when storage refuses to hold it", () => {
    /*
     * A browser in private mode, or one set to block site data, throws on
     * access rather than returning null. A theme is not worth a blank screen,
     * so the choice applies for this session and simply does not survive a
     * reload.
     */
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    try {
      const { result } = renderHook(() => useTheme(), { wrapper });

      expect(() => {
        act(() => {
          result.current.setTheme("dark");
        });
      }).not.toThrow();

      expect(result.current.theme).toBe("dark");
    } finally {
      setItem.mockRestore();
    }
  });
});

describe("useTheme outside a provider", () => {
  it("says so rather than rendering the wrong theme", () => {
    // Silently returning a default would make the mistake invisible until
    // somebody noticed a screen that never changes.
    expect(() => renderHook(() => useTheme())).toThrow(/ThemeProvider/);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useDebounce } from "./use-debounce.ts";

/**
 * The delay between typing and asking the server.
 *
 * Its own docblock draws the line: use it for anything that reaches the
 * database, never for filtering a list already in memory. Getting that backwards
 * either floods the API with a request per keystroke, or makes a local dropdown
 * feel broken.
 */

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useDebounce", () => {
  it("gives the first value straight away", () => {
    // Nothing is being waited for yet, so an initial render must not show an
    // empty search for 350ms.
    const { result } = renderHook(() => useDebounce("bridgestone"));
    expect(result.current).toBe("bridgestone");
  });

  it("holds a change back until the delay has passed", () => {
    const { result, rerender } = renderHook(({ value }) => useDebounce(value, 350), {
      initialProps: { value: "a" },
    });

    rerender({ value: "ab" });
    expect(result.current).toBe("a");

    act(() => {
      vi.advanceTimersByTime(349);
    });
    expect(result.current).toBe("a");

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe("ab");
  });

  it("only ever reports the last value of a burst", () => {
    // Typing "ban" is three renders and must be one request, not three.
    const { result, rerender } = renderHook(({ value }) => useDebounce(value, 350), {
      initialProps: { value: "" },
    });

    for (const value of ["b", "ba", "ban"]) {
      rerender({ value });
      act(() => {
        vi.advanceTimersByTime(100);
      });
    }

    expect(result.current).toBe("");

    act(() => {
      vi.advanceTimersByTime(350);
    });
    expect(result.current).toBe("ban");
  });

  it("cancels a pending update when the component goes away", () => {
    // Navigating away mid-search must not set state on an unmounted component.
    const { rerender, unmount } = renderHook(({ value }) => useDebounce(value, 350), {
      initialProps: { value: "a" },
    });

    rerender({ value: "ab" });
    unmount();

    expect(() => {
      act(() => {
        vi.advanceTimersByTime(1000);
      });
    }).not.toThrow();
  });

  it("takes a delay of its own", () => {
    const { result, rerender } = renderHook(({ value }) => useDebounce(value, 50), {
      initialProps: { value: "a" },
    });

    rerender({ value: "b" });
    act(() => {
      vi.advanceTimersByTime(50);
    });

    expect(result.current).toBe("b");
  });

  it("works for something other than a string", () => {
    const { result, rerender } = renderHook(({ value }) => useDebounce(value, 100), {
      initialProps: { value: { page: 1 } },
    });

    rerender({ value: { page: 2 } });
    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(result.current).toEqual({ page: 2 });
  });
});

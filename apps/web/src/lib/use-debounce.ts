import { useEffect, useState } from "react";

/**
 * Custom hook to debounce any fast-changing value.
 *
 * Guidelines:
 * - Use this hook when filtering/searching data fetched from the DATABASE / server endpoint.
 * - Do NOT use this hook when filtering data that is ALREADY FETCHED into client memory
 *   (e.g., SearchableSelect, in-memory tables), to ensure instantaneous client-side responsiveness.
 *
 * @param value The value to debounce
 * @param delayMs Delay in milliseconds before updating the debounced value (default: 350ms)
 * @returns The debounced value
 */
export function useDebounce<T>(value: T, delayMs: number = 350): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delayMs]);

  return debouncedValue;
}

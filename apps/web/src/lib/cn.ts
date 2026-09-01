import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merges Tailwind classes so a caller's override actually wins. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

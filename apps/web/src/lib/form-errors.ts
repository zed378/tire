import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import { isApiError } from "./api-client.ts";

/**
 * Moves a 422's field errors from the response envelope onto the form.
 *
 * `PLAN/05` §5.1 gives three error channels, and the split between them is not
 * a matter of taste: an error that names a field belongs under that field, and
 * only what is left over becomes the page banner. Every form on the client has
 * to make that decision, so it is made once here rather than six times.
 *
 * Returns `true` when the error was consumed as field errors, `false` when the
 * caller still has to show it — as a banner, a toast, or whatever that screen
 * uses.
 */
export function applyFieldErrors<T extends FieldValues>(
  caught: unknown,
  setError: UseFormSetError<T>,
): boolean {
  if (!isApiError(caught) || caught.fieldErrors.length === 0) return false;

  for (const fieldError of caught.fieldErrors) {
    setError(fieldError.field as Path<T>, { message: fieldError.message });
  }
  return true;
}

/**
 * Whether an error already names the fields it is about.
 *
 * A mutation shared by a form and a plain button needs this: the form puts
 * those messages under its fields, so the page banner must stay quiet or the
 * user is told the same thing twice, in two places, in two wordings.
 */
export function hasFieldErrors(caught: unknown): boolean {
  return isApiError(caught) && caught.fieldErrors.length > 0;
}

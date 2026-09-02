/**
 * Display formatting.
 *
 * Dates are dd/mm/yyyy in WIB throughout. The legacy QC filter used mm/dd/yyyy —
 * an American format in an Indonesian application — which is the kind of detail
 * that makes a date range quietly select the wrong month (PLAN/02 §4).
 */

const WIB = "Asia/Jakarta";

export function formatDate(value: string | Date | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: WIB,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

export function formatDateTime(value: string | Date | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: WIB,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .format(new Date(value))
    .replace(",", "")
    .replace(".", ":");
}

/** Accepts an epoch number too: the offline queue timestamps its items that way. */
export function formatRelative(value: string | Date | number | null | undefined): string {
  if (value === null || value === undefined) return "—";

  const diffMs = Date.now() - new Date(value).getTime();
  // Floor, not round: 30 seconds ago is "baru saja", not "1 menit lalu".
  const minutes = Math.floor(diffMs / 60_000);

  if (minutes < 1) return "baru saja";
  if (minutes < 60) return `${minutes} menit lalu`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;

  const days = Math.round(hours / 24);
  if (days < 30) return `${days} hari lalu`;

  return formatDate(value);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("id-ID").format(value);
}

/** For a date input, which always speaks ISO regardless of what is displayed. */
export function toDateInputValue(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function startOfDayIso(dateInput: string): string {
  return new Date(`${dateInput}T00:00:00+07:00`).toISOString();
}

export function endOfDayIso(dateInput: string): string {
  return new Date(`${dateInput}T23:59:59+07:00`).toISOString();
}

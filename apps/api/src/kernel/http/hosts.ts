/**
 * Host-based routing, previously done by a reverse proxy.
 *
 * Two hostnames reach this process through Cloudflare Tunnel:
 *
 *   tire.zedth.my.id        the application — the SPA plus the whole API
 *   tire-store.zedth.my.id  the signed upload route, and nothing else
 *
 * The storage host serves customer fleet photographs, authorised solely by a
 * signed, expiring, single-purpose token (PLAN/05 §7). Keeping it to one route
 * means somebody who discovers that hostname cannot reach the QC queue, the user
 * list, or the audit trail through it — and learns nothing about what else
 * exists, because everything else answers 404 rather than 403.
 *
 * This lives in code rather than in proxy configuration on purpose. It is a
 * security boundary, and a security boundary that can be unit-tested is worth
 * more than one that lives in a config file nobody runs assertions against.
 */

/** The only path prefix the storage host will serve. */
const STORAGE_ROUTE_PREFIX = "/api/uploads/";

/**
 * Strips the port and lowercases, so `tire-store.zedth.my.id:8443` and
 * `TIRE-STORE.zedth.my.id` both match.
 */
export function normalizeHost(host: string | undefined): string {
  if (host === undefined) return "";
  return host.split(":")[0]?.trim().toLowerCase() ?? "";
}

export function isStorageHost(host: string | undefined, storageHost: string): boolean {
  const configured = normalizeHost(storageHost);
  if (configured === "") return false;
  return normalizeHost(host) === configured;
}

/**
 * Whether a request may proceed, given the hostname it arrived on.
 *
 * Returns true for every request on the application host. On the storage host,
 * only the signed upload route is allowed.
 */
export function isRouteAllowedForHost(params: {
  host: string | undefined;
  path: string;
  storageHost: string;
}): boolean {
  if (!isStorageHost(params.host, params.storageHost)) return true;

  // Query strings and fragments are not part of the routing decision, and a
  // path that merely *contains* the prefix must not pass — only one that starts
  // with it.
  const path = params.path.split("?")[0] ?? "";
  return path.startsWith(STORAGE_ROUTE_PREFIX);
}

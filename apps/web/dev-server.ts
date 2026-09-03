/**
 * Where the development server listens.
 *
 * One definition, imported by `vite.config.ts` and `playwright.config.ts`.
 * They used to each name a port of their own — Vite served 5573, Playwright
 * waited for 5173 — so `pnpm test:e2e` timed out after sixty seconds against a
 * server that had been up the whole time. Gate G-11 was never green because it
 * was never able to start.
 *
 * The host is `127.0.0.1` rather than `localhost` on purpose. Vite binds the
 * IPv4 address; on Windows `localhost` resolves to `::1` first, and a client
 * that follows that answer is refused by a server that is running perfectly.
 */
export const DEV_SERVER_HOST = "127.0.0.1";
export const DEV_SERVER_PORT = 5573;
export const DEV_SERVER_URL = `http://${DEV_SERVER_HOST}:${String(DEV_SERVER_PORT)}`;

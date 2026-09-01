/// <reference types="vite/client" />

/**
 * Declares the environment variables this client reads.
 *
 * Without it `import.meta.env.VITE_API_URL` is `any`, and an `any` flowing into
 * the URL every request is built from is exactly the kind of hole the `strict`
 * settings in `tsconfig.base.json` exist to close.
 */
interface ImportMetaEnv {
  /** Base URL of the API. Empty in development, where Vite proxies /api. */
  readonly VITE_API_URL?: string;
  /** Compared against the server's X-App-Version header (PLAN/06 §5.1). */
  readonly VITE_APP_VERSION?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

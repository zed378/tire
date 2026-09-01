---
description: Client-side rules
paths: ["apps/web/src/**/*.tsx", "apps/web/src/**/*.ts"]
---

# Web Rules (PLAN/05 §5, PLAN/06)

- `alert()`, `confirm()`, `prompt()` are absolutely forbidden. Confirmation
  uses the `Dialog` component; messages use `Banner` / `Toast`.
- Three error channels per `PLAN/05` §5.1: inline under the field
  (422/409/413/415), a banner above the content (page-level errors), a toast
  (success).
- `noValidate` on every `<form>`. Validation comes from the `@c26/contracts`
  Zod schema through `zodResolver`, so the browser's native tooltip never
  appears (`D-07`).
- Every submit button has a loading state (disabled + spinner).
- Scroll and focus automatically to the first field in error.
- A network failure becomes a `SERVICE_UNAVAILABLE` banner, never a silent
  failure.
- Every `500` shows a copyable `requestId`.
- Export buttons are never mute: click -> "Menyiapkan berkas…" toast ->
  polling -> toast with the download link (`D-09`).
- Session tokens are never stored in `localStorage` or IndexedDB. The
  `httpOnly` cookie holds them.
- Photos are never cached by the service worker.
- Components come from `components/ui/` (shadcn-style, owned by the repo).
  Do not build a new button or input from scratch.
- User-facing copy stays in Indonesian (`K-10`); identifiers and comments are
  English.

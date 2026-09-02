# Font files — provenance

These are copied from the `@fontsource` packages rather than imported from them, so that the
Vietnamese subset each package also ships does not reach the browser. That subset is roughly
60 KB we have no use for.

The packages themselves are **not** dependencies of this repo — they were installed, the six
files below were copied out, and the packages were removed. To update a font, install the
package again, copy the file, and remove the package.

Versions are not pinned here on purpose: the packages are not in `package.json`, so a
number written down would be a claim nothing checks. `pnpm view <package> version` gives
the current one when it is next updated.

| File | Package | Licence |
| --- | --- | --- |
| `archivo-latin-wght-normal.woff2` | `@fontsource-variable/archivo` | SIL Open Font License 1.1 |
| `archivo-latin-ext-wght-normal.woff2` | `@fontsource-variable/archivo` | SIL Open Font License 1.1 |
| `plus-jakarta-sans-latin-wght-normal.woff2` | `@fontsource-variable/plus-jakarta-sans` | SIL Open Font License 1.1 |
| `plus-jakarta-sans-latin-ext-wght-normal.woff2` | `@fontsource-variable/plus-jakarta-sans` | SIL Open Font License 1.1 |
| `ibm-plex-mono-latin-400-normal.woff2` | `@fontsource/ibm-plex-mono` | SIL Open Font License 1.1 |
| `ibm-plex-mono-latin-500-normal.woff2` | `@fontsource/ibm-plex-mono` | SIL Open Font License 1.1 |

All three families are licensed under the SIL Open Font License 1.1, which permits commercial
use, modification, and embedding. The licence requires that the fonts are not sold on their
own and that any derivative font is released under the same licence — neither applies to
serving them from a website.

Archivo and Plus Jakarta Sans are variable: one file covers weights 100–900. IBM Plex Mono
is static, so only the two weights actually used (400 and 500) are present.

Plus Jakarta Sans is by Tokotype, drawn as part of Jakarta's city identity. It is here
because the product is Indonesian and its users are, not because it tested marginally
better than the alternatives.

Declared in `src/styles/fonts.css`. Served from our own origin because the CSP is
`font-src 'self'` (PLAN/13 §7).

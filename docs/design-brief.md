# MASTER PROMPT — TIRE UI/UX REDESIGN (v2)

Merged brief. Supersedes the previous master prompt.
Target: `https://tire.zedth.my.id/` — Landing Page, Login Page, Register Page.

---

## 0. HOW TO RUN THIS

Two modes. Pick one.

**Mode A — single shot (fastest).** Save this file as `docs/design-brief.md` in the repo, then paste this single line into Claude Code:

```
Read docs/design-brief.md in full and execute it end to end. Do not stop at analysis. Do not ask me for design approval between phases — only ask if continuing would risk breaking authentication or business logic.
```

**Mode B — phased (recommended, higher quality).** Save this file as `docs/design-brief.md`, then run the six short prompts in **Appendix A**, one per turn. Each phase ends with a commit. No approval gates — you can still let it run unattended, but the work is chunked so nothing gets skimmed.

Mode B exists because a single 900-line instruction tends to be executed shallowly: the model front-loads structure and thins out by the time it reaches micro-interactions and QA. Phasing costs you five extra paste operations and buys real depth.

---

## 0.1 DECISION LOG — resolved conflicts

Two source briefs disagreed on the following. These are now settled. Do not relitigate.

| # | Conflict | Decision | Reason |
|---|---|---|---|
| 1 | Font: Inter/Manrope/Plus Jakarta Sans/Geist vs. a distinct display face | **Archivo** (display) + **Plus Jakarta Sans** (body) + **IBM Plex Mono** (data) | Plus Jakarta Sans is from the approved list, is an Indonesian typeface (Tokotype, made for Jakarta's city identity), and fits an Indonesian fleet product. Archivo carries the industrial display weight that Inter cannot. Inter alone reads as the default choice. |
| 2 | "Use an eyebrow label" vs. "no eyebrow labels" | **One eyebrow, hero only, sentence case** | Repeated all-caps eyebrows above every heading is the clearest generated-page tell. One is a design choice; six is template chrome. |
| 3 | Numbered `01 — 06` journey vs. "avoid 01/02/03 markers" | **Allowed, this section only** | The rule is: numbered markers are only valid when the content is genuinely a sequence. Register vehicle → register tire → install → monitor → inspect → replace **is** a sequence. |
| 4 | "Floating label" vs. permanent label above input | **Permanent label above input** | Floating labels break at 200% zoom, confuse password managers, and lose the label the moment the field has content. Accessibility outranks the effect. |
| 5 | "Staggered reveal / scroll reveal" vs. "no fade-up on every section" | **Scroll-linked motion only in the hero and the product journey. Blanket section fade-up is banned.** | Fade-and-slide-up on every section is the single most recognisable AI-page signature. Motion that tracks a real state change (active step) is functional. |
| 6 | Framer Motion allowed vs. bundle discipline | **Allowed only if the repo is React and already depends on it.** Otherwise CSS + Web Animations API, or Motion One (~5KB). | Adding ~35KB gzipped for entrance animations is a bad trade on a tool used over poor connections in workshops. |
| 7 | Blue `#1D4ED8` (existing brand) vs. amber industrial accent | **Both, with distinct jobs.** Amber = human attention and safety signal. Blue = system state, data, links. Graphite = the dominant surface. | Preserves brand continuity with the live app while giving the industrial accent the brief asked for. |
| 8 | Approval gates vs. autonomous execution | **Autonomous, but every phase writes an artifact to disk** (`DESIGN_PLAN.md`, commits per phase) | You get reviewability and revertability without blocking the run. |

---

# PART I — MISSION

## 1. Role

You are a **Senior Product Designer + Senior Frontend Engineer + UX Engineer** working on a real client project. The client has already rejected proposals that felt templated. You are being paid for a specific point of view, not for a safe default.

## 2. Scope

Redesign three surfaces: **Landing Page, Login Page, Register Page.**

Do not rewrite the application. Do not replace the architecture. Do not touch pages outside this scope except to add shared design tokens.

## 3. Non-negotiables

Do **not** break:

- authentication flow, login API, register API
- routing, session management, cookies, tokens
- API contracts, request/response shapes, field names
- validation rules enforced by the backend
- CSRF handling
- SSR/SSG behaviour if it exists
- existing business logic

This is a presentation-layer redesign. Before modifying any auth component, read it completely and state in your own words how it currently works. If a visual change would require a logic change, stop and ask.

Do **not** add or remove form fields. Use exactly the fields the current backend expects.

Do **not** fabricate: customer logos, user counts, percentage improvements, testimonials, company names, certifications, or statistics. If a section needs a number you do not have, write `{{ISI_KLIEN: description}}` and log it in `TODO-CONTENT.md`.

Do **not** claim you tested something you did not test.

---

# PART II — DISCOVERY

## 4. Repository audit

Before writing any production code, inspect and report:

**Technical**
- Framework and version, build tool, package manager, TypeScript config, lint config
- Router; exact file paths for landing, login, register
- Styling approach (Tailwind / CSS Modules / styled-components / plain CSS) and where tokens live
- Existing component library or design system
- Existing animation library, if any
- Font loading setup
- Static asset directory and import convention
- Dark mode presence
- `package.json` scripts, build output size baseline

**Authentication**
- Endpoints, exact field names, payload shape
- Client-side and server-side validation rules
- Error response format and how errors currently surface in the UI
- Token/session/cookie handling, redirect targets after success
- Whether "remember me" and "forgot password" actually exist (do not invent them)

**Current UI**
Run the app locally. If browser tooling is available, inspect the rendered pages and take screenshots at 375px and 1440px. Then list concrete defects with file and line references: hierarchy, contrast, touch target size, focus visibility, form labelling, error handling, responsive breakage, layout shift, asset weight. Do not assert anything you cannot point to in the code.

## 5. Audit deliverable

Write `DESIGN_PLAN.md` containing:

- Token system: colours (name + hex), type scale, spacing scale, radius scale, elevation, z-index scale, motion timings
- The three typefaces and their roles
- ASCII wireframes: landing (desktop + mobile), login, register
- Landing section list, each with a one-line justification for why it exists
- Motion plan: which single moment is orchestrated, what everything else does
- Micro-interaction table: trigger, duration, what changes, reduced-motion fallback
- Image asset list (descriptions, not URLs)
- Draft Indonesian copy for every headline, subhead, label, button, error message, and empty state
- Decisions where the repo forced a deviation from this brief, and why

## 6. Self-critique gate — mandatory

After `DESIGN_PLAN.md` is written, review it against this question:

> Which parts of this plan are what I would produce for *any* brief in this general category, rather than choices made for a tire-data system used by Indonesian fleet operators?

Rewrite those parts. Append a short section listing what you changed and why. Only then start coding.

---

# PART III — DESIGN FOUNDATION

## 7. Product context

| | |
|---|---|
| Name | **TIRE** — Commercial 2026 |
| Function | Sistem Informasi Pengolahan Data Ban Bus & Truk |
| Existing theme colour | `#1D4ED8` |
| Users | Fleet managers, workshop heads, technicians, data admins |
| Buyers | Logistics, transportation, bus and truck operators, mining, enterprise operations |
| Use context | Pool office, workshop floor, sometimes a cheap phone in the yard, unreliable connection |
| UI language | Bahasa Indonesia |

This is a **work tool**, not a lifestyle product. The landing page sells trust and clarity, not hype. Voice: a senior technician explaining something calmly — not a startup copywriter.

The product must communicate: reliability, operational efficiency, tire lifecycle visibility, data accuracy, traceability, enterprise readiness.

## 8. Design concept — "Workshop Precision"

The visual language comes from the users' physical world, not from a SaaS template library.

Reference vocabulary: workshop concrete floor, tire tread grooves, road markings, chalk marks on sidewalls, TWI (tread wear indicator) bars, steel rims, DOT codes and size markings (`295/80 R22.5`), pressure gauges, fleet manifest boards.

**The governing rule:** every decorative element must have a physical counterpart in the user's work. If you cannot name the counterpart, delete the element.

This is what makes the page read as human-designed. A generic page decorates; this one annotates.

Quality bar for craft — typography, spacing, motion, polish: Linear, Stripe, Vercel, Raycast, premium automotive interfaces. Do not copy their layouts. The identity must belong to TIRE.

## 9. Colour system — locked

```css
--graphite    #16181C   /* rubber — primary dark surface, body text */
--graphite-80 #24272E   /* raised dark surface, dark-panel borders */
--concrete    #E7E7E3   /* workshop concrete — page background, cool not cream */
--paper       #FFFFFF   /* card and form surface */
--steel       #6E7580   /* rim — secondary text, borders, dividers */
--amber       #F0B429   /* chalk / high-vis marking — the accent */
--blue        #1D4ED8   /* existing brand — links, system state, data */
--blue-deep   #16307E   /* dark blue-cast panels */
--danger      #C0392B
--ok          #1E8E5A
```

Rules:

- `--amber` covers **at most 5% of any screen**. It is a signal, not a theme. Use it for: primary CTA, focus rings, active state, the one indicator that matters most on screen.
- `--blue` handles links, system/data states, and selected rows — the things the app already uses it for. Continuity with the live product matters.
- `--concrete` is the page background. It is a cool grey. Do **not** drift it toward cream/beige (`#F4F1EA` and neighbours) — that palette plus a serif display is the most recognisable generated-page signature in circulation.
- Never use colour as the only carrier of meaning. Every status needs an icon or a text label too.
- Expose all of these as CSS custom properties on `:root`, and wire them into whatever token system the repo already uses. Do not introduce a second token system.

Dark sections are welcome — the imagery is dark and industrial. But the page is light-dominant with dark punctuation, not a dark theme.

## 10. Typography — locked

| Role | Family | Weights | Notes |
|---|---|---|---|
| Display / headings | **Archivo** | 600, 700 | Industrial grotesk. Use the wider optical range for display sizes. |
| Body / UI | **Plus Jakarta Sans** | 400, 500, 600 | Indonesian typeface, large x-height, safe diacritics, readable on cheap panels. |
| Data | **IBM Plex Mono** | 400, 500 | **Functional only** — tire sizes, DOT codes, plate numbers, serials, timestamps. Never for decorative labels. |

- Maximum three weights per family. Hierarchy comes from size, weight, and space — not from boxes and borders.
- Type scale 1.250 on mobile, 1.333 on desktop. Body 16px minimum on mobile.
- Line length capped at 68 characters. Line height 1.5–1.65 for body.
- `font-variant-numeric: tabular-nums` wherever numbers align in a column.
- Self-host via `@fontsource` or local files. Do not hotlink Google Fonts — connections in the field are unreliable. Subset latin + latin-ext, `font-display: swap`, preload only above-the-fold weights, set fallback metrics to suppress CLS.
- Do not accent a single word inside a headline with a different colour or italic.

## 11. Spacing, radius, elevation, z-index

- Spacing on a 4/8pt scale. One scale, used everywhere.
- **Radius must have hierarchy.** One radius value applied to every element regardless of its role is a template tell. Suggested: inputs and buttons small, cards medium, full-bleed panels large or zero. Decide deliberately, document in `DESIGN_PLAN.md`.
- **Elevation must have hierarchy.** Not the same soft grey shadow under everything. Most surfaces need no shadow at all — a 1px `--steel` border at low opacity does more work and looks more precise.
- z-index scale: 10 (sticky) / 20 (dropdown) / 30 (overlay) / 50 (modal). No arbitrary values.
- Container: one `max-width` for the whole site. Do not mix widths between sections.

## 12. Motion system

**One orchestrated, non-user-triggered moment per page.** Everything else responds to user action.

Timings:

| Class | Duration |
|---|---|
| Micro-interaction (hover, focus, press) | 150–200ms |
| State transition (accordion, toggle, tab) | 250–400ms |
| Page entrance | 400–700ms |
| Hero orchestration | 900–1400ms total |

Easing: `cubic-bezier(.2,.8,.2,1)` as the default ease-out. Spring only where a physical object is being moved.

Animate only `transform` and `opacity`. Use `grid-template-rows` for height transitions, never a `max-height` hack. No layout thrashing.

Banned: infinite loops outside a single status pulse, spinning UI, bouncing, blanket section fade-up, hover `scale` that shifts surrounding layout.

**Reduced motion.** Under `@media (prefers-reduced-motion: reduce)`: all transitions to 0ms, parallax off, the hero orchestration jumps to its final state, counters show their final value immediately. Content must be complete and legible. Implement this as a global block plus per-component checks where JS drives the animation.

## 13. Iconography

One library only. Use whatever the repo already has; otherwise **Lucide**. Fixed 24×24 viewBox, consistent stroke width, consistent rendered size. Icon-only buttons need `aria-label`. **No emoji as icons.** Icons carry meaning; they do not decorate every card.

## 14. Anti-pattern blacklist

Do not produce any of these:

**Layout**
- Predictable 3-column feature grids
- Content chopped into identical rounded cards with the same radius and the same shadow
- Overly symmetrical layouts with identical spacing everywhere
- Decorative floating blobs
- A stock photo dropped inside a rectangular card

**Colour and surface**
- Purple/indigo gradient SaaS aesthetic; mesh gradients as decoration
- Glassmorphism floating over a gradient
- Cream `#F4F1EA` background + serif display + terracotta accent
- Near-black `#0B0B0B` / `#111` standing in for black
- Excessive saturation; every element coloured

**Typography and chrome**
- Tracked-out ALL-CAPS eyebrow above every heading
- `01 / 02 / 03` markers on content that is not a sequence
- One word in the headline recoloured or italicised
- `WORD — fragment` labels with a spaced em dash
- Meta strings joined with middle dots (`A · B · C`)
- `→` appended to button and link text
- Monospace used for small labels that are not data
- Unnecessary typographic labels above content

**Motion**
- Fade-and-slide-up entrance on every section
- Hover transition on every card
- Scattered effects instead of one orchestrated moment

**Content**
- Generic marketing phrases, meaningless metrics
- Invented statistics, testimonials, or logos
- Machine-translated Indonesian

**Instead:** asymmetric layouts, editorial hierarchy, deliberate whitespace, controlled visual tension, meaningful image cropping, typography-led sections, realistic product screenshots, restrained decoration, intentional hierarchy.

**Spend your boldness in one place.** Let the hero be the memorable thing. Keep everything after it quiet and disciplined. Before you finish a page, remove one element.

---

# PART IV — LANDING PAGE

## 15. What the page must answer

1. What is TIRE?
2. Who is it for?
3. What problem does it solve?
4. Why should the user trust it?
5. What can the user do with it?
6. How does the user start?

If a section does not serve one of these six, cut it.

## 16. Section map

1. Navigation
2. Hero
3. Product value (editorial)
4. Product journey `01—06`
5. Dashboard / product preview
6. Industrial image section
7. Trust / capability
8. Final CTA
9. Footer

## 17. Navigation

Sticky, 64px. Logo left; `Produk · Fitur · Cara Kerja · Tentang` — no, set those as plain nav links without separator dots. Right: `Masuk` (ghost) and `Mulai Menggunakan` (primary).

Over the hero it may be transparent. On scroll past 40px it gains `--paper` background, a 1px `--steel` border at low opacity, and slightly compacted spacing — transition 250ms. Backdrop blur is permitted here and nowhere else.

Active link marker: a short dashed underline echoing a tire track. Not a pill background.

Mobile: full-screen sheet, 44px minimum targets, focus trapped while open, `Esc` closes, body scroll locked.

## 18. Hero

This is the one place to be bold.

**Left column**
- One eyebrow, sentence case, `--steel`: `Manajemen ban armada`
- Display headline, Archivo, two lines maximum, left aligned. Indonesian primary. Direction to develop, not to copy verbatim:
  - `Setiap ban punya riwayat. Pastikan Anda bisa melacaknya.`
  - `Kenali setiap ban. Kendalikan setiap kilometer.`
- Supporting paragraph, max 2 lines, plain language, no jargon
- Primary CTA `Mulai Menggunakan`, secondary CTA `Pelajari Selengkapnya`. No arrows in button text.

**Right column — composed visual, not a photo in a box**
- Macro photograph of a heavy truck tire tread, full-bleed, intentionally cropped so grooves run diagonally out of frame
- Desaturated toward graphite; no coloured gradient wash
- Layered on top: three technical callouts anchored to real points in the image (tread depth, pressure, service life), drawn as thin leader lines with `IBM Plex Mono` labels — the visual language of an engineering drawing, not of tooltips
- Optionally one small UI fragment (a status chip, a single data row) overlapping the image edge to tie photo and product together

**Orchestrated load sequence** — the page's single non-reactive animation:
1. A thin measurement rule sweeps left→right across the image, 600ms
2. The three callouts resolve in sequence, 120ms apart
3. Headline and CTAs settle in

Total ≈ 1.2s. Runs **once** — persist a flag in `sessionStorage` so back-navigation does not replay it. Under reduced motion, render the final state immediately.

**Mobile hero is designed, not shrunk.** Image above or behind the text with a scrim, callouts reduced to one or removed, headline resized on its own scale, CTAs full-width and stacked.

## 19. Product value — editorial, not five cards

Themes: tire lifecycle, fleet visibility, maintenance intelligence, historical data, operational efficiency.

Compose these as an editorial block, not a card grid. Mix typography, numbers, one diagram, one UI fragment, and subtle rules. Vary the weight of each item — these five are not equally important, and the layout should say so. Asymmetric column split (for example 7/5), not thirds.

Any figure you do not actually have becomes `{{ISI_KLIEN: ...}}`.

## 20. Product journey — `01 — 06`

The one section where numbered markers are correct, because this is a genuine sequence:

```
01 — Daftarkan kendaraan
02 — Daftarkan ban
03 — Pasang ban
04 — Pantau pemakaian
05 — Periksa & rawat
06 — Ganti & analisis
```

Scroll-linked: the active step changes as the user scrolls, a progress line advances, and the accompanying visual changes with it. This motion is functional — it reflects position in the sequence — which is why it is allowed here and banned elsewhere.

Steps connected by a dashed rule. Thin-stroke Lucide icons. Under reduced motion, render all six steps statically with no scroll binding.

Mobile: vertical timeline, no scroll hijacking, no sticky viewport takeover.

## 21. Dashboard / product preview

Show a realistic slice of the actual application: total tires, active tires, tires due for inspection, lifecycle position, vehicle info, tire position, maintenance status.

Use neutral demonstration values. This must look like the real product, not a marketing mockup — if the app has real screens, model the preview on them.

Make one element genuinely interactive: clicking a tire position swaps the detail panel, 220ms, clearly showing what changed. This is what makes the page immersive rather than decorative.

Subtle motion only: counters count up once on first entry into the viewport (`IntersectionObserver`, `once: true`, odometer feel), one chart draws once, status chips transition on interaction. Charts stay quiet — no heavy grid, no rainbow palette, no 3D.

## 22. Industrial image section

One large, immersive, full-bleed image moment. Documentary mood, dark and neutral, authentic and operational — a real workshop or yard, not a lit studio shot.

Treat it as a section, not a banner: overlay a short line of copy or a single data annotation that continues the narrative. Parallax is permitted here at low amplitude and must be disabled under reduced motion.

## 23. Trust / capability

If the project has real customers, statistics, or testimonials, keep and improve them. If not, **build the trust section from product capability instead**: role-based access, data traceability, audit history, export, offline-tolerant entry — whatever the code actually supports. Verify each claim against the codebase before writing it.

Present it as a comparison table or an alternating list, not as badges.

## 24. Final CTA

Closes the narrative. Full-width `--graphite` panel, `--paper` text, one `--amber` button. This is the only place `--amber` appears as a large surface.

Concept: `Setiap ban punya riwayat. Pastikan Anda bisa melacaknya.`
Support: `Kelola data ban kendaraan secara lebih terstruktur, akurat, dan mudah dipantau.`
CTA: `Mulai Sekarang`

## 25. Footer

Navigation columns, contact, legal line. Quiet. No newsletter form unless one already exists.

## 26. Landing micro-interactions

All reactive to user input.

| Element | Trigger | Behaviour |
|---|---|---|
| Button | hover / active | Colour transition 180ms; 1px downward shift on press. No scale. |
| Button | focus-visible | 2px `--amber` ring, 2px offset, visible over both light and dark panels |
| Nav link | hover | Dashed tire-track underline draws in, 150ms |
| Scroll progress | scroll | 2px `--amber` bar under the header, styled as a wear-indicator strip |
| Hero callout | hover | Leader line sharpens, label opacity rises |
| Value/preview surfaces | hover | Border shifts `--steel`/20 → `--blue`, low shadow appears. No transform. |
| Counter | first viewport entry | Count-up once, tabular numerals, odometer feel |
| Journey step | scroll | Active step gains weight; progress line advances |
| Preview panel | click | Detail swaps in 220ms, showing what changed |
| Accordion | click | `grid-template-rows` transition 250ms; chevron rotates 180° |
| Every clickable surface | — | `cursor: pointer` |

---

# PART V — AUTHENTICATION

## 27. Shared AuthLayout

Build one `AuthLayout` used by both pages. Same typography, spacing, buttons, accent, image treatment, motion, and icon style as the landing page. No duplicated styles.

**Layout:** asymmetric split, roughly 5/7. Not a centred white card. Not a plain 50/50 split screen.

- **Visual panel (5 cols):** full-bleed industrial photograph — tires racked in a workshop, or a depot at dawn. `--graphite` scrim at an opacity that keeps overlaid text at ≥4.5:1. Over it: the TIRE mark, one sentence naming who the system is for, and one small human detail — a mono line with today's date, or a short factual note. No invented testimonials, no fake stats.
- **Form panel (7 cols):** `--concrete` background, form on a `--paper` surface, max width 420px. Do not let the form stretch.
- Position the form slightly **above** true vertical centre (roughly −4% optical offset). Perfect centring reads as a default; optical centring reads as typeset.

**Mobile (<640px):** the photo becomes a short strip above the form, or is dropped entirely for speed. The form must be interactive before the image finishes loading — the visual panel must never block render.

Entrance: form fields stagger in, maximum 3 items, 40ms apart, 300ms total. That is the whole entrance. Nothing else moves.

## 28. Login

Use exactly the fields the backend expects — likely email/username and password. Include "remember me" and "forgot password" **only if the functionality already exists.** Do not invent auth features.

Content: TIRE mark, a welcome heading, one line of support text, the fields, the login CTA, and a link to register.

## 29. Register

Visually consistent with login. Single column, fields grouped by whitespace, not by separate boxes.

Fields as the backend defines them — typically name, email/username, password, password confirmation, and terms if already implemented. Do not add fields.

## 30. Auth micro-interactions

**Inputs**
- Permanent label above the field. Not a floating label, not a placeholder acting as a label.
- On focus: border transitions to `--blue`, and a thin `--amber` rule wipes left→right in 110ms — a chalk mark. This is the only ornament in the form.
- Validate on blur, not on the first keystroke. Never validate everything on page load.
- Errors appear directly under the field, inside `aria-live="polite"`, with an icon **and** text. Colour alone is not enough.
- `autocomplete` correct throughout: `username`, `current-password`, `new-password`, `name`, `email`, `tel`. Password managers must work.

**Password**
- Show/hide toggle with a morphing icon, `aria-label` and `aria-pressed`.
- Caps Lock detection → a small inline notice under the password field. Not an alert.

**Register password strength — tread depth gauge**
Five vertical grooves that fill progressively as strength increases, with a text label beside them (`Lemah` / `Cukup` / `Kuat`). 200ms transitions. Colour is never the only indicator. This is the domain metaphor doing real work — a wear gauge, which is exactly what these users read every day.

Password requirements render as a live checklist that ticks as it is satisfied, not as errors after a failed submit.

Password confirmation shows match state on blur, not per keystroke.

**Plate / unit number field**, if one exists: auto-format to the Indonesian pattern (`B 1234 XYZ`) while typing, with correct caret handling. Render in `IBM Plex Mono`.

**Submit**
- Loading state on the button (spinner + label change to `Memeriksa…`), button disabled, double submit prevented.
- Server errors surface in an alert above the form; move focus to it.
- Register success: a calm in-page success state for ~800ms naming what happens next, then redirect. Not an instant jump.
- **No aggressive shake on error.** Colour, icon, message, and focus movement carry it.

## 31. Error and copy voice

Errors explain what happened and what to do next, in the interface's voice. They do not apologise and they are never vague.

- Instead of `Login gagal.` → `Email atau kata sandi tidak cocok. Coba lagi atau atur ulang kata sandi.`
- Instead of `Terjadi kesalahan.` → `Server tidak merespons. Periksa koneksi Anda, lalu coba lagi.`

An action keeps the same name through the whole flow. The button that says `Mulai Menggunakan` must not lead to a page headed `Registrasi Akun Baru`.

---

# PART VI — CONTENT

## 32. Language

Inspect the app's existing language first. It is Indonesian — keep Indonesian as the primary UI language.

Professional, concise, sentence case, active voice. No filler. No machine-translated phrasing. Name things the way users say them, not the way the system is built.

## 33. Copy calibration

| Avoid | Prefer |
|---|---|
| Kelola semua kebutuhan ban Anda dengan mudah dan efisien. | Pantau siklus hidup setiap ban, dari pemasangan hingga penggantian. |
| Solusi terbaik untuk manajemen ban. | Seluruh riwayat ban dalam satu sistem. |
| Tingkatkan efisiensi operasional Anda sekarang juga! | Kurangi pencatatan manual. Lihat kondisi armada dalam satu layar. |
| Submit | Simpan perubahan |

Every written element does exactly one job. An empty state is an invitation to act, not a shrug.

---

# PART VII — IMAGE ASSETS

## 34. Sources

Only these three: **Unsplash**, **Pexels**, **Pixabay**. All three permit commercial use without mandatory attribution — credit them anyway (§37).

**Licence constraints you must actually respect:**

- No visible brand logos, tire-brand lettering, or readable company markings. The photo licence does not grant trademark rights.
- No clearly identifiable faces in the hero or auth panels. These licences do not include a model release, and putting a recognisable person on a marketing page can read as endorsement.
- Do not resell or redistribute the images in their original form.
- Do not hotlink. Download, optimise, and commit the assets so production owns them.

## 35. Search strategy

Search for the concept, not for "business website".

**Use:** `heavy truck tire close up` · `truck tire tread macro` · `tyre grooves detail` · `stacked truck tires warehouse` · `tire storage rack` · `bus depot morning` · `truck fleet parked` · `logistics transportation yard` · `mechanic inspecting truck tire` · `worn tire tread` · `tire depth gauge` · `industrial vehicle maintenance`

**Avoid:** smiling corporate employees · generic office teams · handshakes · laptop-with-dashboard · staged business meetings · obviously AI-generated imagery · generic startup hero photos

Prefer real texture over polish, documentary framing over studio lighting, and Southeast Asian context where available. Do not pick an image because it is pretty — it must carry the narrative.

## 36. Processing

1. Download originals to `public/img/source/` (gitignored).
2. Generate derivatives at 640 / 1280 / 1920 widths in AVIF + WebP + JPEG fallback, via `sharp` or `squoosh-cli`.
3. Budgets: hero ≤ 180KB (AVIF @1920), auth panel ≤ 120KB, supporting ≤ 90KB.
4. **Apply one consistent grade to every photo** so they read as a single commissioned set rather than assorted stock: desaturate ~25%, push shadows slightly cool, protect highlights from clipping. This is one of the strongest signals of human art direction.
5. Implement with `<picture>` + `srcset` + `sizes`, explicit `width`/`height`, descriptive Indonesian `alt`, base64 LQIP blur placeholder, `fetchpriority="high"` on the hero only, `loading="lazy"` on everything else.

## 37. `docs/image-sources.md`

For every asset record: filename, platform, source URL, photographer/contributor, licence, intended usage, download date.

---

# PART VIII — QUALITY

## 38. Accessibility

- Semantic HTML. Landmarks. One `h1` per page, heading levels in order.
- Every input has a real `<label for>`. Errors linked via `aria-describedby` + `aria-invalid`.
- Visible `:focus-visible` on every interactive element, including over dark panels and photos.
- Contrast ≥ 4.5:1 for normal text, ≥ 3:1 for large text and UI components — including text over scrimmed images.
- Tab order matches visual order. Every flow completable without a mouse.
- Touch targets ≥ 44×44px.
- `prefers-reduced-motion` fully honoured.
- Works at 200% browser zoom without layout breakage.
- Verify with axe-core or Lighthouse a11y. Target zero serious violations.

## 39. Responsive

Design for 375 / 480 / 768 / 1024 / 1280 / 1440+. **Do not shrink the desktop layout** — mobile hero, navigation, and auth layouts are designed separately.

No horizontal scroll at any width. Check: overflow, typography scaling, image crop behaviour, navigation, spacing rhythm, button sizing, form layout.

Screenshot each page at 375 and 1440 and review the screenshots yourself before declaring done.

## 40. Performance

Targets on the landing page (Lighthouse mobile, default throttling): **LCP < 2.5s, CLS < 0.05, TBT low.**

- No render-blocking fonts. No animation JS executing before main content paints.
- GPU-friendly animation only. No layout thrashing.
- Preserve existing SSR/SSG behaviour.
- Report bundle size delta. If you added a dependency, justify it in one line.
- Prefer CSS for simple transitions. Reach for a library only where it earns its weight.

## 41. Code quality

Follow the repo's existing conventions. Reusable components, no duplication, no giant files, no repeated hardcoded values, tokens everywhere, TypeScript correctness maintained. Refactor only where it helps this work.

Audit before finishing: is any colour, spacing, radius, or font size hardcoded instead of tokenised? Fix all of it.

## 42. Visual QA and self-critique

Run lint, typecheck, build, and tests. Fix every error. Then inspect the rendered pages again.

**Landing** — Does the hero communicate TIRE within three seconds? Does it read as an industrial product rather than a generic SaaS page? Is the primary CTA unmistakable? Does the hierarchy work if you squint and read nothing? Are images integrated or merely placed?

**Login** — Does it feel like the same product as the landing page? Is the form fast to complete? Are errors actionable?

**Register** — Is the form cognitively light? Are validation states clear? Is the password feedback genuinely useful?

**Then the honest pass:**
- Which parts still look like a template that could belong to any product?
- Which decorative elements serve no understanding? Delete them.
- Is the boldness concentrated in one place, or scattered until the page feels busy?
- Is anything on screen competing with the hero for attention?

Remove one element before you finish. Say what you removed and why.

---

# PART IX — DELIVERABLES

## 43. Files to produce

- `DESIGN_PLAN.md` — design system and rationale
- `docs/image-sources.md` — asset provenance and licences
- `TODO-CONTENT.md` — every `{{ISI_KLIEN: ...}}` placeholder awaiting real content
- `docs/redesign-report.md` — final report

Remove any temporary styleguide route before finishing.

## 44. Final report

`docs/redesign-report.md` covers:

1. Summary of UI/UX changes
2. Files and components changed
3. Dependencies added, with justification
4. Image sources
5. Animation approach
6. Responsive decisions
7. Accessibility improvements, with tool output
8. Performance: before/after LCP, CLS, bundle size
9. Build and test results
10. Remaining limitations and open content items

State plainly what you did not test.

## 45. Execution rules

Do not ask for design approval between phases. Make reasonable design decisions yourself. When something is ambiguous: inspect the code, inspect existing behaviour, infer the safest option, preserve existing functionality.

Ask a question **only** when continuing would risk breaking authentication or business logic.

Do not stop at analysis. Modify the code and deliver the implementation.

The result must feel like a premium, human-designed industrial fleet-management product — not an AI-generated template.

---

# APPENDIX A — Phased run (Mode B)

Save this file as `docs/design-brief.md`, then paste these one at a time.

**Phase 1 — Audit**
```
Read docs/design-brief.md in full. Execute PART II only: audit the repository, run the app locally, inspect the rendered landing/login/register pages, and write DESIGN_PLAN.md including the mandatory self-critique in §6. Make no production code changes in this phase. Report the audit findings in chat with file references.
```

**Phase 2 — Foundation**
```
Read docs/design-brief.md. Execute PART III: implement the locked tokens (§9–11) into the repo's existing styling system, set up the three self-hosted typefaces (§10), build or repair the shared primitives (Button, TextField, Checkbox, Radio, Alert, Container) with all states including focus-visible and loading, add the global reduced-motion block, and add a temporary /__styleguide route. Run build. Report bundle delta. Commit: feat(ui): design system foundation
```

**Phase 3 — Landing**
```
Read docs/design-brief.md. Execute PART IV: build the landing page, sections 17–26. Use grey placeholders at correct aspect ratios for images and log them in ASSETS.md — real assets come in Phase 5. Screenshot at 375 and 1440, critique your own output, name three weaknesses, fix them. Commit: feat(landing): redesign landing page
```

**Phase 4 — Authentication**
```
Read docs/design-brief.md. Execute PART V: build AuthLayout, Login, and Register. Respect §3 absolutely — no changes to endpoints, field names, validation rules, or auth logic. Prove login and register still work before finishing. Full keyboard navigation test. Screenshot at 375 and 1440. Commit: feat(auth): redesign login and register
```

**Phase 5 — Assets**
```
Read docs/design-brief.md. Execute PART VII: source, licence-check, download, grade, optimise, and integrate the real images. Write docs/image-sources.md. Run Lighthouse on the landing page and report LCP and CLS before and after. Commit: feat(assets): licensed imagery, responsive formats
```

**Phase 6 — QA**
```
Read docs/design-brief.md. Execute PART VIII and IX: full responsive sweep, axe-core/Lighthouse accessibility pass, performance measurement, token-hardcoding audit, lint/typecheck/build/tests, and the self-critique in §42 — including removing one element. Remove the /__styleguide route. Write docs/redesign-report.md. Commit: chore(ui): QA, a11y, cleanup
```

---

# APPENDIX B — Course corrections

Paste mid-run if the output drifts.

**Drifting generic:**
```
Stop. Compare your output against the anti-pattern blacklist in §14 of docs/design-brief.md. Name every item you violated, then fix them. Remember the governing rule: every decorative element must have a physical counterpart in the user's work — workshop, tire, fleet. If you cannot name the counterpart, delete the element.
```

**Too busy:**
```
Too many things are competing for attention. Pick the one element on this page that is allowed to be bold, then quieten everything else: reduce contrast, reduce size, or delete. Tell me what you chose and why.
```

**Motion overdone:**
```
Review §12. Motion that is not triggered by the user is limited to one orchestrated moment per page. List every animation currently running without user input, and remove all but that one.
```

**Invented content:**
```
Audit the page for any number, claim, testimonial, logo, or certification that you cannot trace to the codebase or to something I gave you. Replace each with {{ISI_KLIEN: ...}} and log it in TODO-CONTENT.md.
```

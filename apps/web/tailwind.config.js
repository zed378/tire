/** @type {import('tailwindcss').Config} */

/**
 * `token(name)` binds a Tailwind colour to a CSS custom property declared in
 * src/index.css, keeping `<alpha-value>` working so `bg-surface/60` and
 * `border-line/50` still mean something.
 */
function token(name) {
  return `rgb(var(--color-${name}) / <alpha-value>)`;
}

export default {
  /*
   * The class is always written explicitly by ThemeProvider — it resolves the
   * stored choice, or the operating system preference when there is no stored
   * choice, and then sets `.light` or `.dark`. So exactly one of the two is
   * always present once the application has mounted, and `dark:` variants
   * behave predictably.
   *
   * index.css additionally carries a `prefers-color-scheme` fallback for the
   * moment before that runs. It exists to stop a dark-mode user being flashed a
   * white screen on every load, which is the only way to fix that flash under a
   * CSP with no 'unsafe-inline' — the usual trick is an inline <script> in the
   * document head, and we cannot have one.
   */
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      screens: {
        // Small phones. Used by the login page, and previously never declared,
        // so every `xs:` class silently did nothing.
        xs: "400px",
      },
      colors: {
        /*
         * Semantic tokens. Prefer these over raw palette colours: they carry
         * their dark-theme value with them, so a component writes `bg-surface`
         * once instead of `bg-white dark:bg-slate-900`.
         */
        canvas: token("canvas"),
        surface: {
          DEFAULT: token("surface"),
          sunken: token("surface-sunken"),
        },
        line: {
          DEFAULT: token("line"),
          strong: token("line-strong"),
        },
        body: token("body"),
        muted: token("muted"),
        subtle: token("subtle"),
        accent: {
          DEFAULT: token("accent"),
          hover: token("accent-hover"),
          text: token("accent-text"),
          soft: token("accent-soft"),
        },
        "on-accent": token("on-accent"),

        /*
         * The locked palette, named for the material. The semantic names
         * above (surface, body, muted, accent…) point at these, so a
         * component can reach for either the role or the material — but
         * there is only one set of values underneath.
         */
        graphite: { DEFAULT: token("graphite"), 80: token("graphite-80") },
        concrete: token("concrete"),
        paper: token("paper"),
        steel: { DEFAULT: token("steel"), ink: token("steel-ink") },
        amber: token("amber"),
        blue: { DEFAULT: token("blue"), deep: token("blue-deep") },
        signal: { danger: token("danger"), ok: token("ok") },

        danger: {
          DEFAULT: token("danger"),
          soft: token("danger-soft"),
          line: token("danger-line"),
          text: token("danger-text"),
        },
        warning: {
          DEFAULT: token("warning"),
          soft: token("warning-soft"),
          line: token("warning-line"),
          text: token("warning-text"),
        },
        success: {
          DEFAULT: token("success"),
          soft: token("success-soft"),
          line: token("success-line"),
          text: token("success-text"),
        },
        info: {
          DEFAULT: token("info"),
          soft: token("info-soft"),
          line: token("info-line"),
          text: token("info-text"),
        },

        /*
         * The raw brand ramp. Kept because the public landing and login pages
         * paint with it directly, and completed to a full scale — 200, 300,
         * 400, 800 and 950 were missing, and `dark:bg-brand-950/80` was already
         * being used in the sidebar against a stop that did not exist, so it
         * silently did nothing at all.
         *
         * Inside the authenticated area, use the `accent` tokens instead.
         */
        brand: {
          50: "#eff6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          300: "#93c5fd",
          400: "#60a5fa",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
          800: "#1e40af",
          900: "#1e3a8a",
          950: "#172554",
        },
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(14px)" },
          to: { opacity: "1", transform: "none" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.98)" },
          to: { opacity: "1", transform: "none" },
        },
        drift: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
      },
      animation: {
        "fade-up": "fade-up 520ms cubic-bezier(0.16, 1, 0.3, 1) both",
        "fade-in": "fade-in 420ms ease-out both",
        "scale-in": "scale-in 420ms cubic-bezier(0.16, 1, 0.3, 1) both",
        drift: "drift 6s ease-in-out infinite",
      },
      fontFamily: {
        // Body and interface. The fallback is metric-matched in fonts.css so
        // the swap does not shift the layout.
        sans: [
          "Plus Jakarta Sans Variable",
          "Plus Jakarta Sans Fallback",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        // Headings only. Never body text: it is a display grotesk.
        display: ["Archivo Variable", "Archivo Fallback", "system-ui", "sans-serif"],
        // Alphanumeric data: tire sizes, DOT codes, plates, serial numbers.
        data: ["IBM Plex Mono", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      fontSize: {
        // 1.250 at mobile, 1.333 at desktop (DESIGN_PLAN §1.2). Body never
        // below 16px — these screens are read on cheap displays in bad light.
        xs: ["0.75rem", { lineHeight: "1.4" }],
        sm: ["0.875rem", { lineHeight: "1.5" }],
        base: ["1rem", { lineHeight: "1.6" }],
        lg: ["1.25rem", { lineHeight: "1.4" }],
        xl: ["1.5625rem", { lineHeight: "1.25" }],
        "2xl": ["1.9375rem", { lineHeight: "1.15" }],
        "3xl": ["2.4375rem", { lineHeight: "1.05" }],
      },
      borderRadius: {
        // Hierarchy, not one value everywhere. The scale follows how close
        // the element sits to the hand (DESIGN_PLAN §1.4).
        sharp: "0",
        tight: "2px",
        base: "6px",
        panel: "12px",
      },
      boxShadow: {
        // Three steps. On a concrete ground a hairline reads more honestly
        // than a shadow, so the default card has none.
        raised: "0 1px 2px rgb(22 24 28 / 0.06), 0 2px 8px rgb(22 24 28 / 0.06)",
        overlay: "0 8px 24px rgb(22 24 28 / 0.16)",
      },
      zIndex: {
        float: "10",
        header: "20",
        drawer: "30",
        dialog: "50",
        toast: "60",
      },
      maxWidth: {
        // One container width for the whole site, and one measure for prose.
        site: "72rem",
        prose: "34rem",
      },
      transitionTimingFunction: {
        // A single easing everywhere, per the brief.
        precision: "cubic-bezier(.2,.8,.2,1)",
      },
      transitionDuration: {
        /*
         * The brief's three classes: micro-interaction, state transition, page
         * entrance. Tailwind ships neither 180 nor 220, so `duration-180` was
         * compiling to nothing at all and every button was hovering at the
         * browser default — the same silent no-op as `dark:bg-brand-950` in the
         * sidebar, which pointed at a stop that did not exist.
         */
        180: "180ms",
        220: "220ms",
        250: "250ms",
        400: "400ms",
      },
    },
  },
  plugins: [],
};

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
      fontFamily: {
        sans: ["system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
    },
  },
  plugins: [],
};

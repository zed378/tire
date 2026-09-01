// @ts-check
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import boundaries from "eslint-plugin-boundaries";
import globals from "globals";

/**
 * The module boundaries in PLAN/01 §2.3 and §4.5 are enforced by the linter,
 * not by discipline. Discipline runs out in week three.
 */
export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/build/**",
      "**/coverage/**",
      "**/node_modules/**",
      "**/.stryker-tmp/**",
      "apps/api/prisma/generated/**",
      "apps/web/public/**",
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,

  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
      globals: { ...globals.node },
    },
    plugins: { boundaries },
    settings: {
      "boundaries/include": ["apps/**/*.ts", "apps/**/*.tsx", "packages/**/*.ts"],
      "boundaries/elements": [
        { type: "contracts", pattern: "packages/contracts/src/**" },
        { type: "kernel-axle", pattern: "apps/api/src/kernel/axle/**" },
        { type: "kernel", pattern: "apps/api/src/kernel/**" },
        { type: "module", pattern: "apps/api/src/modules/*/**", capture: ["moduleName"] },
        { type: "worker", pattern: "apps/api/src/worker/**" },
        { type: "app", pattern: "apps/api/src/*.ts" },
        { type: "web", pattern: "apps/web/src/**" },
      ],
    },
    rules: {
      // ── Boundaries (PLAN/01 §4.5) ────────────────────────────────────────
      "boundaries/element-types": [
        "error",
        {
          default: "disallow",
          rules: [
            // The axle engine is pure logic: it imports nothing at all.
            { from: ["kernel-axle"], allow: [] },
            // kernel/ must never import modules/ — it is the domain core.
            { from: ["kernel"], allow: ["kernel", "kernel-axle", "contracts"] },
            // A module reaches other modules only through their public surface.
            { from: ["module"], allow: ["kernel", "kernel-axle", "contracts", "module"] },
            { from: ["worker"], allow: ["kernel", "kernel-axle", "contracts", "module"] },
            { from: ["app"], allow: ["kernel", "kernel-axle", "contracts", "module", "worker"] },
            // The contracts package must not import anything from apps/.
            { from: ["contracts"], allow: ["contracts"] },
            { from: ["web"], allow: ["web", "contracts"] },
          ],
        },
      ],
      // Rule 1 of PLAN/01 §2.3: cross-module imports go through index.ts only.
      "boundaries/entry-point": [
        "error",
        {
          default: "disallow",
          rules: [
            { target: ["module"], allow: "index.ts" },
            { target: ["contracts"], allow: "**" },
            { target: ["kernel", "kernel-axle", "web", "app", "worker"], allow: "**" },
          ],
        },
      ],

      // ── Style rules that PLAN/09 §4.3 states as absolute ────────────────
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/ban-ts-comment": ["error", { "ts-ignore": true, "ts-expect-error": "allow-with-description" }],
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/require-await": "error",
      "@typescript-eslint/consistent-type-imports": ["error", { fixStyle: "inline-type-imports" }],

      // PLAN/09 §7: swallowing an error is the most common silent-failure shape.
      "no-empty": ["error", { allowEmptyCatch: false }],

      // D-08. The scripts under scripts/ are the gate that greps for these.
      "no-alert": "error",
      "no-restricted-globals": [
        "error",
        { name: "alert", message: "Forbidden (D-08). Use Banner or Toast." },
        { name: "confirm", message: "Forbidden (D-08). Use the Dialog component." },
        { name: "prompt", message: "Forbidden (D-08). Use a form inside a Dialog." },
      ],
    },
  },

  // The axle engine has no imports at all: PLAN/01 §2.3 rule 3.
  {
    files: ["apps/api/src/kernel/axle/**/*.ts"],
    ignores: ["apps/api/src/kernel/axle/**/*.test.ts"],
    rules: {
      "no-restricted-imports": ["error", { patterns: ["*"] }],
    },
  },

  // Status changes go through one function only (PLAN/03 §7.2 rule 1).
  {
    files: ["apps/api/src/**/*.ts"],
    ignores: ["apps/api/src/modules/inspections/status-machine.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "CallExpression[callee.property.name='update'] > ObjectExpression > Property[key.name='data'] > ObjectExpression > Property[key.name='status']",
          message:
            "Inspection status changes only through transitionInspection() (PLAN/03 §7.2). Any other write bypasses the transition table, the qc_reviews history, and the audit entry.",
        },
      ],
    },
  },

  {
    files: ["apps/web/src/**/*.{ts,tsx}"],
    languageOptions: { globals: { ...globals.browser } },
  },

  {
    files: ["**/*.test.ts", "**/*.test.tsx", "scripts/**/*.ts"],
    rules: {
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "boundaries/element-types": "off",
      "boundaries/entry-point": "off",
      "no-restricted-imports": "off",
    },
  },
);

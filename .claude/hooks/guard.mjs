#!/usr/bin/env node
/**
 * PreToolUse hook — the enforcement layer that does not depend on agent judgement.
 * PLAN/09 §4.5: four prohibitions whose cost is too high to leave in the
 * natural-language layer.
 *
 * Exit code 2 blocks the tool call; stderr is returned to the agent.
 */
import { readFileSync } from "node:fs";

/** @param {string} message */
function block(message) {
  process.stderr.write(message + "\n");
  process.exit(2);
}

let event;
try {
  event = JSON.parse(readFileSync(0, "utf8"));
} catch {
  process.exit(0); // unreadable input must never stand in the way
}

const toolName = event.tool_name ?? "";
const toolInput = event.tool_input ?? {};

// ── Prohibitions 1 and 4: file writes ───────────────────────────────────────
if (toolName === "Write" || toolName === "Edit" || toolName === "NotebookEdit") {
  const path = String(toolInput.file_path ?? toolInput.notebook_path ?? "").replace(/\/g, "/");
  const content = String(toolInput.content ?? toolInput.new_string ?? toolInput.new_source ?? "");
  const basename = path.split("/").pop() ?? "";

  // Credentials are never written by the agent (PLAN/13 §8).
  if (/^\.env(\.|$)/.test(basename) && basename !== ".env.example") {
    block(
      `BLOCKED: write to '${basename}'. Credentials are not written by the agent ` +
        `(PLAN/13 §8). Update '.env.example' and ask a human to fill in the values.`,
    );
  }

  // D-08: alert/confirm/prompt must not re-enter the new system.
  const isClientSource =
    /\.(ts|tsx|js|jsx|mjs|cjs|html)$/.test(path) &&
    !path.includes("/scripts/") &&
    !path.endsWith("guard.mjs");
  if (isClientSource) {
    for (const name of ["alert", "confirm", "prompt"]) {
      if (new RegExp(`(^|[^.\w$])${name}\s*\(`, "m").test(content)) {
        block(
          `BLOCKED: '${name}(' detected in ${path}. The legacy system used it; that is ` +
            `defect D-08, the very thing this rewrite fixes. Use the Dialog / Banner / ` +
            `Toast components instead (PLAN/05 §5.1).`,
        );
      }
    }
  }
}

// ── Prohibitions 2 and 3: shell commands ────────────────────────────────────
if (toolName === "Bash" || toolName === "PowerShell") {
  const command = String(toolInput.command ?? "");

  if (/prisma\s+migrate\s+dev/.test(command)) {
    block(
      `BLOCKED: 'prisma migrate dev' drops and recreates the database. Fatal if it ` +
        `reaches the wrong connection. Use 'pnpm db:migrate' (prisma migrate deploy) ` +
        `and hand-write the migration SQL (PLAN/09 §4.5).`,
    );
  }
  if (/prisma\s+db\s+push/.test(command)) {
    block(
      `BLOCKED: 'prisma db push' skips migration history. Write a SQL migration under ` +
        `apps/api/prisma/migrations/ and run 'pnpm db:migrate'.`,
    );
  }
  if (/git\s+push[^|;&]*(--force|-f\b)/.test(command) && /\b(main|master)\b/.test(command)) {
    block(`BLOCKED: force push to main. There is no second reviewer who could undo it (PLAN/09 §4.5).`);
  }
  if (/(>|>>|tee)\s+\.env(\s|$)/.test(command)) {
    block(`BLOCKED: write to .env. Credentials are not written by the agent.`);
  }
}

process.exit(0);

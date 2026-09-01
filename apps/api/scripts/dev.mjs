import { spawn } from "node:child_process";

/**
 * Runs the API and the worker together in development.
 *
 * PLAN/01 §5 keeps them as separate processes, and this does not change that —
 * they are still two processes, each restarting on its own. What it changes is
 * that starting the application no longer requires knowing to open a second
 * terminal.
 *
 * That knowledge gap had a real cost: with no worker running, every export sat
 * at "Menyiapkan berkas…" forever while the client polled every two seconds and
 * the server answered 200 each time. Nothing was broken and nothing said so.
 *
 * Written with `node --watch` rather than a process-runner dependency: two
 * spawns and a signal handler are less to explain than another package.
 */

const targets = [
  { name: "api   ", entry: "src/server.ts" },
  { name: "worker", entry: "src/worker.ts" },
];

const children = targets.map(({ name, entry }) => {
  const child = spawn(process.execPath, ["--import", "tsx", "--watch", entry], {
    stdio: ["ignore", "pipe", "pipe"],
    env: process.env,
  });

  const prefix = (stream, chunk) => {
    for (const line of chunk.toString().split("\n")) {
      if (line.trim() !== "") stream.write(`[${name}] ${line}\n`);
    }
  };

  child.stdout.on("data", (chunk) => prefix(process.stdout, chunk));
  child.stderr.on("data", (chunk) => prefix(process.stderr, chunk));

  child.on("exit", (code) => {
    // If either half dies, take the other with it. A half-running system that
    // looks fine is exactly the failure this script exists to prevent.
    process.stderr.write(`[${name}] exited with code ${String(code)}\n`);
    stopAll();
    process.exit(code ?? 1);
  });

  return child;
});

function stopAll() {
  for (const child of children) {
    if (!child.killed) child.kill("SIGTERM");
  }
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    stopAll();
    process.exit(0);
  });
}

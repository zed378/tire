import { queueSmoke } from "../src/scripts/queue-smoke.ts";

queueSmoke().catch((error: unknown) => {
  process.stderr.write(`queue smoke test failed: ${String(error)}\n`);
  process.exit(1);
});

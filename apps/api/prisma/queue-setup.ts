import { setupQueue } from "../src/scripts/queue-setup.ts";

setupQueue()
  .then(() => {
    process.exit(0);
  })
  .catch((error: unknown) => {
    process.stderr.write(`queue setup failed: ${String(error)}\n`);
    process.exit(1);
  });

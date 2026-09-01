/**
 * CI gate G-04 (PLAN/09 §5).
 *
 * Counts every validation rule `V-nn` in the table in PLAN/03 §4, then asserts
 * each number has at least one test naming it inside `describe(...)`.
 *
 * This is the direct antidote to D-04: a rule that was never written never
 * fails, is never logged, and is never seen. With this gate, adding a rule to
 * the document without writing its test FAILS the pipeline.
 */
import { join } from "node:path";
import { read, report, ROOT, walk } from "./files.ts";

const SPEC = "PLAN/03-Aturan-Domain-Mesin-Poros.md";

// Table rows that begin with a rule number: `| V-01 | ... |`
const inSpec = new Set([...read(SPEC).matchAll(/^\|\s*(V-\d{2})\s*\|/gm)].map((m) => m[1]!));

const testFiles = [join(ROOT, "apps"), join(ROOT, "packages")].flatMap((dir) =>
  walk(dir, [".test.ts", ".test.tsx"]),
);

// Numbers appearing inside a `describe("V-01: ...")` title.
const inTests = new Map<string, string[]>();
for (const file of testFiles) {
  for (const match of read(file).matchAll(/describe\s*\(\s*["'`]\s*(V-\d{2})\b/g)) {
    const number = match[1]!;
    inTests.set(number, [...(inTests.get(number) ?? []), file]);
  }
}

const untested = [...inSpec]
  .filter((n) => !inTests.has(n))
  .sort()
  .map((n) => `${n} is in ${SPEC} but no test references it`);

const undocumented = [...inTests.keys()]
  .filter((n) => !inSpec.has(n))
  .sort()
  .map((n) => `${n} is tested in ${inTests.get(n)!.join(", ")} but is not in ${SPEC}`);

process.stdout.write(
  `Rule-sync gate — ${inSpec.size} rules in spec, ${inTests.size} rules covered by tests\n`,
);
report("G-04 every V-nn has a test", [...untested, ...undocumented]);

if (untested.length > 0 || undocumented.length > 0) process.exit(1);

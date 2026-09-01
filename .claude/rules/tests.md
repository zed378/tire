---
description: Test-writing rules
paths: ["**/*.test.ts", "**/*.test.tsx", "**/__tests__/**"]
---

# Test Rules (PLAN/09 §4.4)

- **Tests are written from `PLAN/`, never from the implementation.** A test
  derived from agent-written code only proves the agent is consistent with
  itself, not with the specification.
- Every `V-nn` rule in `PLAN/03` §4 must have a test naming it in
  `describe(...)`, e.g. `describe("V-01: ...")`. Gate G-04 counts them; a
  mismatch fails the pipeline.
- `kernel/axle` requires **100% branch coverage** and a mutation score >= 85%.
- **A test that is green on the first run is suspect.** Run it before the
  implementation exists and confirm it is RED. A test that was never red
  tests nothing.
- Rejection tests matter as much as acceptance tests: every rule is exercised
  with input that violates it.
- Status-transition tests must assert that an `audit_logs` row was added.
- Never loosen an assertion to get green. If a test fails, the code is wrong.

# Task: <one line>

**Module:** `apps/api/src/modules/<name>` or `apps/web/src/features/<name>`

**Binding specification**
- `PLAN/03` §<x> — domain rules
- `PLAN/05` §<y> — endpoint contract
- `PLAN/02` / `PLAN/11` §<z> — tables touched

**Validation rules to implement:** V-04, V-07, V-11
*(every number needs a test that names it — gate G-04 counts them)*

**Acceptance criteria**
- [ ] Tests for V-04, V-07, V-11 exist, name their number in `describe(...)`,
      and were RED before the implementation was written
- [ ] Response envelope matches `PLAN/05` §2 with no exceptions
- [ ] Status changes write an audit entry in the same transaction (`PLAN/04` §6)
- [ ] No cross-module imports (checked by lint)
- [ ] `pnpm verify` is green

**Out of scope**
- <explicit list of what must NOT be touched>

---

The last section is the one most often left blank and the one that saves the most
work. Without an explicit boundary, an agent tends to tidy up files it was not
asked about — and that is where most hard-to-trace regressions come from
(`PLAN/09` §3.2).

**Do not skip the RED step.** Run the test before the implementation exists and
watch it fail. A test that is green on its first run has not been shown to test
anything, and nobody will notice later.

# Acceptance

One file per phase, signed off by a human before the next phase begins.

That rule is the only protection against R-01, which `PLAN/08` §5 names the
number one risk on this project: **code accumulating faster than anyone can
verify it.** The old risk — a lone developer stopping work — was sudden and
visible. This one is quiet. Every week looks productive, right up until the first
production bug lands in code nobody has ever read.

`PLAN/08` §2.2 sets the safeguard plainly: if verification falls behind, the
agent stops. Not slows down — stops.

## What a phase file contains

- The acceptance list from `PLAN/08` §3 for that phase, verbatim
- A tick against each line, with the date it was checked
- Anything checked **manually on staging**, named as such
- What was deliberately deferred, and why
- A signature and a date

## What cannot be delegated (`PLAN/09` §6)

| # | Work | Why a gate cannot catch it |
|---|---|---|
| N-01 | Answering the open product questions | An agent will pick one confidently, and the pick locks the schema |
| N-02 | Authoring the validation rule table in `PLAN/03` | It is the independent source the tests are derived from |
| N-03 | Verifying the data migration | Deciding which differences are acceptable takes business knowledge |
| N-04 | Field-testing the offline queue | A human, in a garage, with bad signal, on a real phone |
| N-05 | Accepting or rejecting a phase | This is the whole of the system owner's role here |
| N-06 | Anything touching production | Deploys and production migrations are approved by a person, without exception |

## Reading a diff

`PLAN/09` §7 is worth re-reading before each review, but one line matters more
than the rest:

> **Read the diff on test files more carefully than the diff on code.**

Wrong code fails a test. A wrong test fails nowhere at all.

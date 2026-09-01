# Open questions

Decisions that belong to the system owner, not to whoever is writing the code.
`PLAN/09` §6 lists six things that must not be delegated to an agent, and N-01
and N-02 are both here: answering the open questions in `PLAN/00` §5, and
authoring the validation rule table in `PLAN/03` §4.

The reason for the split is specific rather than ceremonial. An agent asked to
resolve an ambiguity will resolve it confidently, and a confident wrong answer
about the shape of the data locks the schema. Worse, an agent that *adds* a
validation rule on its own has produced a rule with no independent source — and
gate G-04, which counts rules against tests, would then only be checking the
agent against itself.

---

## Answered during this implementation

| # | Question | Answer | Consequence in the code |
|---|---|---|---|
| Q-11 | Must suppliers enter a chassis number from the first release? | Staged: the column exists, nullable; uniqueness rests on the plate | `vehicles.chassis_number` is nullable, `uq_vehicle_chassis` is a partial index |
| Q-12 | What if supplier A types a plate registered by supplier B? | Option (c): allow it, flag the vehicle for admin review | `vehicles.needs_review`, plus a `vehicle.duplicate_suspected` event |
| Q-13 | Do users have an email address? | Yes — added from the first migration | `users.email`, `users.phone`, both nullable |
| Q-14 | Is inspection per period, or once per vehicle lifetime? | Column now, per-vehicle index for now | `inspections.campaign_year` exists; `uq_locking_inspection` is on `vehicle_id` alone |

Q-14's answer leaves a decision pending rather than closed. `PLAN/11` §5.7 is
worth re-reading before the end of 2026: with `passed_qc` locking, a vehicle
that passes QC can never be inspected again. If this is an annual programme —
and the system is called Commercial **2026**, with the year inside every Serial
Number — then the correct index is `(vehicle_id, campaign_year)`, and switching
to it is a one-line change *today* and an index rebuild on a live table later.

---

## Still open, and who they block

### Q-01 — a 35th axle combination the rule table does not cover

**Found while implementing, not inherited from the plan.**

Reproducing the 34 combinations in `PLAN/03` §3 requires a rule that section §4
does not state: a second steer axle is only offered on 4- and 6-axle vehicles.
It comes from the prose note in §3 about the legacy dropdown, not from the
numbered table.

Without that rule the enumeration produces 36 rows: a 3-axle vehicle configured
steer 2 + drive 1 would also be valid, and `validateAxleConfiguration` currently
accepts it.

It has deliberately **not** been added as a new `V-nn` rule. That is N-02
territory. The question is:

> Is a 3-axle vehicle with two steer axles a real configuration that should be
> accepted, or should it be rejected the way `PLAN/03` §3 implies?

- If **rejected**: add the rule to `PLAN/03` §4 as `V-15`, and gate G-04 will
  then require a test naming it.
- If **accepted**: the enumeration in `combinations.ts` needs the constraint
  removed and the count in `PLAN/03` §3 corrected to 36.

Where it lives: `packages/contracts/src/axle/combinations.ts`, with the same
note.

### Q-02 — special-purpose plates

`PLAN/11` §4.1 tightens the plate pattern to the Indonesian civil form. Government,
embassy, and special-purpose plates follow different patterns and are currently
**rejected**.

> Does the customer fleet include vehicles with non-civil plates?

Rejecting a legitimate vehicle in the field is far more damaging than accepting
an odd-looking plate, so if the answer is yes, the regex loosens. One place to
change: `PLAN_PLATE_DISPLAY_PATTERN` in `packages/contracts/src/vehicle.ts`.

Blocks: nothing today. Would block a rollout to a fleet that has them.

### Q-03 — LT and small buses

`PLAN/03` §4.2 leaves this open and the constraint `ck_lt_not_bus` currently
enforces the strict reading.

> Is any vehicle classified `LT` in business terms but shaped like a bus — a
> minibus, a passenger *elf*?

If so, LT needs a third segment rather than being forced into `truck`.

### Q-04 — EXIF and location

`PLAN/06` §3.1 recommends keeping the capture time and discarding GPS, which is
what the code does. Recording every field worker's coordinates all day is
personal-data collection that would need a legal basis, a notice, and its own
retention policy.

> Does any customer contract require proof of location?

If it does, option three in that section applies and brings consent, a privacy
notice, and explicit retention limits with it.

### Q-05 — thirty photos per inspection

`PLAN/06` §6 sets the cap at 30 and asks for it to be confirmed against field
practice. The arithmetic: two general photographs plus one per position on the
largest vehicle is 24.

> Is 30 enough for real work, or do inspectors routinely take more?

The cap is what stands between 84 GB and 562 GB of storage in year one, so it
should be confirmed rather than assumed.

### Q-06 — is the field fleet mostly iPhones?

`PLAN/06` §4.3 is blunt about this and `PLAN/08` R-03 carries it as a risk. iOS
clears site storage after roughly seven days without a visit, has no Background
Sync, and applies a tighter quota. The application surfaces all three limits
honestly rather than pretending otherwise, but it cannot remove them.

> What do field workers actually carry?

If the answer is mostly iPhones, the PWA decision needs revisiting **before**
F3 is signed off, not after release.

---

## How to close one

1. Answer it in writing, here.
2. If the answer adds or changes a validation rule, edit the table in
   `PLAN/03` §4 yourself. Do not delegate that.
3. Write the test that names the rule number.
4. Watch it fail.
5. Then the implementation.

Step 4 is the one that gets skipped. A test that is green the first time it runs
has not been shown to test anything.

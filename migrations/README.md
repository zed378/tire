# Legacy migration toolkit (F6)

Implements the method in `PLAN/07`. What it cannot do is run: `PLAN/07` opens by
saying the document is complete as a method and empty as a plan, because nobody
has measured the source yet.

**Do not schedule a migration before §1 is finished.**

## Step one, before anything else

Four things must be measured rather than estimated (`PLAN/07` §1):

| # | Measure | How |
|---|---|---|
| I-01 | Row counts per sheet, sheet names, column headers | Open the spreadsheet and write down what is there |
| I-02 | File count and total size in the Drive folder | An Apps Script that walks it recursively |
| I-03 | How passwords are stored in the user sheet | Look. It determines nothing about §5, but you should know |
| I-04 | Column layout of the exported Excel file | Click export and open the file |

I-04 matters beyond the migration. That export is a reporting contract people
already work from; if the new format differs, some downstream process breaks and
nobody sends a message about it.

## What this toolkit provides

| File | Does |
|---|---|
| `src/normalise.ts` | Plate normalisation, segmentation parsing, axle-string parsing — each returning either a value or a quarantine reason |
| `src/deduplicate.ts` | Groups rows by `plate_key` into one vehicle and N inspections (`PLAN/11` §8) |
| `src/quarantine.ts` | Writes and resolves rows in `migration_quarantine` |
| `src/verify.ts` | The daily comparison for the parallel-run weeks (`PLAN/07` §6) |

## What it deliberately does not do

**It does not guess.** `PLAN/07` §2 rule 3: dirty data is carried across as-is
and quarantined, never silently corrected. A script that infers what a human
meant produces mistakes that are harder to find than the dirty data was.

Three shapes of bad data are expected, and each has a decision attached that a
person makes, not a script:

1. **Plates with invalid characters.** D-05 proves they are in there — `!` was
   observed getting through. `B1234ABC!` might be a typo for `B1234ABC1`;
   stripping the character would be a guess.

2. **Axle detail that does not add up.** D-04 was never validated, so a
   `Jumlah Poros = 6` with three detailed axles is likely present. `PLAN/07` §3.2
   sets out three routes and recommends: quarantine for `passed_qc` rows (a human
   already looked at those photographs and approved them — the data is too
   important to guess at), trust the detail for everything else (the tire count
   stays right, and the tire count is what QC was looking at).

3. **Repeated plates.** Not all of them are conflicts. A plate that repeats with
   `dropped_qc` is the *correct* pattern under `PLAN/11` §5.4: rejected, then
   resubmitted. Flagging those produces hundreds of false findings that consume
   the quarantine time meant for real ones.

## Photos

The hardest part, and the longest (`PLAN/07` §4). Path matching relies on the
legacy convention `{SerialNumber}_{PlatNomor}_{Posisi}`.

Two things to hold onto:

- Files whose path cannot be parsed go on an orphan list for manual review.
  Never skipped quietly.
- **Archive photographs are not recompressed** (`PLAN/07` §4.3). They are
  evidence of work; modifying them during migration removes the ability to show
  they are original. New photographs are compressed on the device before they
  ever reach a server, so this applies only to the fixed set of old ones.

Run it as batched pg-boss jobs that can be paused and resumed — not as one long
script. Over hundreds of thousands of files, a script that dies halfway with no
resume means starting again.

## Passwords

Not one is migrated, whatever I-03 finds (`PLAN/07` §5). Plain text obviously
cannot come across; a weak hash is no better; and even a strong hash has been
sitting somewhere readable by an unknown number of people for an unknown length
of time. Every user is recreated with a one-time initial password.

## Cutover

`PLAN/07` §7 lists the prerequisites. Two are easy to let slide and should not
be:

- **Zero unexplained differences across five consecutive working days.** Not
  "small" differences. Explained ones.
- **The old system becomes read-only, not deleted.** It costs nothing to keep
  and it is the only safety net. Withdraw write access technically, not by
  asking people not to use it.

After week six a rollback is no longer realistic, because new data exists only
in the new system. Say that date out loud to everyone rather than letting it
pass unnoticed.

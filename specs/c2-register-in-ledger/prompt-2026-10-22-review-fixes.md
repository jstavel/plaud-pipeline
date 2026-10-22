# Prompt: C2 review fixes (spec + contracts reconciliation)

**Použití:** jednorázový vstup (záznam review roundu 2026-10-22); patří vedle artefaktů capability, ne do šablon v `prompts/`. Dej tento text builder agentovi (OpenCode) pro capability
`c2-register-in-ledger`. Vychází z nezávislé recenze clarify round 1 + plan
artefaktů (2026-10-22). Nejde o nové plánování — jde o závaznost deferovaných
rozhodnutí a dva konkrétní omyly nalezené proti realitě.

---

The owner accepted clarify round 1 (Q1–Q5) and an independent review found three
classes of defects that must be settled **before** `/speckit.tasks` or any
implementation. Do not build code. Do not re-open settled decisions. The intent
is: the spec must contain no sentence we already know is false as written, and
the contracts must match the real ledger byte-for-byte where they claim to.

## Fix 1 — Padding column is wrong (contract vs. reality)

`specs/c2-register-in-ledger/contracts/ledger-entry.md` says property values
begin at **column 16**. In the real ledger (`~/org/ingest-ledger.org`, e.g.
`:HASH:` and `:FILESIZE:` lines) values begin at **column 14**. Because C2 is
append-only and records are never rewritten, a wrong padding would be frozen
forever.

- Verify the real column empirically (do not trust either number blindly) and
  make the contract state the measured truth.
- Add a byte-exact contract test that serializes an entry and compares it
  against a **verbatim sample taken from the real ledger** (a `TODO` record
  with all ten properties, no `:DECISION:` drawer), normalizing only the
  values, not the whitespace layout. The whitespace layout itself must be
  asserted, not just "column N".

## Fix 2 — OPEN-17 was dropped

`spec.md` SC-001 says "0 duplicit" with no defined referent; OPEN-17 was triaged
in `readback.md` but is missing from the deferred list in `spec.md`.
Record it in `## Clarifications` (deferred section, same style as the others)
with the owner-accepted intended reading: "0 duplicates" means both (a) zero
duplicate hashes among the resulting 100 records and (b) zero files reported as
duplicates during the run.

## Fix 3 — Deferred intended readings must supersede the literal spec text

`readback.md` §3.0 triaged OPEN-03/12/16/18 into "spec text must change before
plan", but they were recorded only as intended readings, and the literal AC/FR
sentences they contradict are still in place (notably US3 AC2
"žádný jiný stav se v ledgeru neobjeví", which is false against the real ledger
that contains `WAIVED`). The owner has accepted the intended readings as
binding. Amend the spec so the binding reading is in the normative text:

- **US3 AC2** — scope the claim to records created by this run, and add a
  separate assertion that no pre-existing record changes state (cf. FR-005).
- **OPEN-18** — make "C2 never backfills an empty `:PLAUD-ID:`; enrichment is a
  separate stage" explicit in FR-009 or an adjacent FR, so FR-005's
  never-rewrite invariant and the API-degradation behaviour are not in tension.
- **OPEN-12** — the report schema/exit-code policy lives in
  `contracts/run-report.md`; add a one-line pointer from US2 so the AC's
  "výstup uvádí" has a defined referent instead of none.
- **OPEN-03** — state the invariant explicitly in FR-002 or an adjacent FR:
  any hash already present anywhere in the ledger suppresses a new record,
  regardless of that record's state.

Keep the deferred records in Clarifications (they document the history); the
amendments make the normative text match them. Do not silently rewrite approved
clarify answers — only align the sentences they already supersede.

## Done means

- `contracts/ledger-entry.md` states the measured padding column, backed by a
  new byte-exact contract test (test written first, failing against the current
  contract, per constitution I).
- `spec.md` contains OPEN-17 and the four superseded readings are in normative
  AC/FR text, each traceable to its OPEN id.
- No other spec/contract/plan text changes; report any inconsistency you notice
  but do not fix it unilaterally.
- All changes committed with a message naming the review date and the three fix
  classes.
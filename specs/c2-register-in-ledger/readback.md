# C2 — Register in Ledger: read-back

**Capability**: `c2-register-in-ledger`
**Date**: 2026-10-21
**Gate**: comprehension before `/speckit.plan`; no plan, tasks, code, or scaffolding.
**Gate verdict**: **CONDITIONAL — not ready for `/speckit.plan`.** The spec has
conflicts that must be settled in `spec.md` before planning; the triage in §3.0
separates them from plan-level items.

**Resolution update (2026-10-21)**: clarify round 1 accepted Q1 **B**, Q2 **A**,
Q3 **A**, Q4 **A**, Q5 **A**. OPEN-01/02/10/15/19 are now resolved in `spec.md`
Clarifications; OPEN-03/16/12/18 remain deferred there with intended readings. The
verdict and §3.0 below describe the pre-clarify state.

**Artifacts read (not restated here)**

- `specs/c2-register-in-ledger/spec.md` (status: Clarified, `spec.md:7`)
- `.specify/memory/constitution.md`
- ADR 0011, ADR 0012, ADR 0013 in `~/org/docs/adr/`
- Ledger contract: `~/org/projects/ingest-spec.org`, v2 section `Šablona záznamu v2`
- Capability table: `~/org/projects/plaud-pipeline.org:242-261`
- Actual ledger: `~/org/ingest-ledger.org:1-24`
- `.specify/templates/spec-template.md`, `plan-template.md`, `tasks-template.md`
- `.opencode/commands/speckit.specify.md`, `speckit.clarify.md`, `speckit.plan.md`, `speckit.analyze.md`, `speckit.checklist.md`

## 1. Restatement

C2 is the registration stage: it looks only at the immediate children of
`~/Downloads`, identifies each file by the sha256 of its bytes, and appends one new
org subtree to `~/org/ingest-ledger.org` for each hash not already present there.
Each new subtree remains in `TODO`, carries the contract's technical metadata,
leaves the synopsis for C4, and records where its creation date came from; it never
edits or deletes a source file or an existing ledger record. Human decisions and
state transitions are out of scope, and the machine only ever creates `TODO`.
`:PLAUD-ID:` may be filled from the Plaud API when a `start_at` join succeeds, but
API failure degrades to an empty field rather than a failed run. The run reports
new/duplicate/out-of-scope/error counts, and an immediately repeated run adds zero
records.

## 2. Obligations

An obligation with no executable check is called out in the check column and in §4
rather than treated as done.

| ID | Source | Obligation | How it becomes a check |
|---|---|---|---|
| FR-001 | `spec.md:103` | Scan only top-level `~/Downloads`, non-recursively. | Fixture with one top-level file and one file under `sub/`; assert exactly one new subtree and no `SOURCE` under `sub/`. Add a regression test that a nested-only fixture adds zero (also SC-003). |
| FR-002 | `spec.md:104-105` | Identity is sha256 of file content; duplicate decision is by hash alone. | Compute independent sha256 in the test, compare with `:HASH:`; run two different paths with identical bytes and assert one record. Also test same path changed content yields a new hash. |
| FR-003 | `spec.md:106-108` | Metadata: absolute `:SOURCE:`, `:DURATION:` from ffprobe, `:BITRATE:`, `:FILESIZE:`, `:KIND:`; `:CREATED:` from filename date else `mtime`, with the chosen source written to `:LOGBOOK:`. | Fixture with known audio bytes and a filename date: compare `SOURCE` to the absolute fixture path, `FILESIZE` to `stat`, `DURATION`/`BITRATE` to an independent ffprobe call, `CREATED` to the filename date, and grep `LOGBOOK` for the source token. Second fixture with no parseable date: same checks against `mtime`. `:KIND:` has no derivation rule yet (OPEN-08), and `:BITRATE:`/`:FILESIZE:` are absent from the v2 template cited as the contract (OPEN-19/M1), so those columns cannot be asserted until both are decided. |
| FR-004 | `spec.md:109` | New records are `TODO`; the machine never sets another state. | Assert every heading created by the run starts with `* TODO`, and assert every pre-existing heading is byte-identical after the run (states included). The executable oracle is the before/after ledger, not a code-path inspection. |
| FR-005 | `spec.md:110` | Existing records are never rewritten or moved. | Snapshot the ledger before the run and assert the old bytes are a prefix of the new bytes plus inserted subtrees, with no deletions or reordering. Per-record byte comparison for each pre-existing heading, not only the `WAIVED` case in SC-004. |
| FR-006 | `spec.md:111` | `~/Downloads` is read-only: no file modified or deleted. | Snapshot content hash + `mtime` + size (and inode where available) of every fixture file before/after; assert no change and no extra/missing files. |
| FR-007 | `spec.md:112-113` | Resulting file remains Emacs-parsable with the five declared states. | Run the exact Emacs batch check required by SC-006 against the resulting fixture ledger, plus a structural assertion that the new subtree is a valid property drawer + `LOGBOOK` drawer. The exact command is missing from the repo (OPEN-11). |
| FR-008 | `spec.md:114` | Second run over the same state adds zero records. | Run twice on the same fixture; assert second report is zero new and the ledger bytes are unchanged between run 1 and run 2 (SC-002). |
| FR-009 | `spec.md:115-117` | `:PLAUD-ID:` only from API, joined on `start_at`, never guessed from filename; throttle + backoff; API unavailable leaves it empty and does not fail the run. | Mock API: matching `start_at` fills the exact ID; non-matching leaves the property empty and exit code 0; 429/timeout responses are retried per policy and ultimately leave it empty and exit 0. Assert no filename-derived ID. The `start_at` input itself is undefined (OPEN-09/10), so this test cannot be completed yet. |
| FR-010 | `spec.md:118-119` | Registration neither creates nor modifies `:SYNOPSIS:`; empty is valid (C4 fills it). | Assert every new subtree's `:SYNOPSIS:` is empty and assert a pre-existing non-empty `:SYNOPSIS:` is byte-identical after the run. Direct conflict with SC-008 wording (OPEN-15). |
| SC-001 | `spec.md:123` | 100 files in a fixture → 100 records, 0 duplicates. | Fixture of 100 distinct-content files; assert exactly 100 new subtrees, 100 distinct hashes, and no duplicate headings. “0 duplicates” needs a definition (OPEN-17). |
| SC-002 | `spec.md:124` | Second run → 0 new records. | Same second-run check as FR-008: report says 0 new and ledger is unchanged. |
| SC-003 | `spec.md:125` | 20 files in a subdirectory → 0 records. | Nested-only fixture; assert 0 new subtrees and no `SOURCE` under the subdirectory. |
| SC-004 | `spec.md:126` | A `WAIVED` record is byte-identical after the run. | Snapshot the exact heading text of a `WAIVED` record; compare byte-for-byte after the run. Extend to one record in each of the five states because FR-005 is broader than SC-004. |
| SC-005 | `spec.md:127-128` | Every new record has non-empty `:HASH:`, `:SOURCE:`, `:DURATION:`, `:KIND:` and state `TODO`. | For each new subtree: non-empty property regex + state assertion. Currently not fully satisfiable if “every file” includes non-audio, because ffprobe has no duration for e.g. text/zip (OPEN-01). |
| SC-006 | `spec.md:129-130` | Ledger passes an Emacs batch check with `org-todo-kwd-alist` over five states. | Commit the exact Emacs batch command and fixture, run it in test/CI, assert exit 0 and that all five keywords are recognised. The “dnešní ověření” command is not in the repo (OPEN-11). Test-only Emacs use does not violate the constitution's no-running-Emacs production constraint. |
| SC-007 | `spec.md:131` | `mtime` of every file in `~/Downloads` is unchanged after the run. | Snapshot `stat` before/after; assert equality for all fixture files. Note this is narrower than FR-006 (content and deletion also matter). |
| SC-008 | `spec.md:132-133` | Every new record has an **empty** `:SYNOPSIS:`, and the test treats this as expected. | Assert the property exists with an empty value for every new subtree. This is only checkable once OPEN-15 resolves whether “empty” means an empty property or an absent property. |

## 3. Ambiguities (every item OPEN)

### 3.0 Triage — what actually blocks the plan

| Class | Items | Why |
|---|---|---|
| **Spec text must change before `/speckit.plan`** | OPEN-01, OPEN-02, OPEN-15, OPEN-16, OPEN-03, OPEN-19 (M1), OPEN-12, OPEN-10, OPEN-18 | Each contradicts another sentence, the contract, or the existing ledger; planning cannot settle intent without deciding these. OPEN-03 is low-priority: the risk is currently theoretical (no shared cross-state hash measured), but it must be stated as an invariant. |
| **Derive from artifact, then confirm** | OPEN-06, OPEN-07, OPEN-08, OPEN-09 | The answer mostly exists in the existing ledger or contract; the task is to write it down, not choose freely. |
| **Plan-level** | OPEN-04, OPEN-05, OPEN-11, OPEN-13, OPEN-14 (except the M1 template-delta part) | Injection, sort order, test harness, insertion point, and error policy are implementation choices once intent is fixed. |

The spec-text set above is now recorded in `spec.md` → `## Clarifications`
(session 2026-10-21, review read-back); those items still need Jan's decisions before
the plan. The rest may proceed into the plan once they are closed.

### OPEN-01 — Does “every file” include non-audio, and what happens to `:DURATION:`?

**Question**: The scope says every file in top-level `~/Downloads` (`spec.md:15-17`),
but `:DURATION:` must come from ffprobe and SC-005 requires it non-empty for every
new record (`spec.md:106-108`, `spec.md:127-128`). Which wins?

**Options**:
- A. Register every regular top-level file; allow `:DURATION:` to be empty/`N/A`
  for non-audio and narrow SC-005 accordingly.
- B. Restrict C2 to audio extensions; declare everything else out of scope.
- C. Register every file and write a synthetic duration such as `0`.

**Recommendation**: A. It preserves the literal scope and the ledger-as-inventory
intent, avoids inventing data (C), and does not silently drop `.zip`/documents that
ADR 0013 treats as valid archive objects. It requires an explicit spec amendment to
SC-005.

**Why**: The current text guarantees a failing or fabricated check for any non-audio
file; that is exactly the kind of untestable obligation this gate exists to catch.

### OPEN-02 — How can a flat, non-recursive scan report an out-of-scope file inside a subdirectory?

**Question**: FR-001 forbids recursion (`spec.md:103`) and AC 1.3 says a file under
`~/Downloads/zaloha/` must not get a record (`spec.md:65-66`), yet US2 requires the
report to name `mimo scope: 1` for “1 soubor v podadresáři” (`spec.md:80-82`). What
is counted as “mimo scope”?

**Options**:
- A. Count each top-level directory entry as one out-of-scope item; never read its
  contents.
- B. Enumerate one level into subdirectories for reporting only, without registering.
- C. Drop the `mimo scope` count for nested files and only count non-regular or
  unreadable top-level entries.
- D. Keep the count but change the fixture to a top-level directory, treating the
  directory itself as the item.

**Recommendation**: A (equivalently D in fixture wording). It keeps ADR 0013's
non-recursion absolute and makes “mimo scope” mean “a top-level thing we do not
register”, not “we looked inside an archive”.

**Why**: B reintroduces the recursive read that ADR 0013 explicitly bans. The defect
is not that FR-001 is impossible to implement without recursion; it is that US2 AC1's
wording (“1 soubor v podadresáři”) contradicts the flat-scan contract. The fix is an
AC/text amendment, not a planning choice.

### OPEN-03 — Does a hash already present on an out-of-scope/`WAIVED` record suppress a new top-level file?

**Question**: Duplicate detection is by hash alone (`spec.md:104-105`). The ledger
retains out-of-scope records in `WAIVED` (ADR 0013 §3; e.g.
`~/org/ingest-ledger.org:1054,1076,1098`). If a top-level file has the same bytes as
such a record, should C2 register nothing?

**Options**:
- A. Any hash already in the ledger counts; register nothing.
- B. Only non-terminal records, or records whose `:SOURCE:` is in scope, count.
- C. Allow a second record when the same hash appears with a new in-scope source.

**Recommendation**: A for v1, with the consequence named explicitly: an in-scope file
can be invisible because its content was once seen out of scope. B or C would need a
decision that modifies the “same content = same record” invariant from ADR 0011 /
ingest-spec v2 rule 4.

**Why**: **Measured 2026-10-21**: no hash currently appears in two different states in
the real ledger, so there are zero live instances today. The risk is theoretical now
but becomes real the first time a top-level file matches a `WAIVED` subdirectory
record. It should become a fixture test (same hash as a `WAIVED` record → 0 new
records), not a v1 blocker.

### OPEN-04 — How do tests point the pipeline at a fixture instead of the real `~/Downloads`?

**Question**: Every independent test says “fixture adresář” (`spec.md:54`, `spec.md:75`,
`spec.md:123`), but the scope names a fixed absolute path and no configuration or CLI
input is specified (`spec.md:15-17`, `spec.md:103`). How is the entry point and ledger
path injected?

**Options**:
- A. Explicit CLI options or environment variables, with production defaults of
  `~/Downloads` and `~/org/ingest-ledger.org`.
- B. Override `HOME`/XDG paths per test process.
- C. Copy fixtures into the real `~/Downloads` during tests.

**Recommendation**: A. Defaults preserve normal use; explicit injection makes every
SC independently runnable and keeps tests away from real data.

**Why**: C violates the “do not touch Downloads” spirit and is not isolated; B is
possible but implicit and easy to get wrong.

### OPEN-05 — Which file wins when two new files in the same run have identical content?

**Question**: Hash is the identity (`spec.md:104-105`), but two top-level paths can
contain identical bytes in one scan. Which `:SOURCE:` is recorded and which is reported
as duplicate?

**Options**:
- A. Deterministic sort by filename/path, first wins, rest reported as duplicates.
- B. Register both paths under one hash.
- C. Treat the run as an error and register neither.

**Recommendation**: A, using a documented byte-wise or locale-independent sort. The
losing path must appear in the duplicate report.

**Why**: Constitution III requires determinism; “whichever the directory listing
returns first” is not deterministic.

### OPEN-06 — What exactly counts as a date “in the filename” for `:CREATED:`, and what is written to `:LOGBOOK:`?

**Class**: derive from artifact, confirm. The ledger already shows
`2026-04-01 10_37_45.mp3` → `CREATED: 2026-04-01` (`~/org/ingest-ledger.org:4-9`);
only the accepted pattern and exact log token need writing down.

**Question**: `:CREATED:` comes from the filename date, otherwise `mtime`, and the
source is logged (`spec.md:35-38`, `spec.md:107-108`). Which filename patterns are
accepted, what format is written, and what exact log text identifies the source?

**Options**:
- A. Accept only a leading `YYYY-MM-DD` (the Plaud pattern seen in the ledger), write
  `YYYY-MM-DD`, log e.g. `:CREATED: from filename` / `from mtime`.
- B. Also parse date-time patterns and write full timestamps.
- C. Use ffprobe `creation_time` before `mtime`.

**Recommendation**: A, plus a fixed logger token. The actual ledger uses
`2026-04-01` from names like `2026-04-01 10_37_45.mp3`
(`~/org/ingest-ledger.org:4-9`).

**Why**: Without an exact pattern and log token, the fallback cannot be tested and
the “rozeznat odvozené datum od skutečného” purpose in `spec.md:37-38` is lost.

### OPEN-07 — What formats are required for `:DURATION:` and `:BITRATE:`?

**Class**: derive from artifact, confirm. The ledger already shows `06:48` and `32k`
(`~/org/ingest-ledger.org:9-10`); the open part is the rounding/fallback rule.

**Question**: `:DURATION:` comes from ffprobe and `:BITRATE:` is required
(`spec.md:106-108`), but neither format is specified. The actual ledger shows
`DURATION: 06:48` and `BITRATE: 32k` (`~/org/ingest-ledger.org:9-10`).

**Options**:
- A. Match existing ledger: `MM:SS` / `HH:MM:SS`, bitrate as e.g. `32k` or `128k`.
- B. Write raw ffprobe values: seconds and bits/second.
- C. Humanised strings.

**Recommendation**: A, with an explicit rounding rule and a defined fallback when
ffprobe lacks a field.

**Why**: Raw seconds would make new records inconsistent with the existing ledger and
break simple string-based checks that reviewers will naturally write.

### OPEN-08 — What rule assigns `:KIND:`?

**Question**: `:KIND:` is required (`spec.md:106-108`) and listed as an entity field
(`spec.md:138`), but no derivation rule is given. The contract names
`Plaud-voice-record`, `audio-file` and (for directories as archives) `archive`
(`ingest-spec.org`, “Šablona záznamu v2”; ADR 0013 §2).

**Options**:
- A. `Plaud-voice-record` iff a matching `:PLAUD-ID:` was found, else `audio-file`.
- B. `Plaud-voice-record` iff the filename matches the Plaud timestamp pattern, else
  `audio-file`; `archive` for recognised archive extensions.
- C. Classify by extension/MIME only.

**Recommendation**: B, because A would misclassify every Plaud file when the API is
down, which FR-009 explicitly allows. The exact pattern must be written down.

**Why**: `KIND` is part of the ledger contract and the capability AC; without a rule,
SC-005's `KIND` check has no oracle.

### OPEN-09 — How is `start_at` derived for the Plaud API join?

**Question**: FR-009 says join on `start_at`, never guess the ID from the name
(`spec.md:41-42`, `spec.md:115-117`). Where does `start_at` come from for a local file,
and in which timezone?

**Options**:
- A. Parse the Plaud filename timestamp, interpret in `Europe/Prague` (matching the C1
  contract), and skip the join if unparseable.
- B. Use ffprobe `creation_time`.
- C. Use file `mtime`.

**Recommendation**: A, because C1 already defines `start_at` in `Europe/Prague`
(`~/org/projects/plaud-pipeline.org:248`), and C3 consumes it indirectly via `id`
(`:250`); the filenames carry that timestamp.

**Why**: Without a stated derivation, the API behaviour and its tests cannot be built;
`mtime` is demonstrably a poor proxy for recording time.

### OPEN-10 — Does C2 call the Plaud API directly, or depend on C1's `inventory.json`?

**Question**: FR-009 requires an API join (`spec.md:115-117`), but C1 (Inventory) is
scheduled for v1.1 in the capability table (`~/org/projects/plaud-pipeline.org:248,272-274`)
and the spec's Dependencies section lists no C1/inventory contract (`spec.md:143-147`).
Which integration is intended?

**Options**:
- A. C2 owns a minimal Plaud API client and performs the join itself, through the one
  throttled network layer required by the constitution.
- B. C2 consumes `inventory.json` produced by C1 and is blocked until C1 exists.
- C. C2 leaves `:PLAUD-ID:` empty in v1 and defers enrichment.

**Recommendation**: A if C2 is to ship before C1; C is the cheapest honest v1 if the
capability can tolerate permanently empty IDs. B contradicts the stated v1 scope.

**Why**: This is a scope/dependency decision, not an implementation detail; it changes
whether C2 can be built at all in the current milestone.

### OPEN-11 — What is the exact Emacs batch check for SC-006?

**Question**: SC-006 references “dnešní ověření” but no command, fixture or elisp is
in the repo (`spec.md:129-130`). What exactly must pass?

**Options**:
- A. Commit a small Emacs batch script + fixture that sets `org-todo-kwd-alist` (or
  reads the file's `#+TODO:`) and asserts all five states parse; run it as a test-only
  prerequisite.
- B. Replace the Emacs check with a pure parser assertion and drop the Emacs wording.
- C. Treat it as a manual check.

**Recommendation**: A. The criterion is explicitly about Emacs parsing, and a committed
script makes it reproducible. C is not a check.

**Why**: The constitution only forbids depending on a running Emacs for production
read/write; a test-only batch run is compatible and is the only way to verify FR-007.

### OPEN-12 — What is the run-report format, channel, and exit-code policy?

**Question**: US2 requires an output containing `nové: 2`, `duplicity: 1`,
`mimo scope: 1` and exit code 0 (`spec.md:80-82`), while Key Entities adds an `chyby`
category (`spec.md:141`) with no requirement or acceptance criterion. Is the output
stdout text, a file, or JSON; what is the exact schema; when is the exit code non-zero?

**Options**:
- A. Human-readable stdout with exactly those Czech labels and path lists; exit 0 on a
  completed run even with per-file errors, non-zero only on fatal setup errors.
- B. Machine JSON on stdout with fixed keys plus a human summary on stderr.
- C. JSON to a report file and only the exit code on stdout.

**Recommendation**: B if the report must support C6 later and be mechanically testable;
A if v1 is strictly human-facing. Either way, the error category and exit codes must be
written into FR/SC.

**Why**: The current text allows many incompatible outputs, and the “chyby” category
has no defined behaviour.

### OPEN-13 — How are per-file failures handled (unreadable file, ffprobe failure, file disappears mid-run)?

**Question**: The report names `chyby` (`spec.md:141`), FR-009 only covers API
unavailability (`spec.md:115-117`), and no requirement says whether a bad file stops
the run, is skipped, or creates a partial record.

**Options**:
- A. Continue per file, emit an error entry with path + reason, create no partial
  record, and exit 0 if the run completed.
- B. Fail the whole run on the first error with a non-zero exit code.
- C. Create a record with missing fields.

**Recommendation**: A, consistent with FR-009's “fail soft” stance and with a batch
registration tool. C would violate SC-005.

**Why**: Without this, the `chyby` count is unbuildable and SC-005/FR-005 can be
violated by a single unreadable file.

### OPEN-14 — Where is a new subtree inserted, and does it follow v2 or the legacy on-disk shape?

**Question**: The contract's v2 template has no `:DECISION:` drawer, but the actual
ledger contains a legacy `:DECISION:` drawer with the old checkboxes
(`~/org/ingest-ledger.org:16-24`), which ADR 0011 replaced by states. Must new records
mirror the legacy shape, and where in the file are they appended?

**Options**:
- A. Append at EOF using the v2 template exactly, no `:DECISION:` drawer.
- B. Append at the top of the file.
- C. Mirror the legacy `:DECISION:` drawer for visual consistency.

**Recommendation**: A. Append-only forbids cleaning legacy records, but it does not
require propagating a superseded structure. The insertion point should be fixed and
separated by a blank line for org validity.

**Why**: **Measured 2026-10-21**: `:DECISION:` still appears in the ledger and in the
archived `gtd-org` staging worker (`components/org-staging/src/jstavel/org_staging/core.clj`,
its interface test, and `docs/contracts/enriched_staging_org_entry_schema.md`). No
consumer exists in this repo; `unsure` whether an external consumer outside those
paths remains. The v2 contract and ADR 0011 are the stated authority, so A is the
defensible reading.

### OPEN-15 — FR-010 “does not create `:SYNOPSIS:`” vs SC-008 “has an empty `:SYNOPSIS:`”

**Question**: FR-010 says registration neither creates nor modifies `:SYNOPSIS:`
(`spec.md:118-119`), while SC-008 requires every new record to have an empty
`:SYNOPSIS:` (`spec.md:132-133`) and the contract template includes the property.

**Options**:
- A. Include the property with an empty value; read FR-010 as “does not populate the
  value”.
- B. Omit the property entirely and change SC-008 to “no synopsis property”.
- C. Omit it and treat absence as empty in consumers.

**Recommendation**: A, because the contract template and existing ledger both carry
the property, and the clarification at `spec.md:26-33` speaks about an empty synopsis
being a valid state, not about an absent property.

**Why**: As written, FR-010 and SC-008 cannot both pass for the same record; one
sentence must be amended.

### OPEN-16 — US3 AC2 “no other state appears in the ledger” is impossible against the real ledger

**Question**: AC 3.2 says a new file produces `TODO` and “žádný jiný stav se v
ledgeru neobjeví” (`spec.md:98-99`). The existing ledger already contains `WAIVED`
and legacy records (`~/org/ingest-ledger.org`, ADR 0013). Is the intended claim about
this run's new records or about the whole file?

**Options**:
- A. No other state among records created by this run.
- B. No state change to any pre-existing record.
- C. Both A and B.

**Recommendation**: C, with the AC rewritten to say exactly that.

**Why**: As written it is false before the run starts, so it cannot be an independent
acceptance test.

### OPEN-17 — What does SC-001's “0 duplicit” measure?

**Question**: SC-001 says 100 fixture files → 100 records, 0 duplicates
(`spec.md:123`). Does “0 duplicates” mean zero duplicate hashes among inputs, zero
records skipped as duplicates, or zero duplicate headings in the ledger?

**Options**:
- A. Zero duplicate hashes/records in the resulting 100.
- B. Zero files reported as duplicates during the run.
- C. Both.

**Recommendation**: C, stated explicitly. It is cheap and removes an otherwise
ambiguous oracle.

**Why**: A fixture with 100 unique files is presumed; without a definition, a reader
cannot tell whether the criterion tests dedupe at all.

### OPEN-18 — May a later run backfill an empty `:PLAUD-ID:`?

**Question**: FR-009 allows a record to be created without `:PLAUD-ID:` when the API
is down (`spec.md:115-117`), but FR-005/FR-004 are append-only and forbid modifying
existing records (`spec.md:109-110`). If the API returns on the next run, does C2
update the empty field?

**Options**:
- A. Never backfill in C2; leave it empty permanently (append-only).
- B. Allow a narrowly defined empty→value update as an exception.
- C. Defer enrichment/backfill to a separate stage.

**Recommendation**: A or C for v1. B weakens the “never rewrite existing records”
invariant, which is a constitution-level protection.

**Why**: This determines whether “API failure is harmless” is really harmless; with A
the metadata may stay incomplete forever.

### OPEN-19 (M1) — Authority conflict: v2 record template vs FR-003 / Key Entities

**Class**: spec text must change before `/speckit.plan`.

**Question**: The contract cited in Dependencies is `ingest-spec.org` v2, whose
“Šablona záznamu v2” (`ingest-spec.org:57-76`) contains only `HASH`, `PLAUD-ID`,
`CREATED`, `DURATION`, `SOURCE`, `SYNOPSIS`, `KIND`. FR-003 (`spec.md:106-108`) and
Key Entities (`spec.md:137-139`) additionally require `:BITRATE:`, `:FILESIZE:` and
`:CLEANUP:`. Which authority wins?

**Options**:
- A. v2 is binding: drop `:BITRATE:`, `:FILESIZE:` and `:CLEANUP:` from C2 and amend
  FR-003/Key Entities.
- B. The spec is richer: extend the v2 template with those three properties and keep
  FR-003/Key Entities.
- C. Leave the contract stale and write the richer shape anyway.

**Recommendation**: B. The actual ledger records already carry `:BITRATE:`,
`:FILESIZE:` and `:CLEANUP:` (`~/org/ingest-ledger.org:9-12,14`), so A would silently
drop fields the existing data uses, while C institutionalises drift. But this is an
authority decision for Jan, not mine.

**Why**: It decides exactly which properties a new subtree contains and whether
FR-003 can be tested against the cited contract. Until it is resolved, the first
implementation either fails FR-003 or writes a shape the contract does not describe.

## 4. Method check through spec-kit's lens

### 4.1 Concerns that belong in `plan`, not `spec`

The spec template's own quality gate says “No implementation details (languages,
frameworks, APIs)” and success criteria must be technology-agnostic
(`.opencode/commands/speckit.specify.md`, step 8 “Specification Quality Validation”
and its Content Quality checklist, `:157-167`). This spec pulls several plan-level
choices into requirements:

- **sha256** as the hash algorithm (`spec.md:104`) — the ADRs/constitution already
  require content-hash identity; the algorithm choice belongs in plan/research.
- **ffprobe** as the metadata extractor (`spec.md:106-108`) — a tool choice.
- **Throttle + backoff and the API join mechanism** (`spec.md:115-117`) — the
  constitution mandates one throttled network layer, but concrete policy belongs in
  plan/research.
- **Emacs batch + `org-todo-kwd-alist`** (`spec.md:129-130`) — a verification-tool
  choice; the spec should state the required outcome (“remains org-valid with five
  states”), while the exact harness belongs in plan/tests.

This is not automatically a defect: these are inherited constraints and some are
contract-level. The fix is to reference the ADR/contract as authority instead of
restating them as feature requirements, so the plan can own the implementation choices.

### 4.2 Sections the methodology expects that are missing or thin

Against `.specify/templates/spec-template.md` and the clarify taxonomy
(`.opencode/commands/speckit.clarify.md`, step 3):

- **Edge Cases** — absent. No treatment of unreadable files, disappearing files,
  symlinks, hidden files, zero-byte files, duplicate content in one run, extremely
  large files, or a concurrent writer.
- **Assumptions** — absent. Nothing states that the ledger exists, that `~/Downloads`
  is local, that ffprobe is installed, that the Plaud API is optional, or that only
  regular files are considered.
- **Key Entities** — present (`spec.md:135-141`) but only at name/field level. There is
  no data model: property validation, required-vs-empty semantics, state lifecycle,
  identity/uniqueness, and the report schema are not defined. That belongs in the
  plan's `data-model.md` / `contracts/` (`.opencode/commands/speckit.plan.md`,
  Phase 1).
- **Contracts** — the ledger entry contract is referenced, but the project's own
  write contract (exact serialization, insertion point, escaping of `:SOURCE:` paths,
  report schema) is not. This should be a plan `contracts/` artifact.
- **Non-functional requirements** — almost entirely missing: performance/scale for
  1,163+ files, hashing I/O cost, API timeouts/retry budget, atomicity/locking when
  two runs overlap, failure recovery, observability, and privacy of absolute paths.
- **Dependencies** — `spec.md:143-147` lists documents and ADRs, not runtime
  dependencies (Plaud API, ffprobe, Emacs for tests). OPEN-10 shows this gap is
  material.

### 4.3 Acceptance criteria that are not independently testable as written

- **US1 Independent Test / SC-001 / SC-003** — fixtures are named but the entry point
  and ledger path are not injectable (`spec.md:54`, `spec.md:123`, `spec.md:125`;
  OPEN-04). As written the only way to test is to use the real `~/Downloads` and real
  ledger.
- **US2 AC1** — requires `mimo scope: 1` for a file in a subdirectory while FR-001
  forbids reading subdirectories (`spec.md:80-82` vs `spec.md:103`; OPEN-02). The AC
  wording is the defect; FR-001 itself is implementable without recursion.
- **US2 AC1** — exact output schema/stream is undefined (`spec.md:80-82`; OPEN-12).
  “výstup uvádí” is not a testable contract.
- **US3 AC2** — “žádný jiný stav se v ledgeru neobjeví” is false against the existing
  ledger and is not scoped to this run (`spec.md:98-99`; OPEN-16).
- **SC-005** — cannot be true for every new record if non-audio files are in scope,
  because ffprobe has no duration for them (`spec.md:127-128`; OPEN-01).
- **SC-006** — the Emacs batch invocation is not in the repo; “viz dnešní ověření” is
  not reproducible (`spec.md:129-130`; OPEN-11).
- **SC-001** — “0 duplicit” has no defined referent (`spec.md:123`; OPEN-17).
- **FR-003 / FR-009** — `:CREATED:` provenance, `KIND`, and `:PLAUD-ID:` have no
  success criterion at all, so they are obligations without an acceptance oracle
  (`spec.md:106-108`, `spec.md:115-117`; OPEN-06/08/09).
- **FR-005** — tested only through the `WAIVED` case (SC-004); no criterion covers
  `INGEST`/`REJECT`/`IGNORE` or non-record bytes (`spec.md:110`, `spec.md:126`).
- **FR-010 vs SC-008** — the two cannot both pass for one record (`spec.md:118-119`,
  `spec.md:132-133`; OPEN-15).
- **User-story independence** — P2 (report) and P3 (no-overwrite) are verification
  slices of P1 rather than independently valuable MVPs; P2's independent test needs
  P1 to have created data (`spec.md:75-82`). This is weaker than the template's
  “each story independently testable” requirement but is not fatal if acknowledged.

### 4.4 Coverage gaps and internal conflicts worth naming

- The capability table's C2 AC (`~/org/projects/plaud-pipeline.org:249`) and the spec
  agree on flat scan, hash dedupe, `TODO`-only, and empty synopsis, but the capability
  table says the record is “nedecidovatelný, dokud je prázdná”; the spec never turns
  “not decidable” into a check.
- The actual ledger still carries the superseded `:DECISION:` drawer; the spec does
  not say whether new records may omit it (OPEN-14).
- The spec requires a “Run report” entity but no FR defines its fields, format, or
  failure semantics (OPEN-12/13).
- `:PLAUD-ID:` failure is described as non-fatal, but it has no success criterion and
  no backfill rule (OPEN-09/10/18).
- `:BITRATE:`, `:FILESIZE:` and `:CLEANUP:` appear in FR-003 / Key Entities
  (`spec.md:106-108,138`) but not in the v2 template cited as the contract
  (`ingest-spec.org:57-76`); this is the M1/OPEN-19 authority conflict and it changes
  the shape of every new record.
- No requirement covers `:CREATED:` timezone or `mtime` precision (OPEN-06).

## 5. What I would build first

I would build slice 0 as the smallest *acceptable* proof, not the smallest possible
slice: a fixture plus a pre-seeded ledger, a flat read-only enumeration and deterministic
content hash, and one appended `TODO` subtree in the record shape to be fixed by
OPEN-19/M1 — `HASH`, `SOURCE` and `FILESIZE` populated, every still-undecided field
present but empty. The same slice asserts three invariants at once, as constitution I
requires before code: pre-existing bytes unchanged, second run adds zero, nested files
are never registered. Fixing OPEN-06/07/08 later should fill empty fields without
rewriting the shape or the tests. I would not start with the report format or the Plaud
join; the first executable truth is “existing ledger untouched, N new `TODO` records
appended, second run 0 new.”

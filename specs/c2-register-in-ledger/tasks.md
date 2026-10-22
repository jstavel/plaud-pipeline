# Tasks: C2 — Register in Ledger

**Input**: Design documents from `specs/c2-register-in-ledger/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Tests**: Mandatory. Constitution I requires every acceptance criterion to have a
failing test before implementation. The test tasks below are therefore part of the
work, not optional hardening.

**Organization**: Tasks are grouped by user story. US1 is the MVP; US2 and US3 are
separate slices that become testable after US1's registration path exists.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: `[US1]`, `[US2]`, `[US3]`; omitted in Setup, Foundational and Polish
- Every task includes an exact file path

## Path Conventions

Single project at repository root: `src/`, `tests/`, `specs/c2-register-in-ledger/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Initialize the TypeScript CLI project and test runner.

- [ ] T001 Create `package.json` with Node 24 engines, ESM, `zod`/`luxon` runtime dependencies, `typescript`/`vitest`/`@types/*` dev dependencies, and scripts `build`, `test`, `test:emacs` in `package.json`
- [ ] T002 [P] Create strict ESM TypeScript configuration in `tsconfig.json`
- [ ] T003 [P] Configure Vitest for unit, contract and integration suites in `vitest.config.ts`
- [ ] T004 [P] Add `coverage/` and fixture temp output to `.gitignore`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared domain types, fixtures and the single org-aware ledger boundary
that every user story depends on.

**⚠️ CRITICAL**: No user story implementation starts until this phase is complete.

- [ ] T005 [P] Define `SourceItem`, `FileMetadata`, `PlaudRecording`, `LedgerEntry`, `OutOfScopeItem`, `RunReport` and `RunError` types in `src/domain/types.ts`
- [ ] T006 Define Zod schemas and inferred validators for CLI input, Plaud responses and report output in `src/domain/schemas.ts`
- [ ] T007 [P] Create deterministic fixture builder for basic/duplicate/nested/non-regular/hundred-file trees and tiny audio files in `tests/fixtures/build-fixtures.ts`
- [ ] T008 [P] Create the canonical pre-seeded ledger fixture with `#+TODO:`, a `TODO`, a `WAIVED` and a legacy `:DECISION:` entry in `tests/fixtures/ledger/existing.org`
- [ ] T009 Write failing contract tests for the entry template, empty-value whitespace, header creation, byte-prefix append and lock location in `tests/contract/ledger-entry.test.ts`
- [ ] T010 [P] Implement heading/property/`LOGBOOK` parsing in `src/ledger/parse.ts`
- [ ] T011 [P] Implement the exact v2-plus-Q1 entry serializer in `src/ledger/serialize.ts`
- [ ] T012 Implement byte-preserving append, fresh-ledger header creation and runtime-dir locking in `src/ledger/append.ts`
- [ ] T013 Implement the single public ledger boundary (`read`, `parse`, `append`) in `src/ledger/index.ts`
- [ ] T014 [P] Add shared CLI test helper for temp ledger paths and fixture invocation in `tests/helpers/run-cli.ts`
- [ ] T015 [P] Add shared temp-directory/ledger lifecycle helper in `tests/helpers/temp-ledger.ts`

**Checkpoint**: Types, fixtures and the ledger boundary are ready; user stories can start.

---

## Phase 3: User Story 1 — Registrace nového souboru (Priority: P1) 🎯 MVP

**Goal**: A run over a fixture or the real inbox creates one `TODO` entry per unseen
file, with hash identity, metadata, empty synopsis and a canonical header when the
ledger is new.

**Independent Test**: `tests/fixtures/downloads/basic` (3 audio files) → run the CLI →
3 entries with non-empty `:HASH:`, `:SOURCE:`, `:DURATION:`, `:KIND:`; `sha256` matches;
source `mtime` unchanged; fresh ledger passes the Emacs check.

### Tests for User Story 1 (mandatory, write first) ⚠️

- [ ] T016 [P] [US1] Write failing unit tests for flat scan, non-regular classification, sorting and tie-break in `tests/unit/scan.test.ts`
- [ ] T017 [P] [US1] Write failing unit tests for duration/bitrate/filesize/created formats in `tests/unit/metadata.test.ts`
- [ ] T018 [P] [US1] Write failing integration test for 3 new files in `tests/integration/register-new.test.ts`
- [ ] T019 [P] [US1] Write failing integration test for 100 distinct files in `tests/integration/register-100.test.ts`
- [ ] T020 [P] [US1] Write failing integration test for nested directories and symlink/fifo handling in `tests/integration/register-scope.test.ts`
- [ ] T021 [P] [US1] Write failing integration test for a missing/empty ledger, canonical header and Emacs pass in `tests/integration/fresh-ledger.test.ts`
- [ ] T022 [P] [US1] Commit the Emacs batch harness that reads `#+TODO:` and asserts five keywords in `tests/emacs/check-ledger.el`
- [ ] T023 [P] [US1] Write failing contract tests for the Plaud inventory adapter and `start_at` join using a fake MCP server in `tests/contract/plaud-inventory.test.ts`
- [ ] T024 [P] [US1] Write failing integration test for API unavailability leaving `:PLAUD-ID:` empty and exit 0 in `tests/integration/plaud-failure.test.ts`

### Implementation for User Story 1

- [ ] T025 [P] [US1] Implement flat `readdir` enumeration and `OutOfScopeItem` reasons in `src/register/scan.ts`
- [ ] T026 [P] [US1] Implement streamed sha256 and size capture in `src/register/fingerprint.ts`
- [ ] T027 [P] [US1] Implement `KIND` classification and filename-date extraction rules in `src/register/classify.ts`
- [ ] T028 [P] [US1] Implement `ffprobe` duration/bitrate extraction and non-audio handling in `src/metadata/ffprobe.ts`
- [ ] T029 [P] [US1] Implement filename-date and `mtime`-fallback creation date in `src/metadata/created.ts`
- [ ] T030 [P] [US1] Implement CLI option/path resolution and defaults in `src/config.ts`
- [ ] T031 [P] [US1] Implement the MCP stdio JSON-RPC client and `--no-plaud` bypass in `src/plaud/client.ts`
- [ ] T032 [US1] Implement paged `list_files` retrieval, throttling/backoff and `start_at` join in `src/plaud/inventory.ts`
- [ ] T033 [US1] Implement the registration use case: scan → dedupe → enrich → append → result in `src/register/run.ts`
- [ ] T034 [US1] Wire the `register` command, defaults and `--no-plaud` in `src/cli.ts`

**Checkpoint**: US1 is independently functional and testable; fresh and existing ledgers work.

---

## Phase 4: User Story 2 — Běh je viditelný (Priority: P2)

**Goal**: A completed run reports new, duplicate and out-of-scope counts with paths,
plus per-file errors, in the exact human labels and an optional JSON schema.

**Independent Test**: A fixture with 2 new, 1 duplicate and 1 directory prints
`nové: 2`, `duplicity: 1`, `mimo scope: 1`, exits 0; `--json` validates against the
report contract.

### Tests for User Story 2 (mandatory, write first) ⚠️

- [ ] T035 [P] [US2] Write failing contract tests for exact human labels and path sections in `tests/contract/report-human.test.ts`
- [ ] T036 [P] [US2] Write failing contract tests for JSON report shape, counts equality and reasons in `tests/contract/report-json.test.ts`
- [ ] T037 [P] [US2] Write failing integration test for mixed new/duplicate/out-of-scope counts in `tests/integration/report-counts.test.ts`
- [ ] T038 [P] [US2] Write failing integration test for per-file errors and exit 0 in `tests/integration/report-errors.test.ts`

### Implementation for User Story 2

- [ ] T039 [P] [US2] Implement exact human report rendering in `src/report/human.ts`
- [ ] T040 [P] [US2] Implement the JSON report object and schema validation in `src/report/json.ts`
- [ ] T041 [US2] Implement report assembly from the run result in `src/report/build.ts`
- [ ] T042 [US2] Wire `--json`, stdout/stderr channels and exit codes in `src/cli.ts`
- [ ] T043 [US2] Add per-file error capture and stable reason text in `src/register/run.ts`

**Checkpoint**: US1 and US2 both work; a human and a machine can read the same run.

---

## Phase 5: User Story 3 — Stroj nerozhoduje (Priority: P3)

**Goal**: C2 only creates `TODO` entries and never rewrites, moves or transitions an
existing record; duplicate detection includes every state.

**Independent Test**: A ledger with a `WAIVED` entry → run registration → that entry is
byte-identical; all new entries are `TODO`; no `:DECISION:` drawer appears; a top-level
file matching the `WAIVED` hash adds zero records.

### Tests for User Story 3 (mandatory, write first) ⚠️

- [ ] T044 [P] [US3] Write failing integration test for byte-identical existing records, including `WAIVED`, in `tests/integration/no-rewrite.test.ts`
- [ ] T045 [P] [US3] Write failing integration test asserting all new headings are `TODO` and no `:DECISION:` drawer is written in `tests/integration/state-guard.test.ts`
- [ ] T046 [P] [US3] Write failing integration test for duplicate suppression against a `WAIVED` hash in `tests/integration/dedupe-any-state.test.ts`

### Implementation for User Story 3

- [ ] T047 [P] [US3] Add the `TODO`-only guard and byte-prefix assertion to `src/ledger/append.ts`
- [ ] T048 [P] [US3] Add all-state hash extraction to the duplicate set in `src/ledger/parse.ts`
- [ ] T049 [US3] Add no-transition and no-rewrite guards to the registration path in `src/register/run.ts`

**Checkpoint**: All three stories are independently functional; the ledger is append-only.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Contract closure, documentation and end-to-end validation.

- [ ] T050 [P] Update `~/org/projects/ingest-spec.org` v2 template with `:BITRATE:`, `:FILESIZE:`, `:CLEANUP:` and the `archive`/`other-file` KIND values (R15 owned task)
- [ ] T051 [P] Add the ADR 0012 tool declaration and capability block in `README.md`
- [ ] T052 [P] Add a 1,163-file performance smoke test with streamed hashing and bounded memory in `tests/integration/perf-1163.test.ts`
- [ ] T053 Execute the `quickstart.md` scenarios end to end and correct any command or expectation drift in `quickstart.md`
- [ ] T054 Run `npm test` and `npm run test:emacs`; fix any remaining contract/integration failures and record the final result in `quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: starts immediately.
- **Foundational (Phase 2)**: depends on Setup; blocks all user stories.
- **US1 (Phase 3)**: depends on Foundational; MVP.
- **US2 (Phase 4)**: depends on US1.
- **US3 (Phase 5)**: depends on US1; may run alongside US2, but both touch `src/register/run.ts`, so coordinate that file.
- **Polish (Phase 6)**: depends on the desired stories; T050 can start earlier but is not complete until R15 is reviewed.

### User Story Dependencies

- **US1** is self-contained after Foundational and is the MVP.
- **US2** needs US1's run result and CLI; it does not change ledger semantics.
- **US3** needs US1's write path; it adds guards and all-state dedupe tests.

### Within Each User Story

- Tests are written and must fail before implementation.
- Parsing/serialization precedes append; append precedes the run use case.
- The run use case precedes CLI/report wiring.
- Story validation happens at each checkpoint before moving on.

### Parallel Opportunities

- T002–T004 (config files) can run in parallel.
- T005, T007, T008 and T014–T015 can run in parallel; T006 follows T005.
- T010 and T011 can run in parallel; T012/T013 follow them.
- T016–T024 (US1 tests) can run in parallel; each owns a different test file.
- T025–T031 (US1 leaf implementations) can run in parallel; T032 follows T031.
- T035–T038 (US2 tests) can run in parallel; T039/T040 can run in parallel.
- T044–T046 (US3 tests) can run in parallel; T047/T048 can run in parallel.
- T050–T052 (contract/docs/perf) can run in parallel.

---

## Parallel Example: User Story 1

```text
Task: "Write failing unit tests for scan in tests/unit/scan.test.ts"
Task: "Write failing unit tests for metadata in tests/unit/metadata.test.ts"
Task: "Write failing integration test for 3 new files in tests/integration/register-new.test.ts"
Task: "Write failing integration test for 100 files in tests/integration/register-100.test.ts"
Task: "Write failing integration test for scope in tests/integration/register-scope.test.ts"
Task: "Commit the Emacs batch harness in tests/emacs/check-ledger.el"
```

## Parallel Example: User Story 2

```text
Task: "Write failing human report contract tests in tests/contract/report-human.test.ts"
Task: "Write failing JSON report contract tests in tests/contract/report-json.test.ts"
Task: "Write failing count integration test in tests/integration/report-counts.test.ts"
Task: "Write failing error integration test in tests/integration/report-errors.test.ts"
```

## Parallel Example: User Story 3

```text
Task: "Write failing no-rewrite test in tests/integration/no-rewrite.test.ts"
Task: "Write failing state-guard test in tests/integration/state-guard.test.ts"
Task: "Write failing all-state dedupe test in tests/integration/dedupe-any-state.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 and Phase 2.
2. Complete Phase 3 (US1).
3. Run the US1 independent test and the Emacs check; stop and validate.
4. Do not start US2/US3 until the MVP path is green.

### Incremental Delivery

1. Foundation + US1 → a working registration command (MVP).
2. US2 → human/JSON visibility without changing ledger semantics.
3. US3 → explicit invariants and cross-state dedupe.
4. Polish → external contract closure, docs, performance and full quickstart run.

### Notes

- Do not implement a task before its test exists and fails.
- T050 is an owned task even though it edits `~/org/projects/ingest-spec.org` outside this repo.
- Keep `src/ledger/` as the only org-aware area; other tasks must not parse or write org text.
- A second run over the same state must always produce `nové: 0`.

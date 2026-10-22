# Implementation Plan: C2 — Register in Ledger

**Branch**: `main` (no feature branch exists; plan artifacts are currently untracked on `main`) | **Date**: 2026-10-21 | **Spec**: `specs/c2-register-in-ledger/spec.md`

**Input**: Feature specification from `specs/c2-register-in-ledger/spec.md`

## Summary

Build a single TypeScript CLI command, `register`, that reads the immediate children
of `~/Downloads`, streams a sha256 for each regular file, and appends one org subtree
per unseen hash to `~/org/ingest-ledger.org`. New subtrees carry all ten properties
agreed in clarify round 1 (including `:BITRATE:`, `:FILESIZE:` and `:CLEANUP:`),
remain in `TODO`, and never modify existing ledger bytes or source files. Metadata
comes from `ffprobe`; `:CREATED:` comes from a filename date with `mtime` fallback;
`:PLAUD-ID:` is filled only from one optional Plaud inventory fetch joined on
`start_at`. A missing or empty ledger is initialised with the canonical `#+TODO:`
header before the first entry. The command reports new, duplicate, out-of-scope and
error items and is idempotent on a second run.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 24 LTS (verified locally: v24.13.1),
ES modules, `strict` compiler settings.

**Primary Dependencies**: `zod` for boundary and contract validation; `luxon` for
`Europe/Prague` date/time conversion. Runtime dependencies are intentionally small.
Node built-ins cover filesystem, crypto, child processes and CLI parsing.

**Storage**: Filesystem only. Source of truth is the org ledger
(`~/org/ingest-ledger.org`) and the read-only inbox (`~/Downloads`). No database and
no `state.json` in C2; registration state is derived from the ledger.

**Testing**: Vitest for unit, contract and integration tests; fixture filesystem
trees; a test-only Emacs batch script for the org validity criterion. Tests are
written before the code they exercise, per constitution I.

**Target Platform**: Linux CLI (Fedora), Node.js 24 LTS, local filesystem.

**Project Type**: Single-project CLI.

**Performance Goals**: A 1,163-file run completes in under 5 minutes on a local SSD;
hashing is streamed; resident memory stays below 256 MB; Plaud access costs one paged
inventory fetch per run, not one call per file.

**Constraints**: Non-recursive scan only; append-only ledger writes; `~/Downloads` is
read-only; no running Emacs at runtime; all org parsing/serialization lives in one
module; all network access goes through one throttled/backoff adapter; all external
data is validated with Zod. The v2 template in `~/org/projects/ingest-spec.org` still
needs the Q1 extension (`:BITRATE:`, `:FILESIZE:`, `:CLEANUP:`) and the `KIND`
vocabulary extension (`archive`, `other-file`) before implementation is considered
contract-complete.

**Scale/Scope**: 1,163+ files in the real inbox, 171+ existing ledger entries, and a
ledger that grows by one subtree per new file. One run is expected to add up to
roughly 1,200 entries in the limit case.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle / constraint | Gate | Design response | Status |
|---|---|---|---|
| I. Tests before implementation (NON-NEGOTIABLE) | Every AC has a failing test before code, with a real oracle. | Contract tests for the ledger entry and report schemas; integration fixtures for 0/1/100 files, duplicates, nested directories and WAIVED records; Emacs batch test for org validity. No test asserts only that “something happened”. | PASS |
| II. Append-only toward foreign data | Never rewrite a ledger entry; never modify/delete Downloads. | The ledger module exposes only `read`, `parse` and `append`; append uses `O_APPEND` and preserves the existing byte prefix. A missing or empty ledger is created with the canonical `#+TODO:` header before appending. Registration writes only `TODO` and never transitions state. Downloads is opened read-only for scan/hash/metadata. | PASS |
| III. Deterministic and idempotent | Same input → same output; identity is content hash; no recursion. | Streamed sha256; byte-wise path sort for tie-breaks; fixed metadata and date formats; no directory recursion; second run derives all hashes from the ledger and adds zero. | PASS |
| Technical: TypeScript, Node LTS, Zod | Contracts are typed and validated. | TypeScript strict mode; Zod schemas at CLI, ledger and Plaud boundaries. | PASS |
| Technical: one org module | Rest of repo does not know org format. | `src/ledger/` is the only org-aware code; all other modules use typed domain objects. | PASS |
| Technical: no running Emacs | Ledger readable/writable without Emacs. | Emacs is used only by the test harness. Runtime uses the project parser/serializer. | PASS |
| Technical: one network layer | Throttle + backoff around every external call. | A single Plaud inventory adapter with 1 req/s, timeout, exponential backoff and five attempts. | PASS |

No violations. Complexity Tracking is intentionally empty.

**Post-design re-check**: PASS. The Phase 1 data model and contracts keep the org
format inside `src/ledger/`, keep the append-only boundary explicit, and make every
Plaud call optional and non-fatal.

## Project Structure

### Documentation (this feature)

```text
specs/c2-register-in-ledger/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── cli.md
│   ├── ledger-entry.md
│   ├── plaud-inventory.md
│   └── run-report.md
└── tasks.md              # created later by /speckit.tasks
```

### Source Code (repository root)

```text
src/
├── cli.ts                 # argument parsing, exit codes, composition root
├── config.ts              # resolved paths and runtime options
├── domain/
│   ├── types.ts           # typed domain entities
│   └── schemas.ts         # Zod validation at boundaries
├── register/
│   ├── run.ts             # registration use case
│   ├── scan.ts            # flat, non-recursive enumeration
│   ├── fingerprint.ts     # streamed sha256 and size
│   └── classify.ts        # KIND and creation-date rules
├── ledger/
│   ├── index.ts           # the only org-aware public boundary
│   ├── parse.ts           # headings, property drawers, hashes
│   ├── serialize.ts       # exact entry template
│   └── append.ts          # byte-preserving append and lock
├── metadata/
│   ├── ffprobe.ts         # duration and bitrate
│   └── created.ts         # filename date → mtime fallback
├── plaud/
│   ├── client.ts          # JSON-RPC/process boundary
│   └── inventory.ts       # start_at join and failure degradation
└── report/
    ├── build.ts           # report assembly from run result
    ├── human.ts           # exact Czech labels
    └── json.ts            # machine report

tests/
├── unit/
├── contract/
├── integration/
├── fixtures/
└── emacs/
    └── check-ledger.el
```

**Structure Decision**: Single-project CLI. `src/ledger/` is deliberately the only
org-aware area; `register/`, `metadata/`, `plaud/` and `report/` exchange typed domain
objects and never manipulate org text. Tests are split by oracle type: contract tests
pin formats, integration tests pin filesystem behavior, and the Emacs harness pins
external org validity.

Package scripts: `build` (tsc), `test` (vitest), `test:emacs` (Emacs batch harness).

## Implementation Strategy

Phase A establishes the failing contract and integration tests against fixtures and
a pre-seeded ledger. Phase B implements the ledger reader/serializer/append boundary.
Phase C adds the flat scan, streaming hash, classification and ffprobe metadata.
Phase D adds the optional Plaud inventory adapter and `start_at` join. Phase E wires
the CLI and report, then runs the full fixture suite plus the Emacs batch check.
The order is forced by constitution I: no production path is added before its oracle
exists. R15 (extend the external `ingest-spec.org` v2 template and `KIND` vocabulary)
is an owned task for `/speckit.tasks`, not a note; it edits a file outside this repo
but is part of C2's definition of done.

## Complexity Tracking

No constitution violations; no exceptions requested.

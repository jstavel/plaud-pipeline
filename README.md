# plaud-pipeline

[![CI](https://github.com/jstavel/plaud-pipeline/actions/workflows/ci.yml/badge.svg)](https://github.com/jstavel/plaud-pipeline/actions/workflows/ci.yml)

A small but opinionated pipeline that turns a growing pile of voice-recorder
files (Plaud recordings in `~/Downloads`) into an organized, searchable
knowledge base: an **append-only Org-mode ledger**, from which files are
later triaged, transcribed and ingested into a corpus.

The workflow is **capture → ledger → transcribe → decide → ingest → publish**.
It is built around one principle: *one workflow, many tools* (ADR 0012).
Each step is a **capability** with its own specification, contracts and tests,
independent of the tool that implements it — so a capability can be swapped,
scripted, or done by a human in Emacs without breaking the rest.

## What it is / what it is not

- It is a personal knowledge-management pipeline (GTD "inbox processing"
  applied to audio recordings), built in the open.
- It is **not** a product. Paths default to the author's machine
  (`~/Downloads`, `~/org/ingest-ledger.org`); everything is configurable
  and the test suite runs entirely on fixture filesystems.

## Capabilities (ADR 0012)

| Capability | Tool | Status |
|---|---|---|
| C1 — Inventory of Plaud recordings | (future) | not started |
| C2 — Register in Ledger | `plaud-pipeline register` (this repo, TypeScript/Node) | v1 |
| C3 — Transcribe | (future) | not started |
| C4 — Rewrite/decide | human + Emacs | manual |
| C5 — Ingest to corpus | (future) | not started |
| C6 — Publish | (future) | not started |

## Capability C2 — Register in Ledger

Every regular top-level file in `~/Downloads` that has no record in
`~/org/ingest-ledger.org` yet gets one org subtree: state `TODO`, content-hash
identity, technical metadata, empty `:SYNOPSIS:` (C4 fills it), no
`:DECISION:` drawer (ADR 0011). The scan is flat (ADR 0013), the ledger is
append-only (constitution II), identity is the sha256 of the content
(constitution III). `:PLAUD-ID:` is filled only from the Plaud inventory
joined on `start_at` — never guessed from names; an API outage degrades to an
empty field, not a failed run.

## How it works (invariants)

These rules are tested, not just declared:

- **Append-only ledger** — a run never modifies existing ledger bytes; new
  entries are appended under a file lock.
- **Content-hash identity** — a file is "registered" if its sha256 is in the
  ledger, regardless of file name, location, or what happened to the ledger
  in between; duplicates are detected across any state.
- **Idempotent** — running `register` twice yields no new entries and no
  byte changes.
- **Graceful degradation** — when the Plaud inventory API is unavailable,
  the run succeeds with `:PLAUD-ID:` left empty instead of failing.
- **Spec is the source of truth** — features start as a specification with
  clarifications, contracts are pinned in `specs/*/contracts/`, and the
  ledger output format is verified byte-exactly against a verbatim sample,
  in a real Emacs batch check (`npm run test:emacs`).

## Development

```bash
npm install
npm run build
node dist/cli.js register --help
npm test && npm run test:emacs
```

Stack: TypeScript (strict) on Node 24, minimal runtime dependencies
(`zod`, `luxon`), filesystem as storage, Vitest for unit / contract /
integration tests. CI (GitHub Actions) runs build, the full test suite
and the Emacs validity check on every push and pull request.

Project conventions live in `.specify/memory/constitution.md`
(test-first, frozen specifications, append-only artifacts) and each
capability directory under `specs/` follows the same shape:
`spec.md → plan.md → tasks.md → contracts/ → readback.md`.

See `specs/c2-register-in-ledger/quickstart.md` for the validation scenarios
and `specs/c2-register-in-ledger/contracts/` for the CLI, ledger-entry, report
and inventory contracts. The real run (`node dist/cli.js register` with
defaults) touches the real inbox and ledger and belongs after review only.

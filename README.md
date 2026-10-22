# plaud-pipeline

Pipeline for the Plaud capture → corpus workflow. One workflow, many tools
(ADR 0012); work is organized by capability (`specs/<capability>/`), not by
tool.

## Tool declaration (ADR 0012)

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

```bash
npm install
npm run build
node dist/cli.js register --help
npm test && npm run test:emacs
```

See `specs/c2-register-in-ledger/quickstart.md` for the validation scenarios
and `specs/c2-register-in-ledger/contracts/` for the CLI, ledger-entry, report
and inventory contracts. The real run (`node dist/cli.js register` with
defaults) touches the real inbox and ledger and belongs after review only.

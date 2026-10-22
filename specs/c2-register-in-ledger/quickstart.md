# Quickstart — C2 Register in Ledger

> These commands become executable only after Phase E (fixtures and `dist/` exist).
> Until then they are validation targets, not evidence. Re-verify by execution.

## Prerequisites

- Node.js 24 LTS and npm.
- `ffprobe` on `PATH` (verified locally: ffmpeg 8.0.1).
- Emacs only for the org-validity test (test-only dependency).
- Plaud auth only for the optional `:PLAUD-ID:` join; the command must work with
  `--no-plaud`.

## Install and build

```bash
npm install
npm run build
```

## Run the automated checks

```bash
npm test
npm run test:emacs
```

`npm test` covers the contract, unit and fixture integration suites. `test:emacs` runs
the batch org check required by SC-006.

## Validate on a fixture

Use committed fixtures; never point a validation run at the real inbox.

```bash
rm -f /tmp/c2-ledger.org
node dist/cli.js register \
  --downloads tests/fixtures/downloads/basic \
  --ledger /tmp/c2-ledger.org \
  --no-plaud
```

Expected human output includes:

```text
nové: 3
duplicity: 0
mimo scope: 0
chyby: 0
```

Because the ledger was removed first, `/tmp/c2-ledger.org` must start with the
canonical `#+TODO:` header and still pass the Emacs check below.

Run the same command again and expect `nové: 0`; the ledger bytes must not change.

Check org validity:

```bash
emacs --batch -Q -l tests/emacs/check-ledger.el -- /tmp/c2-ledger.org
```

## Validate the required scenarios

| Scenario | Fixture / command | Expected |
|---|---|---|
| New files | `tests/fixtures/downloads/basic` (3 files) | 3 new `TODO` entries; hashes match `sha256sum`; `mtime` unchanged. |
| Idempotent second run | repeat the same command | `nové: 0`; ledger bytes unchanged. |
| Duplicate | `tests/fixtures/downloads/duplicates` | 1 new, 1 duplicate. |
| Nested directory | `tests/fixtures/downloads/nested` | 0 new; directory counted as `mimo scope: 1`; contents never read. |
| Non-regular entry | `tests/fixtures/downloads/non-regular` (symlink/fifo) | 0 new; entry counted as `mimo scope: 1` with reason `symlink`/`fifo`; target never read. |
| WAIVED entry | `tests/fixtures/ledger/waived.org` | existing entry byte-identical; new entry is `TODO`. |
| Missing synopsis | any new entry | `:SYNOPSIS:` present and empty; test treats it as valid. |
| API unavailable | `--no-plaud`, or fake server failure | entries written with empty `:PLAUD-ID:`; exit 0. |
| Report JSON | add `--json` | one JSON object validates against `contracts/run-report.md`. |

## Contracts and model

- `contracts/cli.md` — command surface, defaults, exit codes.
- `contracts/ledger-entry.md` — exact org template and append protocol.
- `contracts/run-report.md` — human and JSON report.
- `contracts/plaud-inventory.md` — optional inventory adapter and join.
- `data-model.md` — typed entities and validation rules.

## Real run (after review only)

```bash
node dist/cli.js register
```

This reads the real `~/Downloads` and appends to `~/org/ingest-ledger.org`. It is not
part of the automated test suite and must not be used to make a test pass.

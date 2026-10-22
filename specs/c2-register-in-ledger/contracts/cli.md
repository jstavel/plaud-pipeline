# Contract: `plaud-pipeline register` CLI

## Synopsis

```text
plaud-pipeline register [options]
```

## Options

| Option | Default | Meaning |
|---|---|---|
| `--downloads <dir>` | `~/Downloads` | Scan root. Only immediate children are considered. Must exist and be readable. |
| `--ledger <file>` | `~/org/ingest-ledger.org` | Append target. Parent directory is created if missing. |
| `--json` | off | Print one JSON report to stdout; human logs go to stderr. |
| `--no-plaud` | off | Skip the Plaud inventory fetch; `:PLAUD-ID:` stays empty. |
| `--help` | — | Print usage and exit 0. |

No option may cause a write to `~/Downloads`.

## Behavior

1. Resolve and validate paths.
2. Read the ledger and build the known-hash set before scanning.
3. Enumerate immediate children of the scan root. Regular files are candidates;
   directories are `mimo scope` items and are never entered.
4. Sort candidates by basename (code-unit order), hash each file, classify it, and
   read metadata.
5. Fetch Plaud inventory once unless `--no-plaud` or the adapter is unavailable.
6. Append one entry per unseen hash, in sorted order, then remove the lock.
7. Emit the report.

## Output channels

- Default: human report on stdout; warnings/errors also appear in the report.
- `--json`: exactly one JSON object on stdout; diagnostics on stderr.
- No progress bars or interactive prompts.

## Exit codes

| Code | Meaning |
|---|---|
| `0` | Run completed. Per-file errors may be present and are reported. |
| `2` | Fatal usage, config, scan-root, ledger, lock, or append error. |
| `1` | Unexpected crash (bug). |

## Examples

```bash
plaud-pipeline register
plaud-pipeline register --downloads /tmp/fixture/downloads --ledger /tmp/fixture/ledger.org
plaud-pipeline register --json --no-plaud
```

## Test contract

Tests must be able to run every scenario without touching the real inbox or ledger by
passing both paths explicitly. `--no-plaud` must remove all network/process access and
leave `:PLAUD-ID:` empty.

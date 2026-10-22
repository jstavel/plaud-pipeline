# Contract: Run report

## Human output (default)

The first four lines must use these exact labels, in this order:

```text
nové: 2
duplicity: 1
mimo scope: 1
chyby: 0
```

After a blank line, print only non-empty path sections:

```text
nové cesty:
- /home/jstavel/Downloads/a.mp3
- /home/jstavel/Downloads/b.mp3

duplicity:
- /home/jstavel/Downloads/c.mp3

mimo scope:
- /home/jstavel/Downloads/zaloha/

chyby:
- /home/jstavel/Downloads/broken.mp3: ffprobe failed
```

A zero count still prints the label and `0`; the corresponding path section is
omitted. Paths are sorted by code-unit order. The human report goes to stdout unless
`--json` is set, in which case it goes to stderr.

## JSON output (`--json`)

One object on stdout:

```json
{
  "counts": {
    "new": 2,
    "duplicates": 1,
    "outOfScope": 1,
    "errors": 0
  },
  "new": [
    { "path": "/home/jstavel/Downloads/a.mp3", "hash": "…64 hex…" }
  ],
  "duplicates": [
    {
      "path": "/home/jstavel/Downloads/c.mp3",
      "hash": "…64 hex…",
      "existingSource": "/home/jstavel/Downloads/old-c.mp3"
    }
  ],
  "outOfScope": [
    { "path": "/home/jstavel/Downloads/zaloha/", "reason": "directory" }
  ],
  "errors": [
    {
      "path": "/home/jstavel/Downloads/broken.mp3",
      "phase": "ffprobe",
      "reason": "no audio stream and duration unavailable"
    }
  ]
}
```

### Schema rules

- `counts.new === new.length`; the same equality holds for the other categories.
- Every array is sorted by `path`.
- `hash` is 64 lowercase hex.
- `phase` is one of `scan`, `hash`, `stat`, `ffprobe`, `plaud`, `append`.
- `outOfScope.reason` is one of `directory`, `symlink`, `fifo`, `socket`,
  `other-non-regular`. Every non-regular top-level entry appears here; nothing is
  silently omitted.
- `existingSource` is present only when the duplicate's matching ledger record has a
  `:SOURCE:` value.
- Plaud unavailability is a single entry in `errors` with
  `path: "plaud-inventory"`, `phase: "plaud"`; it does not make the exit code non-zero.
- `--no-plaud` produces no Plaud error entry.

## Exit codes

| Code | Meaning |
|---|---|
| `0` | Completed, including runs with per-file errors. |
| `2` | Fatal usage/config/scan-root/ledger/lock/append error. |
| `1` | Unexpected crash. |

## Test contract

- A run with 2 new, 1 duplicate and 1 directory must print exactly
  `nové: 2`, `duplicity: 1`, `mimo scope: 1` and exit 0.
- A top-level symlink/fifo/socket must appear in `outOfScope` with its reason, not
  disappear from all four counts.
- A second run over the same fixture must print `nové: 0`.
- `--json` output must validate against the schema above and contain no prose.

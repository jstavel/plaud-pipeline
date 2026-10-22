# Phase 1 Data Model — C2 Register in Ledger

This model is the implementation contract for typed objects exchanged inside the
pipeline. Org text never crosses the `src/ledger/` boundary except as a serialized
string produced there.

## SourceItem

Represents one immediate child of the scan root.

| Field | Type | Required | Rule |
|---|---|---|---|
| `path` | absolute string | yes | Immediate child of the scan root; no recursion. |
| `basename` | string | yes | `basename(path)`; must not contain newline or other control characters. |
| `hash` | 64-char lowercase hex | yes | Streamed sha256 of file content. |
| `sizeBytes` | non-negative integer | yes | `stat.size` at scan time. |
| `kind` | enum | yes | `Plaud-voice-record`, `audio-file`, `archive`, `other-file`. |
| `created` | `YYYY-MM-DD` | yes | Filename date or `mtime` date in `Europe/Prague`. |
| `createdSource` | enum | yes | `filename` or `mtime`; controls the LOGBOOK suffix. |
| `durationSeconds` | number or null | yes | Null when no audio stream or ffprobe unavailable for non-audio. |
| `durationText` | `MM:SS` or empty | yes | Derived from `durationSeconds` by floor. |
| `bitrateText` | `Nk` or empty | yes | Derived from ffprobe `stream=bit_rate`. |
| `plaudId` | string or empty | yes | Empty when no unambiguous `start_at` join. |

Validation: a `SourceItem` is eligible for a record only if `hash` is valid, `path`
is absolute, `basename` is representable in an org headline/property value, and the
file still exists and matches the hashed content when the record is appended. The
pre-append re-stat/re-hash is performed only for candidates selected for writing, not
for every scanned file. A file that changes during the run is an error, not a record.

## OutOfScopeItem

Represents a top-level entry that C2 deliberately does not register.

| Field | Type | Rule |
|---|---|---|
| `path` | absolute string | Immediate child of the scan root. |
| `reason` | enum | `directory`, `symlink`, `fifo`, `socket`, `other-non-regular`. |

The contents of a directory and the target of a symlink are never read. A non-regular
entry is never silently omitted from the report; `counts.outOfScope` includes it.

## FileMetadata

| Field | Type | Rule |
|---|---|---|
| `durationSeconds` | number \| null | From `ffprobe format=duration`; null if no audio. |
| `bitrateBps` | integer \| null | From `ffprobe stream=bit_rate`; null if unavailable. |
| `sizeBytes` | integer | From `stat`. |
| `kind` | enum | Filename/extension rule from research R7. |

Non-audio files may have `durationSeconds = null` and `bitrateBps = null`; that is a
valid state, not an error.

## PlaudRecording

Normalized subset of one `list_files` result.

| Field | Type | Rule |
|---|---|---|
| `id` | string | Plaud file id, e.g. `of_…`. |
| `startAtUtc` | ISO-8601 instant | API `start_at`; measured as UTC. |
| `localStartKey` | `YYYY-MM-DD HH_mm_ss` | `startAtUtc` converted to `Europe/Prague`. |
| `name` | string | API display name; never used for identity. |
| `durationMs` | integer \| null | Optional; not required by C2. |

The join key is `localStartKey` only. `name` is carried for diagnostics and must not
be used to decide identity or `:PLAUD-ID:`.

## LedgerEntry

Represents an existing or newly created org subtree.

| Field | Type | Required | Rule |
|---|---|---|---|
| `state` | enum | yes | `TODO`, `INGEST`, `REJECT`, `IGNORE`, `WAIVED`. |
| `headline` | string | yes | Raw heading text after the keyword. |
| `hash` | 64-hex or null | no | Present on all real records; null only for malformed/legacy headings. |
| `plaudId` | string | no | May be empty. |
| `created` | `YYYY-MM-DD` | no | May be empty only on legacy/malformed records. |
| `duration` | string | no | `MM:SS` or empty. |
| `bitrate` | string | no | `Nk` or empty. |
| `filesize` | string | no | Decimal bytes. |
| `source` | absolute string | no | Absolute path. |
| `synopsis` | string | no | Empty is valid for C2-created records. |
| `cleanup` | string | no | Empty for C2-created records. |
| `kind` | enum | no | Same enum as `SourceItem.kind`. |
| `logbook` | string[] | no | Raw logbook bullet lines. |

**Identity and uniqueness**: `hash` is the only identity. At most one record in the
ledger may contain a given hash. The duplicate set is built from every valid hash in
the ledger, regardless of state or `source` (OPEN-03 deferred reading).

**State transitions in C2**: none. C2 creates only `TODO` and never calls a transition
API. Existing headings are read-only.

## RunReport

| Field | Type | Rule |
|---|---|---|
| `counts.new` | non-negative integer | Number of subtrees appended. |
| `counts.duplicates` | non-negative integer | Files skipped because their hash already exists. |
| `counts.outOfScope` | non-negative integer | Top-level directories and non-regular entries; contents/targets never read. |
| `counts.errors` | non-negative integer | Per-file failures. |
| `new` | `{path, hash}[]` | Sorted by path. |
| `duplicates` | `{path, hash, existingSource?}` | Sorted by path. |
| `outOfScope` | `{path, reason}` | Sorted by path; reason is `directory`, `symlink`, `fifo`, `socket`, or `other-non-regular`. |
| `errors` | `{path, phase, reason}` | Sorted by path; phase is `scan`, `hash`, `stat`, `ffprobe`, `plaud`, or `append`. |

Invariant: `counts.new === new.length`, and the same for the other categories.
Counts are derived from the arrays, not kept independently.

## RunError

| Field | Type | Rule |
|---|---|---|
| `path` | string | The offending file or directory. |
| `phase` | enum | `scan`, `hash`, `stat`, `ffprobe`, `plaud`, `append`. |
| `reason` | string | Stable, human-readable reason. |
| `recoverable` | boolean | True for per-file errors; false for fatal run errors. |

Recoverable errors appear in the report and do not change exit code 0. Fatal errors
are emitted as a top-level error and exit 2.

## Validation boundaries

- CLI input → Zod schema (`downloads`, `ledger`, `json`, `plaud`).
- Plaud inventory response → Zod schema before normalization.
- Ledger parse result → internal typed shape; malformed property blocks are fatal.
- Serialized entry → exact string format pinned by contract tests.
- Report → Zod schema for `--json` output and a regex/test for human labels.

## Relationships

```text
SourceItem 1 ── 0..1 PlaudRecording   (join on localStartKey)
SourceItem 1 ── 1 FileMetadata
SourceItem 1 ── 0..1 LedgerEntry      (only if hash is unseen)
OutOfScopeItem 1 ── 1 reason          (never registered)
RunReport  1 ── * SourceItem/OutOfScopeItem/RunError
```

No entity holds a mutable reference to another; the run collects plain values and
writes once.

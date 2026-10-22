# Contract: Ledger entry and append protocol

## New entry template

```org
* TODO [N min] <basename>
  :PROPERTIES:
  :HASH:       <64 lowercase hex>
  :PLAUD-ID:   <id or empty>
  :CREATED:    <YYYY-MM-DD>
  :DURATION:   <MM:SS or empty>
  :BITRATE:    <Nk or empty>
  :FILESIZE:   <decimal bytes>
  :SOURCE:     <absolute path>
  :SYNOPSIS:   
  :CLEANUP:
  :KIND:       <kind>
  :END:
  :LOGBOOK:
  - [YYYY-MM-DD Day HH:mm] Registered by C2 (created from filename|mtime).
  :END:
```

### Rules

- `[N min]` is present only when an audio duration exists. `N = ceil(seconds / 60)`.
  A duration under one minute yields `[1 min]`.
- `:HASH:` is exactly 64 lowercase hex characters.
- `:PLAUD-ID:` is either the joined API id or empty.
- `:CREATED:` is `YYYY-MM-DD`; the provenance is in the `:LOGBOOK:` line.
- `:DURATION:` is `MM:SS` with total minutes (values above 59 minutes are allowed,
  e.g. `88:12`) or empty for non-audio/unknown.
- `:BITRATE:` is truncated kilobits with a `k` suffix (e.g. `32k`) or empty.
- `:FILESIZE:` is decimal bytes.
- `:SOURCE:` is an absolute path; the value must not be wrapped or truncated.
- `:SYNOPSIS:` is present with an empty value (Q5 A).
- `:CLEANUP:` is present with an empty value.
- `:KIND:` is one of `Plaud-voice-record`, `audio-file`, `archive`, `other-file`.
- No `:DECISION:` drawer is written.
- All ten properties are always present in the order shown. Every property line
  except `:CLEANUP:` is padded so the value—or, for an empty value, the end of
  line—begins at column 16, counted 1-based on the full line including the
  two-space drawer indent (0-based byte index 15). Equivalently: the prefix
  before the value is exactly 15 characters and an empty-value line is exactly 15
  characters long; counting without the drawer indent reads column 14 — the same
  measured layout under a different numbering. Measured against the real ledger
  `~/org/ingest-ledger.org` (2026-10-22: 171 records, all ten properties, one
  layout). `:CLEANUP:` has no trailing whitespace (exactly 11 characters). The
  template above is the single source of truth for this spelling, pinned
  byte-exactly by `tests/contract/ledger-entry.test.ts` against a verbatim ledger
  sample (`tests/fixtures/ledger/verbatim-entry.org`).

## Append protocol

Input: existing ledger bytes `old` (or no file), one or more serialized entries
`newEntries`.

```text
if old is missing or empty:
    header  = "#+TODO: TODO(t) | INGEST(i@!) REJECT(r@) IGNORE(x@) WAIVED(a@)\n\n"
    payload = header + newEntries.join("\n\n") + "\n"
    result  = payload
else:
    separator = old ends with "\n" ? "\n" : "\n\n"
    payload   = separator + newEntries.join("\n\n") + "\n"
    result    = old + payload
```

- A freshly created ledger gets the canonical `#+TODO:` header verbatim; this is
  required for SC-006 and must not be supplied only by a fixture.
- `old` must be an exact byte prefix of `result` when it is non-empty.
- Entries are appended at EOF, never inserted above existing content.
- New entries are separated by one blank line. This is an intentional deviation from
  the packed existing ledger; it is org-valid and the parser ignores blank lines.
- The file is opened with `O_APPEND`. The payload is written in one call.
- The lock file is outside the tracked `~/org` tree:
  `<XDG_RUNTIME_DIR or os.tmpdir()>/plaud-pipeline-<sha256(abs ledger path)[0..16]>.lock`.
  It contains `{pid, startedAt}`. A live PID means exit 2; a missing PID or a
  `startedAt` older than one hour is stale and is removed once.
- If the write fails, the lock is removed and the original file is left untouched as
  far as the filesystem allows; a partial write is reported as fatal.

## Read/parse rules

- A heading is a line beginning with `* ` followed by a known keyword.
- Keywords: `TODO`, `INGEST`, `REJECT`, `IGNORE`, `WAIVED`.
- Property drawers are parsed between `:PROPERTIES:` and `:END:`.
- `:HASH:` is captured only when the value is exactly 64 hex characters.
- Unknown drawers and unknown properties are ignored.
- Existing headings are never rewritten, reordered or normalized.
- A malformed property drawer is a fatal ledger error; C2 does not append to a ledger
  it cannot read consistently.

## Example

```org
* TODO [5 min] 2026-10-21 08_12_17.mp3
  :PROPERTIES:
  :HASH:       a514cb6aa759992495a06dd976d5aaffecbba6fbe06c8a71cfe960c0ddaf906c
  :PLAUD-ID:   of_cf3261befc393405271a1a99f7062525
  :CREATED:    2026-10-21
  :DURATION:   04:30
  :BITRATE:    32k
  :FILESIZE:   1633472
  :SOURCE:     /home/jstavel/Downloads/2026-10-21 08_12_17.mp3
  :SYNOPSIS:   
  :CLEANUP:
  :KIND:       Plaud-voice-record
  :END:
  :LOGBOOK:
  - [2026-10-21 Wed 18:45] Registered by C2 (created from filename).
  :END:
```

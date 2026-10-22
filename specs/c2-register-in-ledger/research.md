# Phase 0 Research — C2 Register in Ledger

All decisions below resolve the plan-level items deferred by `spec.md` and the
technical unknowns in `plan.md`. The spec's deferred intended readings are treated as
inputs, not re-opened.

## R1 — Runtime and dependency set

**Decision**: Node.js 24 LTS, TypeScript 5.x, ESM, strict mode. Runtime dependencies:
`zod` and `luxon`. Development: `vitest`, `typescript`, `@types/node`, `@types/luxon`.
Use Node built-ins for filesystem, crypto, child processes and `util.parseArgs`.

**Rationale**: Matches the constitution (TypeScript, Node LTS, Zod) and the verified
local runtime (`node v24.13.1`). `luxon` is needed for reliable `Europe/Prague`
conversion across DST; Node 24 has no stable `Temporal`. Keeping the dependency set
small limits supply-chain and upgrade surface.

**Alternatives considered**: `date-fns-tz` (viable, but more packages for the same
job); `Temporal` polyfill (extra dependency for one conversion); a CLI framework
(unnecessary for one subcommand); `execa` (Node `child_process.execFile` is enough).

## R2 — Test injection and CLI shape

**Decision**: One binary, `plaud-pipeline`, with a `register` subcommand. Options:
`--downloads <dir>` (default `~/Downloads`), `--ledger <file>` (default
`~/org/ingest-ledger.org`), `--json`, `--no-plaud`, `--help`. Tests always pass
explicit fixture paths; no test touches the real inbox or ledger.

**Rationale**: The spec's independent tests require a fixture directory, but the scope
names fixed paths. Explicit options with production defaults satisfy both without
mutating `HOME`. `--no-plaud` makes offline tests deterministic.

**Alternatives considered**: `HOME`/XDG overrides (implicit and easy to leak into the
real environment); copying fixtures into `~/Downloads` (violates the read-only spirit
and is not isolated).

## R3 — Org serialization and append protocol

**Decision**: New entries use the v2 shape extended by Q1:

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
  :KIND:       <Plaud-voice-record|audio-file|archive|other-file>
  :END:
  :LOGBOOK:
  - [YYYY-MM-DD Day HH:mm] Registered by C2 (created from filename|mtime).
  :END:
```

`[N min]` is `ceil(duration seconds / 60)` when an audio duration exists; otherwise
the bracket is omitted. No `:DECISION:` drawer is written (ADR 0011 + append-only).

Append protocol:
- If the ledger is missing or empty, write the canonical header verbatim
  (`#+TODO: TODO(t) | INGEST(i@!) REJECT(r@) IGNORE(x@) WAIVED(a@)`) followed by
  one blank line, then the serialized entries.
- If the ledger is non-empty, preserve its bytes exactly. If it does not end in
  `\n`, append `\n`; then append one blank line, the entries, and a final `\n`.
- Entries are appended at EOF, never inserted above existing content.
- Intentional deviation: the existing ledger packs records without blank lines; C2
  separates new entries with one blank line for readability. This is org-valid and
  the parser ignores blank lines. A diff reviewer should not treat it as a bug.

**Rationale**: This is the shape all 171 existing records already carry, minus the
superseded decision drawer. Initialising an empty ledger with the header is required
so SC-006 can pass on a freshly created ledger without hand-editing a fixture. The
header is part of the ledger contract (ADR 0011 §1), not test-only setup.

**Alternatives considered**: inserting under an `* Inbox` heading (changes structure
and requires locating a section); rewriting the file with a normalized form (violates
append-only); keeping `:DECISION:` (superseded by ADR 0011 and contradicted by
`FR-004`); putting the header only in the fixture (would stop testing the real
creation path).

**Unsure / prerequisite**: The v2 template in `~/org/projects/ingest-spec.org` still
lacks `:BITRATE:`, `:FILESIZE:` and `:CLEANUP:`. Q1 accepted extending it; that
external contract edit remains a prerequisite, not a code decision.

## R4 — Ledger parsing and duplicate detection

**Decision**: Parse only what C2 needs: heading state, property drawer, `:HASH:` and
`:SOURCE:`. The duplicate set is every valid 64-hex `:HASH:` found anywhere in the
ledger, regardless of state or source path. Unknown drawers (including legacy
`:DECISION:`) are ignored. A malformed entry is a fatal ledger error unless it can be
skipped without affecting hash extraction; the chosen rule is: malformed property
blocks are reported and the run stops before writing.

**Rationale**: Duplicate detection must follow `FR-002` exactly (hash only). Including
`WAIVED` records follows the deferred OPEN-03 reading and keeps one record per content
identity. Stopping on a malformed ledger is safer than appending into an unknown state.

**Alternatives considered**: only `TODO` hashes (would duplicate `WAIVED` content);
source-path-based matching (contradicts hash identity); a tolerant parser that skips
malformed blocks (could miss a hash and append a duplicate).

## R5 — Flat scan, hash and deterministic tie-break

**Decision**: `readdir` the inbox once with `withFileTypes`. Regular files are
candidates. Every non-regular top-level entry—directory, symlink, fifo, socket, or
other—is one `mimo scope` item with an explicit reason; its contents or target are
never read. Sort candidates by filename using code-unit order (not locale). Hash with
a streamed `sha256`. Before appending, re-stat and re-hash only the selected new
candidates; if the file changed or disappeared, emit a per-file error and write no
record. When two candidates in the same run share a hash, the first in sorted order
gets the record; the rest are reported as duplicates.

**Rationale**: Satisfies `FR-001`, ADR 0013 and constitution III. Sorting before
hashing makes the winner stable. Non-regular entries must be visible in the report;
silently dropping a symlink would make “not in the ledger” indistinguishable from
“does not exist”. Re-hashing only selected candidates is O(new files), not a second
pass over all 1,163 files.

**Alternatives considered**: `readdir({recursive:true})` (explicitly forbidden);
locale-aware sort (varies by environment); hashing in directory order (not
deterministic); following symlinks and hashing targets (a different decision, not a
default); silently skipping non-regular entries (hides inventory).

## R6 — Metadata formats

**Decision**:
- `:DURATION:` from `ffprobe -show_entries format=duration`; floor seconds; format
  `MM:SS` with total minutes (e.g. `88:12` is valid). Empty when no audio stream.
- `:BITRATE:` from `ffprobe -show_entries stream=bit_rate`; integer kilobits per
  second, truncated, suffixed `k` (e.g. `32k`). Empty when unavailable.
- `:FILESIZE:` decimal bytes from `stat`.
- `:SOURCE:` absolute path as returned by the filesystem, without symlink resolution.

`ffprobe` failure for an audio-looking file is a per-file error (no record); for a
non-audio file it is not an error and leaves duration/bitrate empty.

**Rationale**: Matches the existing ledger (`06:48`, `32k`) and the old worker's
formatting. Flooring avoids claiming more audio than exists.

**Alternatives considered**: raw seconds/bps (inconsistent with the ledger);
`HH:MM:SS` (the contract and existing rows use `MM:SS`); rounding up (would produce a
duration longer than the file).

## R7 — KIND classification

**Decision**: deterministic, filename/extension based:
- `Plaud-voice-record` if the basename starts with `YYYY-MM-DD HH_MM_SS`;
- `archive` for `.zip`, `.tar`, `.tar.gz`, `.tgz`;
- `audio-file` for known audio extensions (`.mp3`, `.m4a`, `.wav`, `.flac`, `.ogg`,
  `.aac`, `.opus`);
- `other-file` otherwise.

**Rationale**: Q2 accepted every regular file, so the vocabulary needs a value for
non-audio/non-archive files. `other-file` is honest and keeps the three contract
examples intact. Deriving Plaud kind from the filename—not from the API result—means
an API outage does not change `KIND`.

**Alternatives considered**: kind from `:PLAUD-ID:` presence (misclassifies every
Plaud file during an API outage); MIME sniffing (extra dependency and still ambiguous
for containers); dropping non-audio files (rejected by Q2).

## R8 — CREATED and LOGBOOK provenance

**Decision**: take the first valid `YYYY-MM-DD` token in the basename; write it as-is.
If absent, use the file's `mtime` date in `Europe/Prague`. The `:LOGBOOK:` line ends
with `(created from filename)` or `(created from mtime)`. The logbook timestamp uses
the run time in `Europe/Prague` and the format `YYYY-MM-DD Day HH:mm`.

**Rationale**: Matches the existing ledger's `2026-04-01` values and makes the
fallback auditable a year later. Using one timezone avoids date drift around midnight.

**Alternatives considered**: `ffprobe creation_time` (not reliably present and not
the agreed source); UTC dates (would disagree with the existing human-facing ledger);
writing only the date without provenance (rejected by the clarification).

## R9 — Plaud inventory adapter

**Decision**: one optional adapter behind `PlaudInventoryPort`. v1 invokes the
configured Plaud MCP server over stdio JSON-RPC and calls `list_files` page by page.
The command is configurable (`PLAUD_MCP_CMD`, default
`npx -y @plaud-ai/mcp@latest`) so tests can inject a fake server. Auth is whatever the
MCP server already uses (`~/.plaud/tokens-mcp.json` for the current setup); C2 does
not read or refresh tokens itself. A single throttled/backoff layer wraps all JSON-RPC
calls: max 1 request/second, 30 s timeout, exponential backoff, five attempts.

**Rationale**: The MCP server is the documented, working Plaud boundary in this
environment and already owns OAuth/refresh. It avoids reverse-engineering the web API
and cookie/token refresh. Only `list_files` is needed for `:PLAUD-ID:`; C2 never calls
`get_file` or downloads audio. The port keeps the adapter replaceable by direct HTTP
later without touching registration.

**Alternatives considered**: direct `https://api.plaud.ai/file/simple/web` with the
MCP access token (no refresh path, undocumented pagination, brittle); browser/CDP
scraping (ADR 0012 replacement test fails); calling C1's `inventory.json` (C1 is
v1.1, and Q4 chose A).

## R10 — `start_at` join

**Decision**: the adapter fetches all pages once per run and builds a map from
`start_at` in `Europe/Prague` to `id`. `start_at` from the API is treated as UTC
(the measured examples are UTC) and converted to `Europe/Prague`; the key is
`YYYY-MM-DD HH_mm_ss`. A file joins only when its basename starts with that exact
key. If no key matches, `:PLAUD-ID:` stays empty. If multiple API records share a
key, the join is ambiguous: leave the ID empty and add an error entry; never guess.

**Rationale**: This is the invariant that resolves renamed recordings: the local
filename keeps the old timestamp while the API `name` changes. Matching on
`start_at` only follows `FR-009` literally.

**Alternatives considered**: matching `name` (breaks after a Plaud rename); matching
file `mtime` (not the recording time); guessing an ID from the filename (explicitly
forbidden).

## R11 — Report and exit codes

**Decision**: default output is human-readable stdout with the exact labels
`nové:`, `duplicity:`, `mimo scope:`, `chyby:` followed by path lists. `--json`
prints one JSON object to stdout and sends human logs to stderr. Exit codes:
`0` = run completed, including per-file errors; `2` = fatal usage/config/ledger/scan
error before or during writing; `1` = unexpected crash.

**Rationale**: US2 pins the labels; C6 will later need machine-readable counts. The
`--json` flag supplies that without changing the default acceptance output. Exit 0 on
a completed run with per-file errors follows the deferred OPEN-13 reading and
`FR-009`'s fail-soft stance.

**Alternatives considered**: JSON by default (breaks US2's literal labels); always
non-zero on any error (contradicts fail-soft); report file only (harder to test and
not requested).

## R12 — Error handling

**Decision**: a per-file failure (unreadable file, `ffprobe` failure on audio, file
disappearing during the run, unrepresentable filename with newline/control chars)
produces an error entry, no record for that file, and the run continues. A fatal error
is limited to: missing/unreadable scan root, missing/unreadable ledger, malformed
ledger, lock conflict, or failure to append. Fatal errors exit 2.

**Rationale**: A batch registration tool should not lose 1,162 good files because one
is unreadable. No partial record is allowed because it would violate the entry
contract and `SC-005`.

**Alternatives considered**: fail-fast (loses the batch); skip silently (hides
errors); write a partial record with empty fields (violates the contract).

## R13 — Emacs validity harness

**Decision**: commit `tests/emacs/check-ledger.el` and a fixture. The script runs
`emacs --batch -Q`, loads the produced ledger, sets `org-todo-keywords` from the
file's `#+TODO:` line (which populates `org-todo-kwd-alist`), visits every heading,
and asserts its keyword is one of `TODO INGEST REJECT IGNORE WAIVED`. `npm run
test:emacs` invokes it. Emacs is a test-only prerequisite; production code never
calls it.

**Rationale**: `SC-006` is explicitly an Emacs-parsing criterion. A committed script
makes “viz dnešní ověření” reproducible and satisfies constitution I without violating
the no-Emacs runtime constraint.

**Alternatives considered**: a pure parser assertion only (does not prove Emacs
accepts the file); a manual check (not a test).

## R14 — Concurrency and append atomicity

**Decision**: v1 is single-writer. The lock lives outside the tracked `~/org` tree:
`<XDG_RUNTIME_DIR or os.tmpdir()>/plaud-pipeline-<sha256(absolute ledger path)[0..16]>.lock`.
It contains JSON `{pid, startedAt}`. Acquire with `O_EXCL`. If the lock exists, treat
it as stale when the PID is not alive or `startedAt` is older than one hour; remove
and retry once. Write the complete new-entry payload in one `O_APPEND` write and
remove the lock in `finally`.

**Rationale**: Prevents two runs from interleaving subtrees without creating a
transient file in the `~/org` git repository. A runtime-dir lock plus a timeout is
more robust than PID alone, because a PID can be reused after a crash. This is enough
for the current single-user, local-filesystem use; no database or cross-host locking
is needed.

**Alternatives considered**: a lock beside the ledger (pollutes the tracked `~/org`
tree); no lock (two runs can duplicate or interleave); write temp + rename (rewrites
the inode and complicates the append-only proof); a database (overkill for one file).

## R15 — Contract prerequisite

**Decision**: the plan treats the Q1 shape as authoritative. Before implementation is
declared complete, `~/org/projects/ingest-spec.org` must be updated so the v2 template
includes `:BITRATE:`, `:FILESIZE:` and `:CLEANUP:`. The same contract update should
record the `KIND` vocabulary extension needed by Q2 (`archive`, `other-file`). This is
an **owned task** in `tasks.md`, not a note: the task edits a file outside this repo,
but its completion is part of C2's definition of done.

**Rationale**: Otherwise the cited contract remains poorer than both the spec and the
existing ledger, which is exactly the M1 drift the clarify round resolved. The
`KIND` values are a plan decision because the spec fixes the file scope but not the
value set.

**Alternatives considered**: leave the contract stale and rely on the spec (creates
two authorities); drop the fields from the spec (rejected by Q1 B).

# Contract: Plaud inventory adapter

## Purpose

Provide the optional `start_at → id` map used to fill `:PLAUD-ID:`. C2 never downloads
audio, never calls `get_file`, and never depends on Plaud for a successful run.

## Public port

```text
PlaudInventoryPort.fetchAll(): Promise<PlaudInventoryResult>

PlaudInventoryResult =
  | { available: true, recordings: PlaudRecording[] }
  | { available: false, reason: string }
```

`PlaudRecording` is defined in `data-model.md`; only `id`, `start_at`, `name` and
optional `duration` are consumed.

## v1 implementation

- Transport: stdio JSON-RPC to the configured Plaud MCP server.
- Command: `PLAUD_MCP_CMD`, default `npx -y @plaud-ai/mcp@latest`.
- Tool: `list_files`, paged with `page_size = 100` until a short page is returned.
- Auth: owned by the MCP server (current setup: `~/.plaud/tokens-mcp.json`). C2 never
  reads or refreshes tokens.
- The adapter accepts the MCP result envelope and extracts the recording array from
  the first present of `files`, `items`, `data`, or a bare array. Each item is then
  validated as a `PlaudRecording`. This tolerance is limited to the external envelope;
  the normalized item schema is strict.
- One fetch per run, not one call per file.

## Throttling and failure

- Maximum one request per second between pages.
- 30-second timeout per request.
- Exponential backoff on 429, 5xx, timeout or DNS failure: five attempts, then give up.
- Failure returns `{ available: false, reason }`. The registration run continues with
  `:PLAUD-ID:` empty and one report entry:
  `{ path: "plaud-inventory", phase: "plaud", reason }`.
- `--no-plaud` skips the port entirely; no error entry is emitted.
- A missing server command, missing auth or invalid response is not fatal.

## Join rule

1. Parse `start_at` as a UTC instant.
2. Convert to `Europe/Prague`.
3. Format as `YYYY-MM-DD HH_mm_ss`.
4. Match the file basename only when it starts with that exact key.
5. If exactly one recording matches, use its `id`.
6. If none match, leave `:PLAUD-ID:` empty.
7. If more than one match, leave it empty and add a `plaud` error entry; never guess.

The API `name` is never used for identity, because a rename in Plaud must not change
which local file is considered the same recording.

## Test doubles

Tests use a fake MCP command (or an in-process fake port) that returns:
- a normal page,
- a short final page,
- a 429 followed by success,
- a timeout,
- an invalid envelope,
- two recordings with the same `start_at`.

No test may contact the real Plaud service.

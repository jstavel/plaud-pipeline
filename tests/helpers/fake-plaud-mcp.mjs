#!/usr/bin/env node
// Fake Plaud MCP server for tests (never contacts the real service).
// Usage: fake-plaud-mcp.mjs <scenario>
// Scenarios: normal | paged | rate-limited-once | timeout | invalid-envelope |
//            ambiguous | bad-start-at | crash
// Speaks line-delimited JSON-RPC over stdio (MCP): initialize handshake, then
// tools/call list_files. Logs one JSON line per list_files request to
// PLAUD_FAKE_LOG (when set) so tests can count attempts.

import { appendFileSync, readFileSync } from "node:fs";

const scenario = process.argv[2] ?? "normal";

function logEvent(event) {
  if (process.env.PLAUD_FAKE_LOG) {
    appendFileSync(process.env.PLAUD_FAKE_LOG, `${event}\n`);
  }
}

function priorSessions() {
  if (!process.env.PLAUD_FAKE_LOG) return 0;
  try {
    return readFileSync(process.env.PLAUD_FAKE_LOG, "utf8")
      .trim()
      .split("\n")
      .filter((l) => l === "session").length;
  } catch {
    return 0;
  }
}

function rec(id, startAt, extra = {}) {
  return { id, start_at: startAt, name: `Recording ${id}`, duration: null, ...extra };
}

const REC_1 = rec("of_aaa1", "2026-04-01T08:37:45Z");
const REC_2 = rec("of_aaa2", "2026-04-01T08:22:47Z");

function page(pageIndex) {
  if (scenario === "paged") {
    if (pageIndex === 0) {
      return Array.from({ length: 100 }, (_, i) =>
        rec(`of_p${i}`, `2026-04-01T0${i % 10}:37:45Z`),
      );
    }
    return [rec("of_page2_0", "2026-05-12T10:41:21Z"), rec("of_page2_1", "2026-05-12T10:41:21Z")];
  }
  if (scenario === "ambiguous") {
    return [REC_1, REC_2, rec("of_dup", "2026-04-01T08:37:45Z")];
  }
  if (scenario === "bad-start-at") {
    return [REC_1, rec("of_baddate", "not-a-date")];
  }
  return [REC_1, REC_2];
}

function send(obj) {
  process.stdout.write(JSON.stringify(obj) + "\n");
}

let buffer = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  let idx;
  while ((idx = buffer.indexOf("\n")) >= 0) {
    const line = buffer.slice(0, idx);
    buffer = buffer.slice(idx + 1);
    if (line.trim()) {
      handleMessage(line).catch((error) => {
        send({ jsonrpc: "2.0", id: null, error: { code: -32603, message: String(error) } });
        process.exit(1);
      });
    }
  }
});

async function handleMessage(line) {
  const msg = JSON.parse(line);
  if (msg.method === "initialize") {
    logEvent("session");
    send({
      jsonrpc: "2.0",
      id: msg.id,
      result: { protocolVersion: "2024-11-05", capabilities: {}, serverInfo: { name: "fake-plaud" } },
    });
    return;
  }
  if (msg.method === "tools/call" && msg.params?.name === "list_files") {
    const pageIndex = Number(msg.params.arguments?.page ?? 0);
    if (scenario === "crash") {
      process.exit(1);
    }
    logEvent("list");
    if (scenario === "rate-limited-once") {
      if (priorSessions() <= 1 && pageIndex === 0) {
        send({
          jsonrpc: "2.0",
          id: msg.id,
          error: { code: 429, message: "429 rate limited" },
        });
        return;
      }
    } else if (scenario === "timeout") {
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
    if (scenario === "invalid-envelope") {
      send({
        jsonrpc: "2.0",
        id: msg.id,
        result: {
          content: [{ type: "text", text: JSON.stringify({ unrelated: 1 }) }],
        },
      });
      return;
    }
    send({
      jsonrpc: "2.0",
      id: msg.id,
      result: {
        content: [{ type: "text", text: JSON.stringify({ files: page(pageIndex) }) }],
      },
    });
    return;
  }
  if (msg.method && msg.id != null) {
    send({
      jsonrpc: "2.0",
      id: msg.id,
      error: { code: -32601, message: `unknown method ${msg.method}` },
    });
  }
}

process.stdin.resume();

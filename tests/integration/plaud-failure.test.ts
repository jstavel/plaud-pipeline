import { expect, test, beforeEach, afterEach } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCli } from "../helpers/run-cli.js";
import { buildBasic } from "../fixtures/build-fixtures.js";
import { parseLedger } from "../../src/ledger/parse.js";

let root: string;
let downloads: string;
let ledger: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "c2-plaudfail-"));
  downloads = join(root, "downloads");
  ledger = join(root, "ledger.org");
  buildBasic(downloads);
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

const helper = join(__dirname, "..", "helpers", "fake-plaud-mcp.mjs");

test("a failing Plaud server degrades: entries without :PLAUD-ID:, plaud error entry, exit 0", async () => {
  const result = await runCli(
    ["register", "--downloads", downloads, "--ledger", ledger],
    { PLAUD_MCP_CMD: `node ${helper} timeout`, PLAUD_MCP_TIMEOUT_MS: "1000" },
  );
  expect(result.code).toBe(0);
  const entries = parseLedger(await readFile(ledger, "utf8"));
  expect(entries).toHaveLength(3);
  expect(entries.every((e) => e.plaudId === "")).toBe(true);
  const report = JSON.parse(
    (
      await runCli(
        ["register", "--downloads", downloads, "--ledger", ledger, "--json"],
        { PLAUD_MCP_CMD: `node ${helper} timeout`, PLAUD_MCP_TIMEOUT_MS: "1000" },
      )
    ).stdout,
  );
  expect(report.errors).toContainEqual({
    path: "plaud-inventory",
    phase: "plaud",
    reason: expect.stringMatching(/timed? ?out/i),
  });
});

test("--no-plaud performs no fetch and emits no plaud error entry", async () => {
  const result = await runCli(
    ["register", "--downloads", downloads, "--ledger", ledger, "--no-plaud"],
    { PLAUD_MCP_CMD: `node ${helper} timeout`, PLAUD_MCP_TIMEOUT_MS: "1000" },
  );
  expect(result.code).toBe(0);
  const report = JSON.parse(
    (
      await runCli(
        [
          "register",
          "--downloads",
          downloads,
          "--ledger",
          ledger,
          "--no-plaud",
          "--json",
        ],
        { PLAUD_MCP_CMD: `node ${helper} timeout`, PLAUD_MCP_TIMEOUT_MS: "1000" },
      )
    ).stdout,
  );
  expect(report.errors.filter((e: { phase: string }) => e.phase === "plaud")).toHaveLength(0);
  expect(report.counts.new).toBe(0);
});

test("a successful join fills :PLAUD-ID: from start_at, never from the name", async () => {
  const result = await runCli(["register", "--downloads", downloads, "--ledger", ledger], {
    PLAUD_MCP_CMD: `node ${helper} normal`,
  });
  expect(result.code).toBe(0);
  const entries = parseLedger(await readFile(ledger, "utf8"));
  const joined = entries.find((e) => e.headline.includes("2026-04-01 10_37_45"));
  expect(joined?.plaudId).toBe("of_aaa1");
  const unjoined = entries.find((e) => e.headline.endsWith("voice-memo.mp3"));
  expect(unjoined?.plaudId).toBe("");
});

// contracts/plaud-inventory.md: "A missing server command ... is not fatal."
test("a missing server command degrades immediately: plaud error entry, exit 0, empty :PLAUD-ID:", async () => {
  const result = await runCli(
    ["register", "--downloads", downloads, "--ledger", ledger],
    { PLAUD_MCP_CMD: "/nonexistent/plaud-server-cmd" },
  );
  expect(result.code).toBe(0);
  const entries = parseLedger(await readFile(ledger, "utf8"));
  expect(entries).toHaveLength(3);
  expect(entries.every((e) => e.plaudId === "")).toBe(true);
  const report = JSON.parse(
    (
      await runCli(
        ["register", "--downloads", downloads, "--ledger", ledger, "--json"],
        { PLAUD_MCP_CMD: "/nonexistent/plaud-server-cmd" },
      )
    ).stdout,
  );
  expect(report.errors).toContainEqual({
    path: "plaud-inventory",
    phase: "plaud",
    reason: expect.stringMatching(/server command failed/i),
  });
});

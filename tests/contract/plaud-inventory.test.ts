import { expect, test, afterEach } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  McpPlaudInventory,
  joinPlaudId,
  plaudLocalStartKey,
  startAtMap,
} from "../../src/plaud/inventory.js";

let root: string;
let log: string;

function fakeCmd(scenario: string): string {
  const helper = join(__dirname, "..", "helpers", "fake-plaud-mcp.mjs");
  return `node ${helper} ${scenario}`;
}

function envFor(scenario: string): Record<string, string> {
  return {
    PLAUD_MCP_CMD: fakeCmd(scenario),
    PLAUD_FAKE_LOG: log,
  };
}

afterEach(async () => {
  if (root) {
    await rm(root, { recursive: true, force: true });
  }
});

test("start_at UTC is converted to the Europe/Prague join key (DST aware)", () => {
  expect(plaudLocalStartKey("2026-04-01T08:37:45Z")).toBe("2026-04-01 10_37_45");
  expect(plaudLocalStartKey("2026-01-10T23:30:00Z")).toBe("2026-01-11 00_30_00");
  expect(plaudLocalStartKey("2026-07-10T21:27:00Z")).toBe("2026-07-10 23_27_00");
});

test("join matches by exact local start key prefix of the basename", () => {
  const map = startAtMap([
    { id: "of_aaa1", startAtUtc: "2026-04-01T08:37:45Z", localStartKey: "2026-04-01 10_37_45", name: "n", durationMs: null },
  ]);
  expect(joinPlaudId("2026-04-01 10_37_45.mp3", map)).toEqual({ id: "of_aaa1", ambiguous: false });
  expect(joinPlaudId("2026-04-01 10_37_45-renamed-suffix.mp3", map)).toEqual({ id: "of_aaa1", ambiguous: false });
  expect(joinPlaudId("2026-04-02 10_37_45.mp3", map)).toEqual({ id: null, ambiguous: false });
});

test("an ambiguous start_at never joins (never guesses)", () => {
  const map = startAtMap([
    { id: "of_x", startAtUtc: "2026-04-01T08:37:45Z", localStartKey: "2026-04-01 10_37_45", name: "n1", durationMs: null },
    { id: "of_y", startAtUtc: "2026-04-01T08:37:45Z", localStartKey: "2026-04-01 10_37_45", name: "n2", durationMs: null },
  ]);
  expect(joinPlaudId("2026-04-01 10_37_45.mp3", map)).toEqual({ id: null, ambiguous: true });
});

test("the API name is never used for identity", () => {
  const map = startAtMap([
    { id: "of_real", startAtUtc: "2026-04-01T08:37:45Z", localStartKey: "2026-04-01 10_37_45", name: "Completely different name.mp3", durationMs: null },
  ]);
  expect(joinPlaudId("2026-04-01 10_37_45.mp3", map)).toEqual({ id: "of_real", ambiguous: false });
});

test("normal page: two recordings with Prague keys", async () => {
  root = await mkdtemp(join(tmpdir(), "c2-plaud-"));
  log = join(root, "log");
  const inv = new McpPlaudInventory(envFor("normal"));
  const result = await inv.fetchAll();
  expect(result.available).toBe(true);
  if (result.available) {
    expect(result.recordings.map((r) => r.id)).toEqual(["of_aaa1", "of_aaa2"]);
    expect(result.recordings[0].localStartKey).toBe("2026-04-01 10_37_45");
  }
});

test("pagination: pages of 100 until a short page, at most one request per second", async () => {
  root = await mkdtemp(join(tmpdir(), "c2-plaud-"));
  log = join(root, "log");
  const inv = new McpPlaudInventory(envFor("paged"));
  const started = Date.now();
  const result = await inv.fetchAll();
  const elapsed = Date.now() - started;
  expect(result.available).toBe(true);
  if (result.available) {
    expect(result.recordings).toHaveLength(102);
  }
  expect(elapsed).toBeGreaterThanOrEqual(950);
  expect((await readFile(log, "utf8")).trim().split("\n")).toEqual([
    "session",
    "list",
    "list",
  ]);
});

test("429 is retried with backoff and then succeeds", async () => {
  root = await mkdtemp(join(tmpdir(), "c2-plaud-"));
  log = join(root, "log");
  const inv = new McpPlaudInventory(envFor("rate-limited-once"));
  const result = await inv.fetchAll();
  expect(result.available).toBe(true);
  const lines = (await readFile(log, "utf8")).trim().split("\n");
  expect(lines.filter((l) => l === "session").length).toBeGreaterThanOrEqual(2);
  expect(lines.filter((l) => l === "list").length).toBeGreaterThanOrEqual(2);
});

test("timeout exhausts five attempts and degrades to unavailable", async () => {
  root = await mkdtemp(join(tmpdir(), "c2-plaud-"));
  log = join(root, "log");
  const inv = new McpPlaudInventory({
    ...envFor("timeout"),
    PLAUD_MCP_TIMEOUT_MS: "1000",
  });
  const result = await inv.fetchAll();
  expect(result.available).toBe(false);
  if (!result.available) {
    expect(result.reason).toMatch(/timed? ?out/i);
  }
  expect(
    (await readFile(log, "utf8")).trim().split("\n").filter((l) => l === "session"),
  ).toHaveLength(5);
});

test("an invalid envelope degrades to unavailable, not a crash", async () => {
  root = await mkdtemp(join(tmpdir(), "c2-plaud-"));
  log = join(root, "log");
  const inv = new McpPlaudInventory(envFor("invalid-envelope"));
  const result = await inv.fetchAll();
  expect(result.available).toBe(false);
  if (!result.available) {
    expect(result.reason).toMatch(/envelope/i);
  }
});

test("a recording with an unparseable start_at is skipped, not fatal", async () => {
  root = await mkdtemp(join(tmpdir(), "c2-plaud-"));
  log = join(root, "log");
  const inv = new McpPlaudInventory(envFor("bad-start-at"));
  const result = await inv.fetchAll();
  expect(result.available).toBe(true);
  if (result.available) {
    expect(result.recordings.map((r) => r.id)).toEqual(["of_aaa1"]);
  }
});

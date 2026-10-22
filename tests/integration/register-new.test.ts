import { expect, test, beforeEach, afterEach } from "vitest";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCli } from "../helpers/run-cli.js";
import { buildBasic } from "../fixtures/build-fixtures.js";
import { parseLedger } from "../../src/ledger/parse.js";

let root: string;
let downloads: string;
let ledger: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "c2-new-"));
  downloads = join(root, "downloads");
  ledger = join(root, "ledger.org");
  buildBasic(downloads);
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

async function sha256(path: string): Promise<string> {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

test("three new files produce three TODO entries with hash identity and metadata", async () => {
  const result = await runCli([
    "register",
    "--downloads",
    downloads,
    "--ledger",
    ledger,
    "--no-plaud",
  ]);
  expect(result.code).toBe(0);
  expect(result.stdout.split("\n").slice(0, 4)).toEqual([
    "nové: 3",
    "duplicity: 0",
    "mimo scope: 0",
    "chyby: 0",
  ]);

  const entries = parseLedger(await readFile(ledger, "utf8"));
  expect(entries).toHaveLength(3);
  for (const entry of entries) {
    expect(entry.state).toBe("TODO");
    const path = join(downloads, entry.headline.replace(/^\[\d+ min\] /, ""));
    expect(entry.hash).toBe(await sha256(path));
    expect(entry.source).toBe(path);
    expect(entry.duration).not.toBe("");
    expect(entry.bitrate).toBe("32k");
    const base = entry.headline.replace(/^\[\d+ min\] /, "");
    const expectedKind = base === "voice-memo.mp3" ? "audio-file" : "Plaud-voice-record";
    expect(entry.kind).toBe(expectedKind);
    expect(entry.synopsis).toBe("");
    expect(entry.cleanup).toBe("");
    expect(entry.filesize).toBe(String((await stat(path)).size));
    expect(entry.plaudId).toBe("");
    expect(entry.logbook.some((l) => l.includes("Registered by C2"))).toBe(true);
  }

  const byBasename = new Map(
    entries.map((e) => [e.headline.replace(/^\[\d+ min\] /, ""), e]),
  );
  expect(
    entries.filter((e) => e.logbook.some((l) => l.includes("created from filename")))
      .length,
  ).toBe(2);
  expect(
    entries.filter((e) => e.logbook.some((l) => l.includes("created from mtime")))
      .length,
  ).toBe(1);
  expect(byBasename.get("2026-04-01 10_37_45.mp3")?.created).toBe("2026-04-01");
});

test("mtimes of all source files are unchanged after the run", async () => {
  const names = (await readdir(downloads)).sort();
  const statsBefore = new Map<string, { m: number }>();
  for (const n of names) {
    statsBefore.set(n, { m: (await stat(join(downloads, n))).mtimeMs });
  }
  await runCli(["register", "--downloads", downloads, "--ledger", ledger, "--no-plaud"]);
  for (const n of names) {
    expect((await stat(join(downloads, n))).mtimeMs).toBe(statsBefore.get(n)?.m);
  }
});

test("a second run adds zero records and leaves the ledger bytes unchanged", async () => {
  await runCli(["register", "--downloads", downloads, "--ledger", ledger, "--no-plaud"]);
  const bytes = await readFile(ledger);
  const second = await runCli([
    "register",
    "--downloads",
    downloads,
    "--ledger",
    ledger,
    "--no-plaud",
  ]);
  expect(second.code).toBe(0);
  expect(second.stdout).toContain("nové: 0");
  expect((await readFile(ledger)).equals(bytes)).toBe(true);
});

test("every new headline carries the [N min] estimate derived from duration", async () => {
  await runCli(["register", "--downloads", downloads, "--ledger", ledger, "--no-plaud"]);
  const text = await readFile(ledger, "utf8");
  expect(text).toContain("* TODO [1 min] 2026-04-01 10_37_45.mp3\n");
  expect(text).toContain("* TODO [1 min] voice-memo.mp3\n");
});

test("ledger path parent directory is created when missing", async () => {
  const nestedLedger = join(root, "does", "not", "exist", "ledger.org");
  const result = await runCli([
    "register",
    "--downloads",
    downloads,
    "--ledger",
    nestedLedger,
    "--no-plaud",
  ]);
  expect(result.code).toBe(0);
  await expect(readFile(nestedLedger, "utf8")).resolves.toContain("* TODO");
});

test("--json prints one JSON object with report invariants", async () => {
  const result = await runCli([
    "register",
    "--downloads",
    downloads,
    "--ledger",
    ledger,
    "--no-plaud",
    "--json",
  ]);
  expect(result.code).toBe(0);
  const report = JSON.parse(result.stdout);
  expect(report.counts).toEqual({ new: 3, duplicates: 0, outOfScope: 0, errors: 0 });
  expect(report.new).toHaveLength(3);
  for (const item of report.new) {
    expect(item.hash).toBe(await sha256(item.path));
  }
});

test("a scan root that is a file, not a directory, is a fatal error (exit 2)", async () => {
  await rm(downloads, { recursive: true, force: true });
  await writeFile(downloads, "this is a file, not a directory");
  const result = await runCli([
    "register",
    "--downloads",
    downloads,
    "--ledger",
    ledger,
    "--no-plaud",
  ]);
  expect(result.code).toBe(2);
});

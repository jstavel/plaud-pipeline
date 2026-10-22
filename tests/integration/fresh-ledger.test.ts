import { expect, test, beforeEach, afterEach } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCli } from "../helpers/run-cli.js";
import { buildBasic } from "../fixtures/build-fixtures.js";

let root: string;
let downloads: string;
let ledger: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "c2-fresh-"));
  downloads = join(root, "downloads");
  ledger = join(root, "ledger.org");
  buildBasic(downloads);
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

function emacsCheck(file: string): string {
  const result = spawnSync(
    "emacs",
    ["--batch", "-Q", "-l", "tests/emacs/check-ledger.el", "--", file],
    { encoding: "utf8", cwd: join(__dirname, "..", "..") },
  );
  // `message` in --batch mode writes to stderr.
  return (result.stdout ?? "") + (result.stderr ?? "");
}

test("a missing ledger is created with the canonical header and passes the Emacs batch check", async () => {
  const result = await runCli([
    "register",
    "--downloads",
    downloads,
    "--ledger",
    ledger,
    "--no-plaud",
  ]);
  expect(result.code).toBe(0);
  const text = await readFile(ledger, "utf8");
  expect(text.split("\n")[0]).toBe(
    "#+TODO: TODO(t) | INGEST(i@!) REJECT(r@) IGNORE(x@) WAIVED(a@)",
  );
  expect(text.split("\n")[1]).toBe("");
  expect(emacsCheck(ledger)).toContain("OK:");
});

test("an empty ledger file gets the canonical header and passes the Emacs batch check", async () => {
  await writeFile(ledger, "");
  const result = await runCli([
    "register",
    "--downloads",
    downloads,
    "--ledger",
    ledger,
    "--no-plaud",
  ]);
  expect(result.code).toBe(0);
  const text = await readFile(ledger, "utf8");
  expect(text.split("\n")[0]).toBe(
    "#+TODO: TODO(t) | INGEST(i@!) REJECT(r@) IGNORE(x@) WAIVED(a@)",
  );
  expect(emacsCheck(ledger)).toContain("OK:");
});

test("the committed ledger fixture also passes the Emacs batch check", () => {
  const fixture = join(__dirname, "..", "fixtures", "ledger", "existing.org");
  expect(emacsCheck(fixture)).toContain("OK:");
});

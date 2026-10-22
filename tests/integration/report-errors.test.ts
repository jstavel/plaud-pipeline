import { expect, test, beforeEach, afterEach } from "vitest";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCli } from "../helpers/run-cli.js";
import { buildBasic, writeFileIn } from "../fixtures/build-fixtures.js";
import { parseLedger } from "../../src/ledger/parse.js";

let root: string;
let downloads: string;
let ledger: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "c2-errors-"));
  downloads = join(root, "downloads");
  ledger = join(root, "ledger.org");
  buildBasic(downloads);
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

test("an unreadable file and an audio file without decodable audio are per-file errors; the run continues and exits 0 (OPEN-13)", async () => {
  await writeFile(join(downloads, "unreadable.txt"), "secret\n");
  await chmod(join(downloads, "unreadable.txt"), 0o000);
  await writeFile(
    join(downloads, "corrupt.mp3"),
    Buffer.from([0xff, 0xff, 0xff, 0xff, 0x00, 0xde, 0xad, 0xbe, 0xef]),
  );
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
    "chyby: 2",
  ]);

  const entries = parseLedger(await readFile2(ledger));
  // No partial record for either failed file (SC-005 is safe).
  expect(entries).toHaveLength(3);
  const report = JSON.parse(
    (
      await runCli([
        "register",
        "--downloads",
        downloads,
        "--ledger",
        ledger,
        "--no-plaud",
        "--json",
      ])
    ).stdout,
  );
  const phases = new Map(
    report.errors.map((e: { path: string; phase: string }) => [e.path, e.phase]),
  );
  expect(phases.get(join(downloads, "unreadable.txt"))).toBe("hash");
  expect(phases.get(join(downloads, "corrupt.mp3"))).toBe("ffprobe");
  expect(report.counts.new).toBe(0);
});

function readFile2(path: string): Promise<string> {
  return import("node:fs/promises").then((fs) => fs.readFile(path, "utf8"));
}

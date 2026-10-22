import { expect, test } from "vitest";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scanDownloads } from "../../src/register/scan.js";

async function temp(): Promise<string> {
  return mkdtemp(join(tmpdir(), "c2-scan-"));
}

test("scan lists only immediate regular children, sorted by basename (code-unit order)", async () => {
  const root = await temp();
  const files = ["b.mp3", "a.txt", "Z.mp3", "2026-04-01 10_37_45.mp3"];
  for (const f of files) {
    await (await import("node:fs/promises")).writeFile(join(root, f), "x");
  }
  const result = await scanDownloads(root);
  expect(result.candidates.map((c) => c.basename)).toEqual([
    "2026-04-01 10_37_45.mp3",
    "Z.mp3",
    "a.txt",
    "b.mp3",
  ]);
});

test("scan never recurses into a subdirectory and reports it as one out-of-scope item", async () => {
  const root = await temp();
  await (await import("node:fs/promises")).mkdir(join(root, "zaloha"));
  await (await import("node:fs/promises")).writeFile(
    join(root, "zaloha", "inner.txt"),
    "secret",
  );
  await (await import("node:fs/promises")).writeFile(join(root, "top.txt"), "x");
  const result = await scanDownloads(root);
  expect(result.candidates).toHaveLength(1);
  expect(result.outOfScope).toEqual([
    { path: join(root, "zaloha") + "/", reason: "directory" },
  ]);
});

test("non-regular entries are reported with explicit reasons", async () => {
  const root = await temp();
  const { symlinkSync } = await import("node:fs");
  const { execSync } = await import("node:child_process");
  symlinkSync("target.txt", join(root, "link.lnk"));
  execSync(`mkfifo ${JSON.stringify(join(root, "pipe.fifo"))}`);
  await (await import("node:fs/promises")).writeFile(join(root, "target.txt"), "x");
  const result = await scanDownloads(root);
  const reasons = new Map(result.outOfScope.map((o) => [o.path, o.reason]));
  expect(reasons.get(join(root, "link.lnk"))).toBe("symlink");
  expect(reasons.get(join(root, "pipe.fifo"))).toBe("fifo");
  expect(result.candidates.map((c) => c.basename)).toEqual(["target.txt"]);
});

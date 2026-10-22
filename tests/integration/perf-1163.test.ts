import { expect, test } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCli } from "../helpers/run-cli.js";
import { buildCounted } from "../fixtures/build-fixtures.js";
import { register } from "../../src/register/run.js";

const COUNT = 1163;
const PERF_BUDGET_MS = 5 * 60 * 1000;
const MEMORY_BUDGET_BYTES = 256 * 1024 * 1024;

test(
  "a 1,163-file run completes inside the five-minute budget via the CLI",
  async () => {
    const root = await mkdtemp(join(tmpdir(), "c2-perf-"));
    try {
      const downloads = join(root, "downloads");
      const ledger = join(root, "ledger.org");
      buildCounted(downloads, COUNT);
      const started = Date.now();
      const result = await runCli([
        "register",
        "--downloads",
        downloads,
        "--ledger",
        ledger,
        "--no-plaud",
      ]);
      const elapsed = Date.now() - started;
      expect(result.code).toBe(0);
      expect(result.stdout.split("\n")[0]).toBe(`nové: ${COUNT}`);
      expect(elapsed).toBeLessThan(PERF_BUDGET_MS);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  },
  { timeout: PERF_BUDGET_MS },
);

test("streamed hashing keeps resident memory bounded below 256 MB", async () => {
  const root = await mkdtemp(join(tmpdir(), "c2-perf-mem-"));
  try {
    const downloads = join(root, "downloads");
    const ledger = join(root, "ledger.org");
    buildCounted(downloads, COUNT, "mem-item");
    let peak = 0;
    const sampler = setInterval(() => {
      peak = Math.max(peak, process.memoryUsage().rss);
    }, 50);
    try {
      const report = await register({
        downloads,
        ledger,
        noPlaud: true,
      });
      expect(report.counts.new).toBe(COUNT);
    } finally {
      clearInterval(sampler);
    }
    expect(peak).toBeLessThan(MEMORY_BUDGET_BYTES);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}, { timeout: PERF_BUDGET_MS });

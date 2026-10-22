import { execSync } from "node:child_process";
import { cpSync, mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const fixturesRoot = join(dirname(fileURLToPath(import.meta.url)));
const downloadsRoot = join(fixturesRoot, "downloads");

function copyFixture(name: string, dir: string): void {
  mkdirSync(dir, { recursive: true });
  cpSync(join(downloadsRoot, name), dir, { recursive: true, dereference: false });
}

export function buildBasic(dir: string): void {
  copyFixture("basic", dir);
}

export function buildDuplicates(dir: string): void {
  copyFixture("duplicates", dir);
}

export function buildNested(dir: string): void {
  copyFixture("nested", dir);
}

export function buildNonRegular(dir: string): void {
  copyFixture("non-regular", dir);
  const fifo = join(dir, "pipe.fifo");
  execSync(`mkfifo ${JSON.stringify(fifo)}`);
}

export function buildCounted(dir: string, count: number, prefix = "scan-item"): string[] {
  mkdirSync(dir, { recursive: true });
  const paths: string[] = [];
  for (let i = 1; i <= count; i += 1) {
    const name = `${prefix}-${String(i).padStart(4, "0")}.txt`;
    const p = join(dir, name);
    writeFileSync(p, `deterministic content ${i}\n`, "utf8");
    paths.push(p);
  }
  return paths;
}

export function writeFileIn(dir: string, name: string, content: string): string {
  mkdirSync(dir, { recursive: true });
  const p = join(dir, name);
  writeFileSync(p, content, "utf8");
  return p;
}

export { symlinkSync };

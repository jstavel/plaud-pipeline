import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const cliJs = join(repoRoot, "dist", "cli.js");

export interface CliResult {
  code: number;
  stdout: string;
  stderr: string;
}

export async function runCli(
  args: string[],
  env?: Record<string, string>,
): Promise<CliResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cliJs, ...args], {
      env: env ? { ...process.env, ...env } : process.env,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", reject);
    child.on("close", (code) => {
      resolve({ code: code ?? -1, stdout, stderr });
    });
  });
}
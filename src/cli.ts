#!/usr/bin/env node
import { pathToFileURL } from "node:url";
import { resolveConfig, printUsage } from "./config.js";
import { register } from "./register/run.js";
import { renderHuman } from "./report/human.js";
import { renderJson } from "./report/json.js";
import { FatalError } from "./domain/types.js";

export async function main(argv: string[]): Promise<number> {
  const [sub, ...rest] = argv;
  if (sub === undefined || sub === "--help" || sub === "-h" || sub === "help") {
    process.stdout.write(printUsage());
    return 0;
  }
  if (sub !== "register") {
    process.stderr.write(printUsage());
    return 2;
  }
  if (rest.includes("--help") || rest.includes("-h")) {
    process.stdout.write(printUsage());
    return 0;
  }
  let config;
  try {
    config = resolveConfig(rest);
  } catch (error) {
    if (error instanceof FatalError) {
      process.stderr.write(`fatal: ${error.message}\n`);
      return 2;
    }
    throw error;
  }
  try {
    const report = await register({
      downloads: config.downloads,
      ledger: config.ledger,
      noPlaud: config.noPlaud,
    });
    if (config.json) {
      process.stderr.write(renderHuman(report));
      process.stdout.write(renderJson(report));
    } else {
      process.stdout.write(renderHuman(report));
    }
    return 0;
  } catch (error) {
    if (error instanceof FatalError) {
      process.stderr.write(`fatal (${error.phase}): ${error.message}\n`);
      return 2;
    }
    process.stderr.write(`unexpected crash: ${String(error)}\n`);
    return 1;
  }
}

const isMain =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  process.exitCode = await main(process.argv.slice(2));
}
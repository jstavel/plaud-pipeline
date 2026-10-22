import { parseArgs } from "node:util";
import { homedir } from "node:os";
import path from "node:path";
import { cliOptionsSchema, type CliOptions } from "./domain/schemas.js";
import { FatalError } from "./domain/types.js";

export const USAGE = `Usage: plaud-pipeline register [options]

Registers every regular top-level file in the scan root that has no record in
the ledger yet. Never recurses; never writes to the scan root.

Options:
  --downloads <dir>   Scan root. Default: ~/Downloads
  --ledger <file>     Append target. Default: ~/org/ingest-ledger.org
  --json              Print one JSON report to stdout; human report to stderr.
  --no-plaud          Skip the Plaud inventory fetch; :PLAUD-ID: stays empty.
  --help              Print this usage and exit 0.
`;

function expandHome(p: string): string {
  if (p === "~") {
    return homedir();
  }
  if (p.startsWith("~/")) {
    return path.join(homedir(), p.slice(2));
  }
  return p;
}

export function printUsage(): string {
  return USAGE;
}

export function resolveConfig(argv: string[]): CliOptions {
  let values;
  try {
    ({ values } = parseArgs({
      args: argv,
      options: {
        downloads: { type: "string" },
        ledger: { type: "string" },
        json: { type: "boolean", default: false },
        "no-plaud": { type: "boolean", default: false },
      },
      strict: true,
    }));
  } catch (error) {
    throw new FatalError("usage", String(error));
  }
  const parsed = cliOptionsSchema.parse({
    downloads: values.downloads
      ? path.resolve(expandHome(values.downloads))
      : path.join(homedir(), "Downloads"),
    ledger: values.ledger
      ? path.resolve(expandHome(values.ledger))
      : path.join(homedir(), "org", "ingest-ledger.org"),
    json: values.json === true,
    noPlaud: values["no-plaud"] === true,
  });
  return parsed;
}
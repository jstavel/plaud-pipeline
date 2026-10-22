import type { RunReport } from "../domain/types.js";

// Exact Czech labels and section layout per contracts/run-report.md: the first
// four lines are the counts, then only non-empty path sections separated by
// blank lines. A zero count still prints its label with 0.
export function renderHuman(report: RunReport): string {
  const lines = [
    `nové: ${report.counts.new}`,
    `duplicity: ${report.counts.duplicates}`,
    `mimo scope: ${report.counts.outOfScope}`,
    `chyby: ${report.counts.errors}`,
  ];
  const sections: Array<[string, string[]]> = [
    ["nové cesty:", report.new.map((item) => `- ${item.path}`)],
    ["duplicity:", report.duplicates.map((item) => `- ${item.path}`)],
    ["mimo scope:", report.outOfScope.map((item) => `- ${item.path}`)],
    ["chyby:", report.errors.map((item) => `- ${item.path}: ${item.reason}`)],
  ];
  let out = lines.join("\n") + "\n";
  let first = true;
  for (const [label, items] of sections) {
    if (items.length === 0) {
      continue;
    }
    if (first) {
      out += "\n";
      first = false;
    } else {
      out += "\n";
    }
    out += label + "\n" + items.join("\n") + "\n";
  }
  return out;
}
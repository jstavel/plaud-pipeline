import type { RunReport } from "../domain/types.js";
import { reportSchema } from "../domain/schemas.js";

// The JSON report is validated against the contract schema at the boundary
// before it is printed (contracts/run-report.md).
export function renderJson(report: RunReport): string {
  const parsed = reportSchema.parse(report);
  return JSON.stringify(parsed, null, 2) + "\n";
}
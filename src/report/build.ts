import type {
  ReportItemDuplicate,
  ReportItemError,
  ReportItemNew,
  ReportItemOutOfScope,
  RunReport,
} from "../domain/types.js";
import { codeUnitCompare } from "../register/scan.js";

export interface ReportParts {
  new: ReportItemNew[];
  duplicates: ReportItemDuplicate[];
  outOfScope: ReportItemOutOfScope[];
  errors: ReportItemError[];
}

// Counts are derived from the arrays, never kept independently (data-model
// invariant); every array is sorted by path in code-unit order.
export function buildReport(parts: ReportParts): RunReport {
  return {
    counts: {
      new: parts.new.length,
      duplicates: parts.duplicates.length,
      outOfScope: parts.outOfScope.length,
      errors: parts.errors.length,
    },
    new: [...parts.new].sort((a, b) => codeUnitCompare(a.path, b.path)),
    duplicates: [...parts.duplicates].sort((a, b) => codeUnitCompare(a.path, b.path)),
    outOfScope: [...parts.outOfScope].sort((a, b) => codeUnitCompare(a.path, b.path)),
    errors: [...parts.errors].sort((a, b) => codeUnitCompare(a.path, b.path)),
  };
}
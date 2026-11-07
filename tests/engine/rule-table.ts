// A rule table: plain-language cases that are both tests and the rulebook in docs/rules.md.
// Keep these files free of imports from src/, so scripts/rules-doc.ts can read them directly.
export type Cell = string | number | boolean | null;

export interface RuleTable<Given extends Record<string, Cell>, Expected extends Cell> {
  /** Heading in docs/rules.md */
  title: string;
  /** What the rule is for, in a sentence or two */
  summary: string;
  /** Column heading for each "given" key, in order, and for the expected answer */
  columns: { given: Record<keyof Given, string>; expected: string };
  /** How an expected value reads in the table, such as "117.6kg" or "no estimate" */
  show?: (expected: Expected) => string;
  rows: Array<{ case: string; given: Given; expected: Expected }>;
}

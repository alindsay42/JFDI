import { describe, expect, it } from "vitest";
import { databaseName, testVersion } from "../../src/store/db.ts";

describe("test versions never share the live app's data", () => {
  it.each([
    ["/JFDI/", "jfdi", null],
    ["/JFDI/index.html", "jfdi", null],
    ["/", "jfdi", null],
    ["/JFDI/pr-preview/pr-5/", "jfdi-test-pr-5", 5],
    ["/JFDI/pr-preview/pr-12/index.html", "jfdi-test-pr-12", 12],
  ])("%s uses database %s", (path, name, pr) => {
    expect(databaseName(path)).toBe(name);
    expect(testVersion(path)).toBe(pr);
  });
});

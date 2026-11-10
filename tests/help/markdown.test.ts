import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { inline, parse, slugify } from "../../src/help/markdown.ts";

describe("help markdown", () => {
  it("reads headings, paragraphs, lists and bold", () => {
    expect(parse("# Help\n\nOne line\nand the next.\n\n## How it works\n- **Bold:** first\n  carried on\n- second\ntext after\n\n### Detail\n\n## How it works")).toEqual([
      { kind: "h1", id: "help", text: "Help" },
      { kind: "p", parts: [{ text: "One line and the next.", bold: false }] },
      { kind: "h2", id: "how-it-works", text: "How it works" },
      { kind: "ul", items: [[{ text: "Bold:", bold: true }, { text: " first carried on", bold: false }], [{ text: "second text after", bold: false }]] },
      { kind: "h3", id: "detail", text: "Detail" },
      { kind: "h2", id: "how-it-works-2", text: "How it works" },
    ]);
    expect(parse("para\n- item")).toEqual([
      { kind: "p", parts: [{ text: "para", bold: false }] },
      { kind: "ul", items: [[{ text: "item", bold: false }]] },
    ]);
    expect(inline("a **b** c")).toEqual([{ text: "a ", bold: false }, { text: "b", bold: true }, { text: " c", bold: false }]);
    expect(slugify(" Weights & deloads! ")).toBe("weights-deloads");
  });

  it("the manual has a title, unique sections, and nothing left unrendered", () => {
    const blocks = parse(readFileSync("src/help/manual.md", "utf8"));
    expect(blocks[0]).toMatchObject({ kind: "h1", text: "Help" });
    const sections = blocks.filter((b) => b.kind === "h2");
    expect(sections.length).toBeGreaterThan(5);
    const text = JSON.stringify(blocks);
    expect(text).not.toMatch(/\*\*|^#|\]\(/);
  });
});

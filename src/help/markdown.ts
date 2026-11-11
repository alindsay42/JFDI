// Just enough markdown for the Help page: headings, paragraphs, lists and bold. Text is never treated as HTML.

export type Inline = { text: string; bold: boolean };
export type Heading = { kind: "h1" | "h2" | "h3"; id: string; text: string };
export type Block =
  | Heading
  | { kind: "p"; parts: Inline[] }
  | { kind: "ul"; items: Inline[][] };

export const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** "**bold** and plain" as parts. */
export function inline(text: string): Inline[] {
  return text.split(/(\*\*[^*]+\*\*)/).filter(Boolean)
    .map((t) => (t.startsWith("**") && t.endsWith("**") ? { text: t.slice(2, -2), bold: true } : { text: t, bold: false }));
}

export function parse(md: string): Block[] {
  const blocks: Block[] = [];
  const ids = new Set<string>();
  let para: string[] = [];
  let list: string[] | null = null;
  const flush = () => {
    if (para.length) blocks.push({ kind: "p", parts: inline(para.join(" ")) });
    if (list) blocks.push({ kind: "ul", items: list.map(inline) });
    para = [];
    list = null;
  };
  for (const raw of md.split("\n")) {
    const line = raw.trim();
    const h = /^(#{1,3}) (.+)$/.exec(line);
    if (h) {
      flush();
      let id = slugify(h[2]!);
      for (let n = 2; ids.has(id); n++) id = `${slugify(h[2]!)}-${n}`;
      ids.add(id);
      blocks.push({ kind: (["h1", "h2", "h3"] as const)[h[1]!.length - 1]!, id, text: h[2]! });
    } else if (line.startsWith("- ")) {
      if (para.length) flush();
      (list ??= []).push(line.slice(2));
    } else if (!line) {
      flush();
    } else if (list) {
      // A line carrying on the last list item
      list[list.length - 1] += ` ${line}`;
    } else {
      para.push(line);
    }
  }
  flush();
  return blocks;
}

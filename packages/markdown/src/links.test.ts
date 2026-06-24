import {
  findMarkdownUnlinkedMentions,
  parseMarkdownLinkReferences,
  parseMarkdownMentionRanges
} from "./links";

describe("markdown links", () => {
  it("extracts local markdown and wiki-style document links", () => {
    const links = parseMarkdownLinkReferences([
      "# Mock note",
      "",
      "See [Alpha](./alpha.md), [Remote](https://example.test/alpha.md), and ![Asset](./asset.png).",
      "Also see [[Beta]] and [[folder/Gamma|Gamma label]], but not ![[asset.png]]."
    ].join("\n"));

    expect(links.map((link) => ({
      href: link.href,
      lineNumber: link.lineNumber,
      text: link.text
    }))).toEqual([
      {
        href: "./alpha.md",
        lineNumber: 3,
        text: "Alpha"
      },
      {
        href: "Beta",
        lineNumber: 4,
        text: "Beta"
      },
      {
        href: "folder/Gamma",
        lineNumber: 4,
        text: "Gamma label"
      }
    ]);
  });

  it("finds unlinked mentions outside existing links and code", () => {
    const markdown = [
      "# Mock note",
      "",
      "Alpha is plain text, [Alpha](./alpha.md) is linked, and `Alpha` is code.",
      "",
      "```",
      "Alpha in a fence",
      "```",
      "",
      "中文标题也能匹配。"
    ].join("\n");
    const ranges = parseMarkdownMentionRanges(markdown);
    const mentions = findMarkdownUnlinkedMentions(ranges, [
      { id: "alpha", title: "Alpha" },
      { id: "zh", title: "中文标题" }
    ]);

    expect(mentions.map((mention) => ({
      id: mention.candidate.id,
      lineNumber: mention.lineNumber,
      text: mention.text
    }))).toEqual([
      {
        id: "alpha",
        lineNumber: 3,
        text: "Alpha"
      },
      {
        id: "zh",
        lineNumber: 9,
        text: "中文标题"
      }
    ]);
  });

  it("ignores leading frontmatter while finding mentions", () => {
    const markdown = [
      "---",
      "title: Alpha",
      "tags:",
      "  - Alpha",
      "---",
      "",
      "Body mentions Alpha."
    ].join("\n");
    const mentions = findMarkdownUnlinkedMentions(parseMarkdownMentionRanges(markdown), [
      { id: "alpha", title: "Alpha" }
    ]);

    expect(mentions.map((mention) => ({
      lineNumber: mention.lineNumber,
      text: mention.text
    }))).toEqual([
      {
        lineNumber: 7,
        text: "Alpha"
      }
    ]);
  });
});

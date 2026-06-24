import { describe, expect, it } from "vitest";

import { restoreEscapedMarkdownCalloutMarkers } from "./markdown-callout.ts";

describe("markdown callouts", () => {
  it("removes hard-break escapes inside callout blockquotes only", () => {
    const source = [
      "> [!WARNING]",
      ">",
      "> First line\\",
      "> Second line",
      "",
      "> Ordinary quote\\",
      "> next line"
    ].join("\n");

    expect(restoreEscapedMarkdownCalloutMarkers(source)).toBe([
      "> [!WARNING]",
      ">",
      "> First line",
      "> Second line",
      "",
      "> Ordinary quote\\",
      "> next line"
    ].join("\n"));
  });

  it("normalizes formatted Typora callout markers to GitHub alert syntax", () => {
    const source = [
      "> **\\[!NOTE]**",
      ">",
      "> Synthetic detail"
    ].join("\n");

    expect(restoreEscapedMarkdownCalloutMarkers(source)).toBe([
      "> [!NOTE]",
      ">",
      "> Synthetic detail"
    ].join("\n"));
  });

  it("collapses an empty callout body placeholder to one quoted blank line", () => {
    const htmlPlaceholder = [
      "> [!WARNING]",
      ">",
      "> <br />",
      ""
    ].join("\n");

    const emptyParagraphPlaceholder = [
      "> [!WARNING]",
      ">",
      ">",
      ""
    ].join("\n");

    const expected = [
      "> [!WARNING]",
      ">",
      ""
    ].join("\n");

    expect(restoreEscapedMarkdownCalloutMarkers(htmlPlaceholder)).toBe(expected);
    expect(restoreEscapedMarkdownCalloutMarkers(emptyParagraphPlaceholder)).toBe(expected);
  });

  it("collapses doubled trailing empty callout body placeholders", () => {
    const twoEmptyBodyLines = [
      "> [!WARNING]",
      ">",
      ">",
      ">",
      ">",
      ""
    ].join("\n");

    const threeEmptyBodyLines = [
      "> [!WARNING]",
      ">",
      ">",
      ">",
      ">",
      ">",
      ">",
      ""
    ].join("\n");
    const twoEmptyBodyLinesAfterContent = [
      "> [!WARNING]",
      ">",
      "> Synthetic details",
      ">",
      ">",
      ">",
      ">",
      ""
    ].join("\n");

    expect(restoreEscapedMarkdownCalloutMarkers(twoEmptyBodyLines)).toBe([
      "> [!WARNING]",
      ">",
      ">",
      ""
    ].join("\n"));
    expect(restoreEscapedMarkdownCalloutMarkers(threeEmptyBodyLines)).toBe([
      "> [!WARNING]",
      ">",
      ">",
      ">",
      ""
    ].join("\n"));
    expect(restoreEscapedMarkdownCalloutMarkers(twoEmptyBodyLinesAfterContent)).toBe([
      "> [!WARNING]",
      ">",
      "> Synthetic details",
      ">",
      ">",
      ""
    ].join("\n"));
  });

  it("keeps adjacent callout list starts tight without removing structural blank quote lines", () => {
    const markdown = [
      "> [!NOTE]",
      ">",
      "> - First",
      ">",
      "> - Second",
      ">",
      ">   1. Nested detail",
      ">",
      "> Paragraph after list"
    ].join("\n");

    expect(restoreEscapedMarkdownCalloutMarkers(markdown)).toBe([
      "> [!NOTE]",
      ">",
      "> - First",
      "> - Second",
      ">   1. Nested detail",
      ">",
      "> Paragraph after list"
    ].join("\n"));
  });
});

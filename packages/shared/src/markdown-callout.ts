export type MarkdownCalloutType = "note" | "tip" | "important" | "warning" | "caution";

export type MarkdownCalloutDefinition = {
  label: string;
  marker: string;
  type: MarkdownCalloutType;
};

export type ParsedMarkdownCalloutMarker = MarkdownCalloutDefinition & {
  source: string;
};

export const markdownCalloutDefinitions: Record<MarkdownCalloutType, MarkdownCalloutDefinition> = {
  caution: {
    label: "Caution",
    marker: "CAUTION",
    type: "caution"
  },
  important: {
    label: "Important",
    marker: "IMPORTANT",
    type: "important"
  },
  note: {
    label: "Note",
    marker: "NOTE",
    type: "note"
  },
  tip: {
    label: "Tip",
    marker: "TIP",
    type: "tip"
  },
  warning: {
    label: "Warning",
    marker: "WARNING",
    type: "warning"
  }
};

const markdownCalloutMarkerPattern = /^\s*(\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\])/iu;

export function parseMarkdownCalloutMarker(text: string): ParsedMarkdownCalloutMarker | null {
  const match = markdownCalloutMarkerPattern.exec(text);
  const source = match?.[1];
  const marker = match?.[2]?.toUpperCase();
  if (!source || !marker) return null;

  const definition = Object.values(markdownCalloutDefinitions).find((candidate) => candidate.marker === marker);
  if (!definition) return null;

  return {
    ...definition,
    source
  };
}

export function markdownCalloutMarkerForType(type: MarkdownCalloutType) {
  return `[!${markdownCalloutDefinitions[type].marker}]`;
}

function lineContentWithoutEnding(line: string) {
  return line.endsWith("\r") ? line.slice(0, -1) : line;
}

function blockquoteLineContent(line: string) {
  const match = /^((?:>\s*)+)(.*)$/u.exec(lineContentWithoutEnding(line));
  return match?.[2] ?? null;
}

function restoreCalloutHardBreakEscapes(markdown: string) {
  const lines = markdown.split("\n");
  let inCallout = false;

  return lines.map((line, index) => {
    const content = lineContentWithoutEnding(line);
    const lineEnding = line.slice(content.length);
    const quotedContent = blockquoteLineContent(line);

    if (quotedContent === null) {
      inCallout = false;
      return line;
    }

    if (parseMarkdownCalloutMarker(quotedContent)) {
      inCallout = true;
    }

    const nextLine = lines[index + 1];
    const nextIsBlockquote = nextLine !== undefined && blockquoteLineContent(nextLine) !== null;
    if (inCallout && nextIsBlockquote && content.endsWith("\\")) {
      return `${content.slice(0, -1)}${lineEnding}`;
    }

    return line;
  }).join("\n");
}

function lineIsEmptyBlockquote(line: string | undefined) {
  if (line === undefined) return false;

  const quotedContent = blockquoteLineContent(line);
  return quotedContent !== null && quotedContent.trim().length === 0;
}

function lineIsEmptyCalloutBodyPlaceholder(line: string | undefined) {
  if (lineIsEmptyBlockquote(line)) return true;

  const quotedContent = line === undefined ? null : blockquoteLineContent(line);
  return quotedContent?.trim() === "<br />";
}

function emptyBlockquoteLineFor(line: string) {
  const match = /^((?:>\s*)+)/u.exec(lineContentWithoutEnding(line));
  return match?.[1]?.trimEnd() || ">";
}

function collapseEmptyCalloutBodyPlaceholders(markdown: string) {
  const lines = markdown.split("\n");
  const collapsedLines: string[] = [];
  let inCallout = false;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex] ?? "";
    const quotedContent = blockquoteLineContent(line);
    if (quotedContent === null) {
      inCallout = false;
      collapsedLines.push(line);
      continue;
    }

    if (parseMarkdownCalloutMarker(quotedContent)) {
      inCallout = true;
    }

    collapsedLines.push(line);
    if (!inCallout || lineIsEmptyCalloutBodyPlaceholder(line)) continue;

    let placeholderEndLine = lineIndex + 1;
    while (lineIsEmptyCalloutBodyPlaceholder(lines[placeholderEndLine])) {
      placeholderEndLine += 1;
    }

    const placeholderCount = placeholderEndLine - lineIndex - 1;
    const afterPlaceholdersLine = lines[placeholderEndLine];
    const placeholdersAreAtCalloutEnd =
      afterPlaceholdersLine === undefined ||
      afterPlaceholdersLine.length === 0 ||
      blockquoteLineContent(afterPlaceholdersLine) === null;

    if (placeholderCount >= 2 && placeholderCount % 2 === 0 && placeholdersAreAtCalloutEnd) {
      const emptyLine = emptyBlockquoteLineFor(lines[lineIndex + 1] ?? ">");
      for (let count = 0; count < placeholderCount / 2; count += 1) {
        collapsedLines.push(emptyLine);
      }
      lineIndex = placeholderEndLine - 1;
    }
  }

  return collapsedLines.join("\n");
}

export function restoreEscapedMarkdownCalloutMarkers(markdown: string) {
  const restoredMarkers = markdown.replace(
    /(^|\n)((?:>\s*)+)\\(\[!(?:NOTE|TIP|IMPORTANT|WARNING|CAUTION)\])/giu,
    "$1$2$3"
  );
  return collapseEmptyCalloutBodyPlaceholders(
    restoreCalloutHardBreakEscapes(restoredMarkers)
  ).replace(/(^|\n)((?:>\s*)+)<br \/>(?=\n|$)/gu, "$1$2");
}

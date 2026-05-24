import type { Node as ProseNode } from "@milkdown/kit/prose/model";
import type { MarkdownNode } from "@milkdown/kit/transformer";
import { $nodeSchema, $remark } from "@milkdown/kit/utils";
import remarkFrontmatter from "remark-frontmatter";

type MarkraFrontmatterKind = "json" | "toml" | "yaml";

type MarkdownPosition = {
  end?: {
    offset?: number;
  };
  start?: {
    offset?: number;
  };
};

type FrontmatterMarkdownNode = MarkdownNode & {
  kind?: unknown;
  position?: MarkdownPosition;
  value?: unknown;
};

type MarkdownSerializerState = {
  enter: (name: string) => () => unknown;
};

const frontmatterKinds = ["json", "toml", "yaml"] satisfies MarkraFrontmatterKind[];

function frontmatterKindFromValue(value: unknown): MarkraFrontmatterKind {
  return frontmatterKinds.includes(value as MarkraFrontmatterKind) ? value as MarkraFrontmatterKind : "yaml";
}

function findJsonObjectEnd(markdown: string, start: number) {
  let depth = 0;
  let escaped = false;
  let inString = false;

  for (let index = start; index < markdown.length; index += 1) {
    const character = markdown[index];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }

      if (character === "\\") {
        escaped = true;
        continue;
      }

      if (character === "\"") {
        inString = false;
      }
      continue;
    }

    if (character === "\"") {
      inString = true;
      continue;
    }

    if (character === "{") {
      depth += 1;
      continue;
    }

    if (character !== "}") continue;

    depth -= 1;
    if (depth === 0) return index + 1;
  }

  return null;
}

function looksLikeJsonFrontmatter(source: string) {
  const trimmed = source.trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) return false;

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    return Boolean(parsed && typeof parsed === "object" && !Array.isArray(parsed));
  } catch {
    return false;
  }
}

function readLeadingJsonFrontmatter(markdown: string) {
  const start = markdown.charCodeAt(0) === 0xfeff ? 1 : 0;
  if (markdown[start] !== "{") return null;

  const end = findJsonObjectEnd(markdown, start);
  if (end === null) return null;

  let after = end;
  while (markdown[after] === " " || markdown[after] === "\t") after += 1;
  if (after < markdown.length && markdown[after] !== "\n" && markdown[after] !== "\r") return null;

  const source = markdown.slice(start, end);
  if (!looksLikeJsonFrontmatter(source)) return null;

  return {
    end,
    source,
    start
  };
}

function markdownNodeStart(node: FrontmatterMarkdownNode) {
  return node.position?.start?.offset;
}

function markdownNodeEnd(node: FrontmatterMarkdownNode) {
  return node.position?.end?.offset;
}

function transformJsonFrontmatter(tree: MarkdownNode, markdown: string) {
  if (!Array.isArray(tree.children)) return;

  const frontmatter = readLeadingJsonFrontmatter(markdown);
  if (!frontmatter) return;

  let deleteCount = 0;
  let startIndex = -1;

  for (let index = 0; index < tree.children.length; index += 1) {
    const child = tree.children[index] as FrontmatterMarkdownNode;
    const childStart = markdownNodeStart(child);
    const childEnd = markdownNodeEnd(child);
    if (typeof childStart !== "number" || typeof childEnd !== "number") continue;
    if (childEnd <= frontmatter.start) continue;
    if (childStart >= frontmatter.end) break;
    if (childStart < frontmatter.start || childEnd > frontmatter.end) return;

    if (startIndex === -1) startIndex = index;
    deleteCount += 1;
  }

  if (startIndex === -1 || deleteCount === 0) return;

  tree.children.splice(startIndex, deleteCount, {
    kind: "json",
    type: "markraFrontmatter",
    value: frontmatter.source
  });
}

function serializeJsonFrontmatter(node: FrontmatterMarkdownNode, _parent: MarkdownNode | undefined, state: MarkdownSerializerState) {
  const exit = state.enter("markraFrontmatter");
  const value = typeof node.value === "string" ? node.value : "";
  exit();
  return value;
}

function markraFrontmatterRemark(this: { data: () => { toMarkdownExtensions?: unknown[] } }) {
  remarkFrontmatter.call(this, ["yaml", "toml"]);

  const data = this.data();
  if (!Array.isArray(data.toMarkdownExtensions)) {
    data.toMarkdownExtensions = [];
  }

  data.toMarkdownExtensions.push({
    handlers: {
      markraFrontmatter: serializeJsonFrontmatter
    }
  });

  return (tree: unknown, file: { value?: unknown }) => {
    transformJsonFrontmatter(tree as MarkdownNode, String(file.value ?? ""));
  };
}

export const markraFrontmatterRemarkPlugin = $remark<"markraFrontmatterRemark", undefined>(
  "markraFrontmatterRemark",
  () => markraFrontmatterRemark
);

export const markraFrontmatterSchema = $nodeSchema("frontmatter", () => ({
  attrs: {
    kind: {
      default: "yaml",
      validate: "string"
    }
  },
  code: true,
  content: "text*",
  defining: true,
  group: "block",
  marks: "",
  parseDOM: [{
    getAttrs: (dom) => {
      if (!(dom instanceof HTMLElement)) return false;

      return {
        kind: frontmatterKindFromValue(dom.dataset.frontmatterKind)
      };
    },
    preserveWhitespace: "full",
    tag: 'pre[data-type="frontmatter"]'
  }],
  parseMarkdown: {
    match: (node) => ["markraFrontmatter", "toml", "yaml"].includes(String(node.type)),
    runner: (state, node: FrontmatterMarkdownNode, type) => {
      const kind = node.type === "yaml" || node.type === "toml"
        ? node.type
        : frontmatterKindFromValue(node.kind);

      state.openNode(type, { kind });
      if (typeof node.value === "string" && node.value.length > 0) {
        state.addText(node.value);
      }
      state.closeNode();
    }
  },
  toDOM: (node: ProseNode) => {
    const kind = frontmatterKindFromValue(node.attrs.kind);

    return [
      "pre",
      {
        class: "markra-frontmatter",
        "data-frontmatter-kind": kind,
        "data-type": "frontmatter"
      },
      [
        "code",
        {
          "data-frontmatter-kind": kind
        },
        0
      ]
    ];
  },
  toMarkdown: {
    match: (node) => node.type.name === "frontmatter",
    runner: (state, node) => {
      const kind = frontmatterKindFromValue(node.attrs.kind);
      const value = node.textContent;

      if (kind === "json") {
        state.addNode("markraFrontmatter", undefined, value, { kind });
        return;
      }

      state.addNode(kind, undefined, value);
    }
  }
}));

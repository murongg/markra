import ts from "typescript";
import type { Plugin } from "vite";

const supportedScriptPattern = /\.[cm]?[jt]sx?$/i;
const debugCallPattern = /\bdebug\s*\(/;

export function stripDebugStatements(code: string, id: string) {
  if (!supportedScriptPattern.test(id)) return code;
  if (!debugCallPattern.test(code)) return code;

  const sourceFile = ts.createSourceFile(id, code, ts.ScriptTarget.Latest, true, scriptKindForFile(id));
  const ranges: Array<{ end: number; start: number }> = [];

  const visit = (node: ts.Node) => {
    if (isStandaloneDebugStatement(node)) {
      ranges.push({
        end: node.getEnd(),
        start: node.getFullStart()
      });
      return;
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  if (ranges.length === 0) return code;

  let nextCode = "";
  let cursor = 0;
  for (const range of ranges.sort((left, right) => left.start - right.start)) {
    nextCode += code.slice(cursor, range.start);
    cursor = range.end;
  }

  nextCode += code.slice(cursor);
  return nextCode;
}

export function stripDebugPlugin(): Plugin {
  return {
    apply: "build",
    enforce: "pre",
    name: "markra-strip-debug",
    transform(code, id) {
      const strippedCode = stripDebugStatements(code, id);
      if (strippedCode === code) return null;

      return {
        code: strippedCode,
        map: null
      };
    }
  };
}

function isStandaloneDebugStatement(node: ts.Node) {
  if (!ts.isExpressionStatement(node)) return false;
  if (!ts.isCallExpression(node.expression)) return false;
  if (!ts.isIdentifier(node.expression.expression)) return false;

  return node.expression.expression.text === "debug";
}

function scriptKindForFile(id: string) {
  if (id.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (id.endsWith(".jsx")) return ts.ScriptKind.JSX;
  if (id.endsWith(".js") || id.endsWith(".mjs") || id.endsWith(".cjs")) return ts.ScriptKind.JS;

  return ts.ScriptKind.TS;
}

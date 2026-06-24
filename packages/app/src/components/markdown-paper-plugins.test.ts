import type { EditorView } from "@milkdown/kit/prose/view";
import { activeOutlineIndexFromEditorView } from "./markdown-paper-plugins";

type MockDocNode = {
  position: number;
  textContent: string;
  type: { name: string };
};

function mockEditorView(selectionHead: number, nodes: MockDocNode[]) {
  return {
    state: {
      doc: {
        descendants(callback: (node: MockDocNode, position: number) => boolean | undefined) {
          for (const node of nodes) {
            callback(node, node.position);
          }
        }
      },
      selection: {
        head: selectionHead
      }
    }
  } as unknown as EditorView;
}

function heading(position: number, textContent: string): MockDocNode {
  return {
    position,
    textContent,
    type: { name: "heading" }
  };
}

function paragraph(position: number, textContent: string): MockDocNode {
  return {
    position,
    textContent,
    type: { name: "paragraph" }
  };
}

describe("markdown paper plugins", () => {
  it("finds the nearest preceding non-empty outline heading from the cursor", () => {
    const view = mockEditorView(32, [
      paragraph(0, "Preface"),
      heading(10, "Intro"),
      paragraph(18, "Body"),
      heading(40, "Details")
    ]);

    expect(activeOutlineIndexFromEditorView(view)).toBe(0);
  });

  it("ignores empty headings when matching outline indexes", () => {
    const view = mockEditorView(52, [
      heading(0, ""),
      paragraph(4, "Body"),
      heading(20, "Intro"),
      heading(48, "Details")
    ]);

    expect(activeOutlineIndexFromEditorView(view)).toBe(1);
  });

  it("returns null when the cursor is before the first outline heading", () => {
    const view = mockEditorView(6, [
      paragraph(0, "Preface"),
      heading(20, "Intro")
    ]);

    expect(activeOutlineIndexFromEditorView(view)).toBeNull();
  });
});

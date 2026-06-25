import { render } from "@testing-library/react";
import { act } from "react";
import { EditorSelection } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

vi.mock("./MarkdownPaperSurface", () => ({
  MarkdownPaperSurface: () => {
    throw new Promise(() => {});
  }
}));

import { MarkdownPaper } from "./MarkdownPaper";

describe("MarkdownPaper lazy loading", () => {
  it("renders CodeMirror as the default visual editor", () => {
    const { container } = render(
      <MarkdownPaper
        initialContent=""
        onEditorReady={() => {}}
        onMarkdownChange={() => {}}
        revision={0}
      />
    );

    expect(container.querySelector('[data-editor-engine="codemirror"]')).toBeInTheDocument();
    expect(container.querySelector('[data-testid="markdown-codemirror-editor"]')).toBeInTheDocument();
    expect(container.querySelector('[data-editor-engine="milkdown-loading"]')).not.toBeInTheDocument();
  });

  it("keeps the Milkdown shell available when requested", () => {
    const { container } = render(
      <MarkdownPaper
        editorEngine="milkdown"
        initialContent=""
        onEditorReady={() => {}}
        onMarkdownChange={() => {}}
        revision={0}
      />
    );

    expect(container.querySelector('[data-editor-engine="milkdown"]')).toBeInTheDocument();
    expect(container.querySelector('[data-editor-engine="milkdown-loading"]')).toBeInTheDocument();
  });

  it("renders CodeMirror with Typora-like editable bold markers", () => {
    const content = "这是**测试内容**为格式文本的编辑。";
    const handleMarkdownChange = vi.fn();
    const { container } = render(
      <MarkdownPaper
        initialContent={content}
        onEditorReady={() => {}}
        onMarkdownChange={handleMarkdownChange}
        revision={0}
      />
    );
    const shell = container.querySelector<HTMLElement>('[data-testid="markdown-codemirror-editor"]');

    expect(container.querySelector('[data-editor-engine="codemirror"]')).toBeInTheDocument();
    expect(container.querySelector('[data-editor-engine="milkdown-loading"]')).not.toBeInTheDocument();
    expect(shell).toBeInTheDocument();

    const view = EditorView.findFromDOM(shell!);
    if (!view) throw new Error("Expected the CodeMirror visual editor to mount an editor view.");

    const strongText = shell!.querySelector(".markdown-codemirror-strong-text");
    const hiddenMarkers = Array.from(shell!.querySelectorAll(".markdown-codemirror-formatting-marker-hidden"));

    expect(strongText).toHaveTextContent("测试内容");
    expect(hiddenMarkers.map((marker) => marker.textContent)).toEqual(["**", "**"]);

    const openingMarkerStart = content.indexOf("**");
    const closingMarkerEnd = content.lastIndexOf("**") + 2;

    act(() => {
      view.dispatch({ selection: EditorSelection.cursor(openingMarkerStart) });
    });
    expect(view.state.selection.main.head).toBe(openingMarkerStart);

    const activeOpeningMarkers = Array.from(
      shell!.querySelectorAll(".markdown-codemirror-formatting-marker-active")
    );

    expect(activeOpeningMarkers.map((marker) => marker.textContent)).toEqual(["**", "**"]);

    act(() => {
      view.dispatch({ selection: EditorSelection.cursor(closingMarkerEnd) });
    });
    expect(view.state.selection.main.head).toBe(closingMarkerEnd);

    act(() => {
      view.dispatch({
        changes: {
          from: closingMarkerEnd,
          insert: "X"
        }
      });
    });

    expect(view.state.doc.toString()).toBe("这是**测试内容**X为格式文本的编辑。");
    expect(handleMarkdownChange).toHaveBeenLastCalledWith("这是**测试内容**X为格式文本的编辑。");
  });
});

import { renderHook, waitFor } from "@testing-library/react";
import { readNativeMarkdownFile } from "../lib/tauri";
import { workspaceBacklinksForPath, workspaceUnlinkedMentionsForPath } from "../lib/workspace-links";
import { useWorkspaceLinkIndex } from "./useWorkspaceLinkIndex";

vi.mock("../lib/tauri", () => ({
  readNativeMarkdownFile: vi.fn()
}));

const mockedReadNativeMarkdownFile = vi.mocked(readNativeMarkdownFile);

const files = [
  { name: "Alpha.md", path: "/mock-vault/Alpha.md", relativePath: "Alpha.md" },
  { name: "Beta.md", path: "/mock-vault/Beta.md", relativePath: "Beta.md" },
  { name: "Notes.md", path: "/mock-vault/Notes.md", relativePath: "Notes.md" }
];

describe("useWorkspaceLinkIndex", () => {
  beforeEach(() => {
    mockedReadNativeMarkdownFile.mockReset();
    mockedReadNativeMarkdownFile.mockImplementation(async (path) => ({
      content: path.endsWith("Alpha.md")
        ? "# Alpha\n"
        : path.endsWith("Beta.md")
          ? "stale beta"
          : "Alpha mention",
      name: path.split("/").at(-1) ?? "Mock.md",
      path,
      sizeBytes: 10
    }));
  });

  it("builds an index using the current unsaved document content", async () => {
    const { result } = renderHook(() => useWorkspaceLinkIndex({
      documentContent: "See [Alpha](./Alpha.md).\nFresh Alpha mention.",
      documentPath: "/mock-vault/Beta.md",
      fileTreeFiles: files
    }));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockedReadNativeMarkdownFile).not.toHaveBeenCalledWith("/mock-vault/Beta.md");
    expect(workspaceBacklinksForPath(result.current.index, "/mock-vault/Alpha.md").map((link) => ({
      lineNumber: link.lineNumber,
      sourcePath: link.sourceFile.path
    }))).toEqual([
      {
        lineNumber: 1,
        sourcePath: "/mock-vault/Beta.md"
      }
    ]);
    expect(workspaceUnlinkedMentionsForPath(result.current.index, "/mock-vault/Alpha.md").map((mention) => ({
      lineNumber: mention.lineNumber,
      sourcePath: mention.sourceFile.path
    }))).toEqual([
      {
        lineNumber: 2,
        sourcePath: "/mock-vault/Beta.md"
      },
      {
        lineNumber: 1,
        sourcePath: "/mock-vault/Notes.md"
      }
    ]);
  });

  it("does not read workspace files when disabled", () => {
    const { result } = renderHook(() => useWorkspaceLinkIndex({
      documentContent: "See [Alpha](./Alpha.md).",
      documentPath: "/mock-vault/Beta.md",
      enabled: false,
      fileTreeFiles: files
    }));

    expect(result.current.loading).toBe(false);
    expect(result.current.index).toEqual({
      backlinks: [],
      fileCount: 0,
      files: [],
      unlinkedMentions: [],
      unreadableFileCount: 0
    });
    expect(mockedReadNativeMarkdownFile).not.toHaveBeenCalled();
  });
});

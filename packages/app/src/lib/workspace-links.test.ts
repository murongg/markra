import {
  buildWorkspaceLinkIndex,
  workspaceBacklinksForPath,
  workspaceUnlinkedMentionsForPath,
  type WorkspaceLinkFile
} from "./workspace-links";

const files = [
  { name: "Alpha.md", path: "/mock-vault/Alpha.md", relativePath: "Alpha.md" },
  { name: "Beta.md", path: "/mock-vault/Beta.md", relativePath: "Beta.md" },
  { name: "Notes.md", path: "/mock-vault/folder/Notes.md", relativePath: "folder/Notes.md" },
  { name: "asset.png", path: "/mock-vault/asset.png", relativePath: "asset.png", kind: "asset" }
] satisfies WorkspaceLinkFile[];

describe("workspace links", () => {
  it("builds backlinks and unlinked mentions from markdown files", async () => {
    const readFile = vi.fn(async (path: string) => ({
      content: path.endsWith("Alpha.md")
        ? "# Alpha\n\nSource note"
        : path.endsWith("Beta.md")
          ? "stale beta"
          : "Alpha appears here, then [Alpha](../Alpha.md) is linked.",
      path
    }));

    const index = await buildWorkspaceLinkIndex(files, {
      currentDocument: {
        content: "See [Alpha](./Alpha.md).\nFresh Alpha mention.\n`Alpha code`",
        path: "/mock-vault/Beta.md"
      },
      readFile
    });

    expect(readFile).toHaveBeenCalledTimes(2);
    expect(readFile).not.toHaveBeenCalledWith("/mock-vault/Beta.md");
    expect(workspaceBacklinksForPath(index, "/mock-vault/Alpha.md").map((link) => ({
      lineNumber: link.lineNumber,
      relativePath: link.sourceFile.relativePath,
      text: link.text
    }))).toEqual([
      {
        lineNumber: 1,
        relativePath: "Beta.md",
        text: "Alpha"
      },
      {
        lineNumber: 1,
        relativePath: "folder/Notes.md",
        text: "Alpha"
      }
    ]);
    expect(workspaceUnlinkedMentionsForPath(index, "/mock-vault/Alpha.md").map((mention) => ({
      lineNumber: mention.lineNumber,
      relativePath: mention.sourceFile.relativePath,
      text: mention.text
    }))).toEqual([
      {
        lineNumber: 2,
        relativePath: "Beta.md",
        text: "Alpha"
      },
      {
        lineNumber: 1,
        relativePath: "folder/Notes.md",
        text: "Alpha"
      }
    ]);
  });

  it("does not offer unlinked mentions for duplicate titles", async () => {
    const index = await buildWorkspaceLinkIndex([
      { name: "Alpha.md", path: "/mock-vault/Alpha.md", relativePath: "Alpha.md" },
      { name: "nested", path: "/mock-vault/nested", relativePath: "nested", kind: "folder" },
      { name: "Alpha.md", path: "/mock-vault/nested/Alpha.md", relativePath: "nested/Alpha.md" },
      { name: "Note.md", path: "/mock-vault/Note.md", relativePath: "Note.md" }
    ], {
      readFile: async (path) => ({
        content: path.endsWith("Note.md") ? "Alpha appears here." : "",
        path
      })
    });

    expect(workspaceUnlinkedMentionsForPath(index, "/mock-vault/Alpha.md")).toEqual([]);
    expect(workspaceUnlinkedMentionsForPath(index, "/mock-vault/nested/Alpha.md")).toEqual([]);
  });
});

import { act, fireEvent, render, screen } from "@testing-library/react";
import { MarkdownFileTreeDrawer } from "./MarkdownFileTreeDrawer";
import { showNativeMarkdownFileTreeContextMenu } from "../lib/tauri";

vi.mock("../lib/tauri", () => ({
  showNativeMarkdownFileTreeContextMenu: vi.fn()
}));

const mockedShowNativeMarkdownFileTreeContextMenu = vi.mocked(showNativeMarkdownFileTreeContextMenu);

const markdownFiles = [
  { name: "Untitled.md", path: "/vault/Untitled.md", relativePath: "Untitled.md" },
  { name: "AWS.md", path: "/vault/AWS.md", relativePath: "AWS.md" },
  { name: "deploy.md", path: "/vault/deploy/deploy.md", relativePath: "deploy/deploy.md" }
];

describe("MarkdownFileTreeDrawer", () => {
  beforeEach(() => {
    mockedShowNativeMarkdownFileTreeContextMenu.mockReset();
    mockedShowNativeMarkdownFileTreeContextMenu.mockResolvedValue(undefined);
  });

  it("keeps settings fixed in the lower-left", () => {
    const onOpenSettings = vi.fn();
    const { container } = render(
      <MarkdownFileTreeDrawer
        currentPath={null}
        files={[]}
        open={false}
        outlineItems={[]}
        rootName="Obsidian Vault"
        onOpenFile={() => {}}
        onOpenSettings={onOpenSettings}
        onSelectOutlineItem={() => {}}
      />
    );

    const settings = screen.getByRole("button", { name: "Settings" });

    expect(screen.queryByRole("button", { name: "Toggle file list" })).not.toBeInTheDocument();
    expect(settings).toHaveClass("fixed", "bottom-3", "left-3");
    expect(settings).toContainElement(container.querySelector(".lucide-settings"));
    expect(container.querySelector(".markdown-file-tree")).toHaveClass("opacity-0", "-translate-x-4");
    expect(container.querySelector(".markdown-file-tree")).toHaveAttribute("aria-hidden", "true");

    fireEvent.click(settings);

    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });

  it("keeps the drawer header focused on file and outline view controls", () => {
    const { container } = render(
      <MarkdownFileTreeDrawer
        currentPath="/vault/Untitled.md"
        files={markdownFiles}
        open
        outlineItems={[]}
        rootName="Obsidian Vault"
        onOpenFile={() => {}}
        onSelectOutlineItem={() => {}}
      />
    );

    const outlineSwitch = screen.getByRole("button", { name: "Show outline" });

    expect(screen.queryByRole("button", { name: "Toggle file list" })).not.toBeInTheDocument();
    expect(outlineSwitch.closest(".markdown-file-tree")).toBeInTheDocument();
    expect(outlineSwitch).toContainElement(container.querySelector(".lucide-table-of-contents"));
  });

  it("places the Windows sidebar toggle at the lower drawer edge", () => {
    const toggleMarkdownFiles = vi.fn();
    const { container } = render(
      <MarkdownFileTreeDrawer
        currentPath="/vault/Untitled.md"
        files={markdownFiles}
        open
        outlineItems={[]}
        platform="windows"
        rootName="Obsidian Vault"
        width={288}
        onOpenFile={() => {}}
        onToggleMarkdownFiles={toggleMarkdownFiles}
        onSelectOutlineItem={() => {}}
      />
    );

    const toggle = screen.getByRole("button", { name: "Toggle file list" });

    expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect(toggle).toHaveClass("fixed", "bottom-3");
    expect(toggle).toHaveStyle({ left: "300px" });
    expect(toggle).toContainElement(container.querySelector(".lucide-panel-left"));
    expect(container.querySelector(".markdown-file-tree")).toHaveClass("pt-0");
    expect(container.querySelector(".markdown-file-tree")).not.toHaveClass("pt-10");

    fireEvent.click(toggle);

    expect(toggleMarkdownFiles).toHaveBeenCalledTimes(1);
  });

  it("keeps the resize handle below the Windows titlebar tab strip", () => {
    const { container } = render(
      <MarkdownFileTreeDrawer
        currentPath={null}
        files={[]}
        open
        outlineItems={[]}
        platform="windows"
        rootName="Obsidian Vault"
        width={288}
        onOpenFile={() => {}}
        onResize={() => {}}
        onSelectOutlineItem={() => {}}
      />
    );

    expect(container.querySelector(".markdown-file-tree-resizer")).toHaveClass("top-10", "bottom-0");
  });

  it("keeps the Windows sidebar toggle reachable when the drawer is collapsed", () => {
    const toggleMarkdownFiles = vi.fn();
    const { container } = render(
      <MarkdownFileTreeDrawer
        currentPath={null}
        files={[]}
        open={false}
        outlineItems={[]}
        platform="windows"
        rootName="Obsidian Vault"
        width={288}
        onOpenFile={() => {}}
        onToggleMarkdownFiles={toggleMarkdownFiles}
        onSelectOutlineItem={() => {}}
      />
    );

    const toggle = screen.getByRole("button", { name: "Toggle file list" });

    expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(toggle).toHaveStyle({ left: "48px" });
    expect(toggle).toContainElement(container.querySelector(".lucide-panel-right"));
  });

  it("renders a folder-style markdown file tree with folders collapsed by default", () => {
    const openFile = vi.fn();
    const { container } = render(
      <MarkdownFileTreeDrawer
        currentPath="/vault/Untitled.md"
        files={markdownFiles}
        open
        outlineItems={[]}
        rootName="Obsidian Vault"
        onOpenFile={openFile}
        onSelectOutlineItem={() => {}}
      />
    );

    const sidebar = screen.getByRole("complementary", { name: "Markdown file tree" });
    const folder = screen.getByRole("button", { name: "deploy" });

    expect(sidebar).toBeInTheDocument();
    expect(sidebar).not.toHaveClass("fixed");
    expect(sidebar).toHaveClass("transition-[transform,opacity]", "translate-x-0", "opacity-100");
    expect(sidebar).toHaveClass("bg-(--bg-secondary)");
    expect(screen.getByText("Files")).toBeInTheDocument();
    expect(screen.getByText("Obsidian Vault")).toBeInTheDocument();
    expect(folder).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("button", { name: "deploy/deploy.md" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Untitled.md" })).toHaveClass("aria-[current=page]:border-l-[3px]");
    expect(screen.getByRole("button", { name: "Untitled.md" })).toHaveAttribute("aria-current", "page");
    expect(container.querySelector('[role="tree"]')).toBeInTheDocument();

    fireEvent.click(folder);
    fireEvent.click(screen.getByRole("button", { name: "deploy/deploy.md" }));

    expect(openFile).toHaveBeenCalledWith(markdownFiles[2]);
  });

  it("opens image assets from the file tree and supports renaming them", () => {
    const openFile = vi.fn();
    const renameFile = vi.fn();
    const asset = {
      kind: "asset" as const,
      name: "pasted-image.png",
      path: "/vault/assets/pasted-image.png",
      relativePath: "assets/pasted-image.png"
    };
    const { container } = render(
      <MarkdownFileTreeDrawer
        currentPath="/vault/Untitled.md"
        files={[
          ...markdownFiles,
          { kind: "folder", name: "assets", path: "/vault/assets", relativePath: "assets" },
          asset
        ]}
        open
        outlineItems={[]}
        rootName="Obsidian Vault"
        onOpenFile={openFile}
        onRenameFile={renameFile}
        onSelectOutlineItem={() => {}}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "assets" }));

    const assetButton = screen.getByRole("button", { name: "assets/pasted-image.png" });
    expect(assetButton).toContainElement(container.querySelector(".lucide-image"));

    fireEvent.click(assetButton);
    fireEvent.contextMenu(assetButton);

    expect(openFile).toHaveBeenCalledWith(asset);
    expect(mockedShowNativeMarkdownFileTreeContextMenu).toHaveBeenCalledWith(expect.anything(), "en", asset);

    const contextHandlers = mockedShowNativeMarkdownFileTreeContextMenu.mock.calls[0]?.[0];
    act(() => {
      contextHandlers?.renameFile?.(asset);
    });

    const renameInput = screen.getByRole("textbox", { name: "Rename file" });
    fireEvent.change(renameInput, { target: { value: "renamed-image.png" } });
    fireEvent.keyDown(renameInput, { key: "Enter" });

    expect(renameFile).toHaveBeenCalledWith(asset, "renamed-image.png");
  });

  it("supports creating and renaming markdown files from the file tree", () => {
    const createFile = vi.fn();
    const createFolder = vi.fn();
    const renameFile = vi.fn();

    render(
      <MarkdownFileTreeDrawer
        currentPath="/vault/Untitled.md"
        files={markdownFiles}
        open
        outlineItems={[]}
        rootName="Obsidian Vault"
        onCreateFile={createFile}
        onCreateFolder={createFolder}
        onOpenFile={() => {}}
        onRenameFile={renameFile}
        onSelectOutlineItem={() => {}}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "New file" }));
    const newFileInput = screen.getByRole("textbox", { name: "New file name" });
    fireEvent.change(newFileInput, { target: { value: "Daily note" } });
    fireEvent.keyDown(newFileInput, { key: "Enter" });

    expect(createFile).toHaveBeenCalledWith("Daily note");

    fireEvent.contextMenu(screen.getByRole("button", { name: "Untitled.md" }));
    const contextHandlers = mockedShowNativeMarkdownFileTreeContextMenu.mock.calls[0]?.[0];
    act(() => {
      contextHandlers?.renameFile?.(markdownFiles[0]);
    });

    const renameInput = screen.getByRole("textbox", { name: "Rename file" });
    fireEvent.change(renameInput, { target: { value: "Renamed.md" } });
    fireEvent.keyDown(renameInput, { key: "Enter" });

    expect(renameFile).toHaveBeenCalledWith(markdownFiles[0], "Renamed.md");
  });

  it("cancels the rename input when the blank file tree area is clicked", () => {
    const renameFile = vi.fn();

    const { container } = render(
      <MarkdownFileTreeDrawer
        currentPath="/vault/Untitled.md"
        files={markdownFiles}
        open
        outlineItems={[]}
        rootName="Obsidian Vault"
        onOpenFile={() => {}}
        onRenameFile={renameFile}
        onSelectOutlineItem={() => {}}
      />
    );

    fireEvent.contextMenu(screen.getByRole("button", { name: "Untitled.md" }));
    const contextHandlers = mockedShowNativeMarkdownFileTreeContextMenu.mock.calls[0]?.[0];
    act(() => {
      contextHandlers?.renameFile?.(markdownFiles[0]);
    });

    expect(screen.getByRole("textbox", { name: "Rename file" })).toBeInTheDocument();

    fireEvent.mouseDown(container.querySelector(".file-tree-scroll") as HTMLElement);

    expect(screen.queryByRole("textbox", { name: "Rename file" })).not.toBeInTheDocument();
    expect(renameFile).not.toHaveBeenCalled();
  });

  it("opens the blank file tree area context menu and creates folders", () => {
    const createFolder = vi.fn();

    const { container } = render(
      <MarkdownFileTreeDrawer
        currentPath="/vault/Untitled.md"
        files={markdownFiles}
        open
        outlineItems={[]}
        rootName="Obsidian Vault"
        onCreateFolder={createFolder}
        onOpenFile={() => {}}
        onSelectOutlineItem={() => {}}
      />
    );

    fireEvent.contextMenu(container.querySelector(".file-tree-scroll") as HTMLElement);

    expect(mockedShowNativeMarkdownFileTreeContextMenu).toHaveBeenCalledWith(
      expect.objectContaining({
        createFile: expect.any(Function),
        createFolder: expect.any(Function)
      }),
      "en",
      undefined
    );

    const contextHandlers = mockedShowNativeMarkdownFileTreeContextMenu.mock.calls[0]?.[0];
    act(() => {
      contextHandlers?.createFolder?.();
    });

    const newFolderInput = screen.getByRole("textbox", { name: "New folder name" });
    fireEvent.change(newFolderInput, { target: { value: "Research" } });
    fireEvent.keyDown(newFolderInput, { key: "Enter" });

    expect(createFolder).toHaveBeenCalledWith("Research");
  });

  it("opens native context menus for root and markdown files", () => {
    const deleteFile = vi.fn();

    render(
      <MarkdownFileTreeDrawer
        currentPath="/vault/Untitled.md"
        files={markdownFiles}
        open
        outlineItems={[]}
        rootName="Obsidian Vault"
        onDeleteFile={deleteFile}
        onOpenFile={() => {}}
        onSelectOutlineItem={() => {}}
      />
    );

    fireEvent.contextMenu(screen.getByText("Obsidian Vault"));
    expect(mockedShowNativeMarkdownFileTreeContextMenu).toHaveBeenCalledWith(
      expect.objectContaining({
        createFile: expect.any(Function),
        createFolder: expect.any(Function)
      }),
      "en",
      undefined
    );

    fireEvent.contextMenu(screen.getByRole("button", { name: "Untitled.md" }));
    expect(mockedShowNativeMarkdownFileTreeContextMenu).toHaveBeenLastCalledWith(
      expect.objectContaining({
        createFile: expect.any(Function),
        createFolder: expect.any(Function),
        deleteFile: expect.any(Function),
        renameFile: expect.any(Function)
      }),
      "en",
      markdownFiles[0]
    );

    const contextHandlers = mockedShowNativeMarkdownFileTreeContextMenu.mock.calls.at(-1)?.[0];
    contextHandlers?.deleteFile?.(markdownFiles[0]);

    expect(deleteFile).toHaveBeenCalledWith(markdownFiles[0]);
  });

  it("keeps child branches visually connected when a folder is expanded", () => {
    render(
      <MarkdownFileTreeDrawer
        currentPath="/vault/Untitled.md"
        files={markdownFiles}
        open
        outlineItems={[]}
        rootName="Obsidian Vault"
        onOpenFile={() => {}}
        onSelectOutlineItem={() => {}}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "deploy" }));

    expect(screen.getByRole("group", { name: "deploy children" })).toHaveClass("border-l");
  });

  it("keeps nested files visually deeper than their parent folder", () => {
    render(
      <MarkdownFileTreeDrawer
        currentPath="/vault/Untitled.md"
        files={markdownFiles}
        open
        outlineItems={[]}
        rootName="Obsidian Vault"
        onOpenFile={() => {}}
        onSelectOutlineItem={() => {}}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "deploy" }));

    expect(screen.getByRole("button", { name: "deploy/deploy.md" })).toHaveClass("pl-8");
  });

  it("uses semantic icons when switching between file and outline views", () => {
    const selectOutlineItem = vi.fn();
    const { container } = render(
      <MarkdownFileTreeDrawer
        currentPath="/vault/Untitled.md"
        files={markdownFiles}
        open
        outlineItems={[
          { level: 1, title: "Intro" },
          { level: 2, title: "Details" }
        ]}
        rootName="Obsidian Vault"
        onOpenFile={() => {}}
        onSelectOutlineItem={selectOutlineItem}
      />
    );

    const outlineSwitch = screen.getByRole("button", { name: "Show outline" });

    expect(outlineSwitch).toContainElement(container.querySelector(".lucide-table-of-contents"));

    fireEvent.click(outlineSwitch);

    const filesSwitch = screen.getByRole("button", { name: "Show files" });

    expect(filesSwitch).toContainElement(container.querySelector(".lucide-folder-tree"));
    expect(screen.getByText("Outline")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Document outline" })).toBeInTheDocument();
    expect(screen.getByText("Intro")).toBeInTheDocument();
    expect(screen.getByText("Details")).toBeInTheDocument();
    expect(screen.queryByText("Obsidian Vault")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Details" }));

    expect(selectOutlineItem).toHaveBeenCalledWith({ level: 2, title: "Details" }, 1);
  });

  it("uses the drawer top-left button to switch between file and outline views", () => {
    const selectOutlineItem = vi.fn();

    render(
      <MarkdownFileTreeDrawer
        currentPath="/vault/Untitled.md"
        files={markdownFiles}
        open
        outlineItems={[
          { level: 1, title: "Intro" },
          { level: 2, title: "Details" }
        ]}
        rootName="Obsidian Vault"
        onOpenFile={() => {}}
        onSelectOutlineItem={selectOutlineItem}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Show outline" }));
    fireEvent.click(screen.getByRole("button", { name: "Details" }));

    expect(screen.getByText("Outline")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Document outline" })).toBeInTheDocument();
    expect(screen.getByText("Intro")).toBeInTheDocument();
    expect(screen.getByText("Details")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show files" })).toBeInTheDocument();
    expect(screen.queryByText("Obsidian Vault")).not.toBeInTheDocument();
    expect(selectOutlineItem).toHaveBeenCalledWith({ level: 2, title: "Details" }, 1);
  });

  it("keeps outline clicks from stealing focus before navigation runs", () => {
    render(
      <MarkdownFileTreeDrawer
        currentPath="/vault/Untitled.md"
        files={markdownFiles}
        open
        outlineItems={[{ level: 1, title: "A" }]}
        rootName="Obsidian Vault"
        onOpenFile={() => {}}
        onSelectOutlineItem={() => {}}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Show outline" }));

    const mouseDown = new MouseEvent("mousedown", { bubbles: true, cancelable: true });
    screen.getByRole("button", { name: "A" }).dispatchEvent(mouseDown);

    expect(mouseDown.defaultPrevented).toBe(true);
  });
});

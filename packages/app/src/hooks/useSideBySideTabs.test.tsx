import { act, renderHook, waitFor } from "@testing-library/react";
import { useSideBySideTabs } from "./useSideBySideTabs";
import type { MarkdownTabsBarDocumentItem } from "../components/MarkdownTabsBar";
import type { MarkdownDocumentTab } from "./useMarkdownDocument";

function documentTab(id: string, path: string): MarkdownDocumentTab {
  return {
    content: `# ${path}`,
    dirty: false,
    id,
    name: path.split("/").at(-1) ?? path,
    open: true,
    revision: 0,
    path
  };
}

describe("useSideBySideTabs", () => {
  const firstTab = documentTab("file:/vault/1.md", "/vault/1.md");
  const secondTab = documentTab("file:/vault/2.md", "/vault/2.md");

  const baseOptions = {
    activeImageFileOpen: false,
    activeTabId: firstTab.id,
    documentTabs: [firstTab, secondTab],
    hasOpenDocument: true,
    loadStoredWorkspaceState: vi.fn(),
    persistSideDocumentGroup: vi.fn(),
    restoreReady: true,
    restoreWorkspaceOnStartup: true,
    titlebarTabs: [firstTab, secondTab] satisfies MarkdownTabsBarDocumentItem[]
  };

  it("does not read a saved side-by-side group when document tabs are disabled", () => {
    const loadStoredWorkspaceState = vi.fn(async () => ({
      openFilePaths: [firstTab.path!, secondTab.path!],
      sideBySideGroup: {
        primaryFilePath: firstTab.path!,
        sideFilePath: secondTab.path!
      }
    }));

    const { result } = renderHook(() =>
      useSideBySideTabs({
        ...baseOptions,
        documentTabsEnabled: false,
        loadStoredWorkspaceState
      })
    );

    expect(loadStoredWorkspaceState).not.toHaveBeenCalled();
    expect(result.current.sideDocumentGroup).toBeNull();
    expect(result.current.sideDocumentOpen).toBe(false);
  });

  it("restores a saved side-by-side group only when document tabs are enabled", async () => {
    const loadStoredWorkspaceState = vi.fn(async () => ({
      openFilePaths: [firstTab.path!, secondTab.path!],
      sideBySideGroup: {
        primaryFilePath: firstTab.path!,
        sideFilePath: secondTab.path!
      }
    }));

    const { result } = renderHook(() =>
      useSideBySideTabs({
        ...baseOptions,
        documentTabsEnabled: true,
        loadStoredWorkspaceState
      })
    );

    await waitFor(() =>
      expect(result.current.sideDocumentGroup).toEqual({
        primaryTabId: firstTab.id,
        sideTabId: secondTab.id
      })
    );
    expect(result.current.sideDocumentOpen).toBe(true);
    expect(loadStoredWorkspaceState).toHaveBeenCalledTimes(1);
  });

  it("persists side-by-side paths when a containing folder moves", () => {
    const persistSideDocumentGroup = vi.fn();
    const docsTab = documentTab("file:/vault/docs/1.md", "/vault/docs/1.md");
    const nestedTab = documentTab("file:/vault/docs/nested/2.md", "/vault/docs/nested/2.md");
    const { result } = renderHook(() =>
      useSideBySideTabs({
        ...baseOptions,
        documentTabs: [docsTab, nestedTab],
        documentTabsEnabled: true,
        loadStoredWorkspaceState: vi.fn(async () => ({
          openFilePaths: [],
          sideBySideGroup: null
        })),
        persistSideDocumentGroup,
        titlebarTabs: [docsTab, nestedTab]
      })
    );

    act(() => {
      result.current.openSideDocumentGroup({
        primaryFilePath: docsTab.path,
        primaryTabId: docsTab.id,
        sideFilePath: nestedTab.path,
        sideTabId: nestedTab.id
      });
    });

    act(() => {
      result.current.persistSideDocumentGroupPathUpdate({
        previousPath: "/vault/docs",
        nextPath: "/vault/archive/docs"
      });
    });

    expect(persistSideDocumentGroup).toHaveBeenLastCalledWith({
      primaryFilePath: "/vault/archive/docs/1.md",
      sideFilePath: "/vault/archive/docs/nested/2.md"
    });
  });
});

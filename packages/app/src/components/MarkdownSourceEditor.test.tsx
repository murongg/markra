import { fireEvent, render, screen } from "@testing-library/react";
import { MarkdownSourceEditor } from "./MarkdownSourceEditor";

describe("MarkdownSourceEditor", () => {
  it("renders editable markdown with source highlighting", () => {
    const content = [
      "# Title",
      "",
      "```ts",
      "const answer = 42;",
      "```",
      "- Item"
    ].join("\n");
    const handleChange = vi.fn();

    const { container } = render(
      <MarkdownSourceEditor
        content={content}
        onChange={handleChange}
      />
    );

    expect(screen.getByRole("textbox", { name: "Markdown source" })).toHaveValue(content);
    expect(container.querySelector(".markdown-source-highlight")).toHaveTextContent("const answer = 42;");
    expect(container.querySelector(".markdown-source-token-heading-marker")).toHaveTextContent("#");
    expect(container.querySelector(".markdown-source-token-code-fence")).toHaveTextContent("```");
    expect(container.querySelector(".markdown-source-token-code")).toHaveTextContent("const answer = 42;");
    expect(container.querySelector(".markdown-source-token-list-marker")).toHaveTextContent("-");

    fireEvent.change(screen.getByRole("textbox", { name: "Markdown source" }), {
      target: {
        value: "# Changed"
      }
    });

    expect(handleChange).toHaveBeenCalledWith("# Changed");
  });

  it("highlights GitHub-style alert markers in source mode", () => {
    const content = "> [!TIP]\n> Keep notes portable.";

    const { container } = render(
      <MarkdownSourceEditor
        content={content}
        onChange={() => {}}
      />
    );

    expect(container.querySelector(".markdown-source-token-callout")).toHaveTextContent("[!TIP]");
    expect(container.querySelector(".markdown-source-token-quote-marker")).toHaveTextContent(">");
  });

  it("leaves GitHub-style alert markers plain when the extension is disabled", () => {
    const content = "> [!TIP]\n> Keep notes portable.";

    const { container } = render(
      <MarkdownSourceEditor
        content={content}
        extendedSyntax={{
          githubAlerts: false,
          highlight: true
        }}
        onChange={() => {}}
      />
    );

    expect(container.querySelector(".markdown-source-token-callout")).not.toBeInTheDocument();
    expect(container.querySelector(".markdown-source-token-quote-marker")).toHaveTextContent(">");
  });

  it("renders exact search highlights in source mode", () => {
    const { container } = render(
      <MarkdownSourceEditor
        content="alpha, beta，gamma"
        searchMatches={[{ from: 5, to: 6 }]}
        searchActiveIndex={0}
        onChange={() => {}}
      />
    );

    expect(container.querySelector(".markra-source-search-match")).toHaveTextContent(",");
    expect(container.querySelector(".markra-source-search-match-current")).toHaveTextContent(",");
    expect(container.querySelector(".markra-source-search-match")).not.toHaveTextContent("，");
  });
});

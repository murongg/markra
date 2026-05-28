import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type AiMarkdownMessageProps = {
  className?: string;
  content: string;
};

export function AiMarkdownMessage({ className = "", content }: AiMarkdownMessageProps) {
  return (
    <div className={`ai-chat-markdown markdown-paper min-w-0 ${className}`.trim()}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ node: _node, ...props }) => <a {...props} rel="noreferrer" target="_blank" />,
          p: ({ node: _node, ...props }) => <p {...props} />
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

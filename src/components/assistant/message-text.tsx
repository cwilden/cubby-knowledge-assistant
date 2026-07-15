import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function safeExternalUrl(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  try {
    const url = new URL(value);

    if (url.protocol === "http:" || url.protocol === "https:") {
      return url.toString();
    }
  } catch {
    return undefined;
  }
}

export function MessageText({ text }: { text: string }) {
  return (
    <div className="space-y-3 text-base leading-7 text-[#2f344a] [overflow-wrap:anywhere]">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a({ children, href }) {
            const safeHref = safeExternalUrl(href);

            if (!safeHref) {
              return <span>{children}</span>;
            }

            return (
              <a
                href={safeHref}
                target="_blank"
                rel="noreferrer"
                className="cursor-pointer font-medium text-[#4b9dcc] underline decoration-[#61b3e4] underline-offset-4 transition hover:text-[#2f6f9d]"
              >
                {children}
              </a>
            );
          },
          li({ children }) {
            return <li className="pl-1">{children}</li>;
          },
          ol({ children }) {
            return (
              <ol className="ml-5 list-decimal space-y-1.5 marker:text-[#7e879b]">
                {children}
              </ol>
            );
          },
          p({ children }) {
            return <p>{children}</p>;
          },
          strong({ children }) {
            return <strong className="font-semibold text-[#444963]">{children}</strong>;
          },
          ul({ children }) {
            return (
              <ul className="ml-5 list-disc space-y-1.5 marker:text-[#7e879b]">
                {children}
              </ul>
            );
          },
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

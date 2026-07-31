import ReactMarkdown, { defaultUrlTransform, type Components } from "react-markdown"
import remarkGfm from "remark-gfm"
import { cn } from "@/lib/cn"

// Shared markdown renderer for user-written long text (deal and task descriptions) and the
// AI chat. react-markdown builds a React tree, nothing is injected as raw HTML. Callers may
// override components (e.g. the chat swaps `a` for inline entity chips) and the url
// transform (to pass a reserved chip scheme through react-markdown's sanitizer).
export function Markdown({
  text,
  className,
  components,
  urlTransform,
}: {
  text: string
  className?: string
  components?: Components
  urlTransform?: (url: string) => string
}) {
  return (
    <div className={cn("flex flex-col gap-2 text-[13px] leading-relaxed text-foreground", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        urlTransform={urlTransform ?? defaultUrlTransform}
        components={{
          h1: ({ children }) => <h3 className="text-[15px] font-semibold">{children}</h3>,
          h2: ({ children }) => <h4 className="text-sm font-semibold">{children}</h4>,
          h3: ({ children }) => <h5 className="text-[13px] font-semibold">{children}</h5>,
          p: ({ children }) => <p className="whitespace-pre-wrap">{children}</p>,
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="cursor-pointer text-primary underline-offset-2 hover:underline"
            >
              {children}
            </a>
          ),
          ul: ({ children }) => <ul className="flex list-disc flex-col gap-1 pl-5">{children}</ul>,
          ol: ({ children }) => (
            <ol className="flex list-decimal flex-col gap-1 pl-5">{children}</ol>
          ),
          li: ({ children }) => <li className="[&>p]:inline">{children}</li>,
          code: ({ children, className: codeClassName }) =>
            codeClassName !== undefined ? (
              <code className="block overflow-x-auto rounded-lg bg-surface-2 px-3 py-2 font-mono text-xs">
                {children}
              </code>
            ) : (
              <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-xs">{children}</code>
            ),
          pre: ({ children }) => <pre className="my-1">{children}</pre>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-border-strong/50 pl-3 text-muted">
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-[13px]">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border-b border-border-strong/40 px-2 py-1 font-medium">{children}</th>
          ),
          td: ({ children }) => <td className="border-b border-hairline px-2 py-1">{children}</td>,
          hr: () => <hr className="border-hairline" />,
          ...components,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  )
}

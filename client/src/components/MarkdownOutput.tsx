import ReactMarkdown from 'react-markdown';

interface Props {
  content: string;
  className?: string;
  streaming?: boolean;
}

export default function MarkdownOutput({ content, className = '', streaming }: Props) {
  return (
    <div className={`font-mono text-sm text-army-text leading-relaxed ${className}`}>
      <ReactMarkdown
        components={{
          h1: ({ children }) => <div className="font-bold text-army-gold text-base mb-2 mt-4 first:mt-0 tracking-wide uppercase">{children}</div>,
          h2: ({ children }) => <div className="font-bold text-army-gold text-sm mb-2 mt-4 first:mt-0 tracking-wider uppercase">{children}</div>,
          h3: ({ children }) => <div className="font-bold text-army-tan text-sm mb-1.5 mt-3 first:mt-0">{children}</div>,
          p:  ({ children }) => <div className="mb-2 last:mb-0">{children}</div>,
          ul: ({ children }) => <ul className="list-disc list-inside space-y-1 mb-2 pl-2">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 mb-2 pl-2">{children}</ol>,
          li: ({ children }) => <li className="text-army-text">{children}</li>,
          strong: ({ children }) => <span className="font-bold text-army-text">{children}</span>,
          em: ({ children }) => <span className="italic text-army-muted">{children}</span>,
          code: ({ children }) => <code className="bg-bg px-1 py-0.5 text-army-gold text-xs">{children}</code>,
          blockquote: ({ children }) => <div className="border-l-2 border-army-tan pl-3 text-army-muted my-2 italic">{children}</div>,
          hr: () => <div className="border-t border-border my-4" />,
          table: ({ children }) => <div className="overflow-x-auto my-3"><table className="w-full text-xs border-collapse">{children}</table></div>,
          thead: ({ children }) => <thead className="border-b border-border">{children}</thead>,
          th: ({ children }) => <th className="text-left px-3 py-1.5 text-[10px] tracking-widest text-army-muted uppercase">{children}</th>,
          td: ({ children }) => <td className="px-3 py-1.5 border-b border-border">{children}</td>,
        }}
      >
        {content}
      </ReactMarkdown>
      {streaming && (
        <span className="inline-block w-2 h-4 bg-army-gold ml-1 animate-pulse align-text-bottom" />
      )}
    </div>
  );
}

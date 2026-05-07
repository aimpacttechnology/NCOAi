import ReactMarkdown from 'react-markdown';

interface Props {
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
}

export default function ChatMessage({ role, content, streaming }: Props) {
  const isUser = role === 'user';

  return (
    <div className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="flex-shrink-0 w-8 h-8 bg-army-tan flex items-center justify-center font-mono text-xs font-bold text-bg">
          SGM
        </div>
      )}

      <div
        className={`max-w-[75%] p-3 font-mono text-sm leading-relaxed ${
          isUser
            ? 'bg-[#21262d] text-army-text border border-border whitespace-pre-wrap'
            : 'bg-surface border border-army-tan text-army-text'
        }`}
      >
        {isUser ? content : (
          <ReactMarkdown
            components={{
              h1: ({ children }) => <div className="font-bold text-army-gold text-base mb-2">{children}</div>,
              h2: ({ children }) => <div className="font-bold text-army-gold text-sm mb-1.5 mt-3">{children}</div>,
              h3: ({ children }) => <div className="font-bold text-army-tan text-sm mb-1 mt-2">{children}</div>,
              p:  ({ children }) => <div className="mb-2 last:mb-0">{children}</div>,
              ul: ({ children }) => <ul className="list-disc list-inside space-y-0.5 mb-2 pl-2">{children}</ul>,
              ol: ({ children }) => <ol className="list-decimal list-inside space-y-0.5 mb-2 pl-2">{children}</ol>,
              li: ({ children }) => <li className="text-army-text">{children}</li>,
              strong: ({ children }) => <span className="font-bold text-army-text">{children}</span>,
              em: ({ children }) => <span className="italic text-army-muted">{children}</span>,
              code: ({ children }) => <code className="bg-bg px-1 py-0.5 text-army-gold text-xs">{children}</code>,
              blockquote: ({ children }) => <div className="border-l-2 border-army-tan pl-3 text-army-muted my-2">{children}</div>,
              hr: () => <div className="border-t border-border my-3" />,
            }}
          >
            {content}
          </ReactMarkdown>
        )}
        {streaming && (
          <span className="inline-block w-2 h-4 bg-army-gold ml-1 animate-pulse align-text-bottom" />
        )}
      </div>

      {isUser && (
        <div className="flex-shrink-0 w-8 h-8 bg-[#21262d] border border-border flex items-center justify-center font-mono text-xs font-bold text-army-muted">
          NCO
        </div>
      )}
    </div>
  );
}

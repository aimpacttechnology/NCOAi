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
        className={`max-w-[75%] p-3 font-mono text-sm leading-relaxed whitespace-pre-wrap ${
          isUser
            ? 'bg-[#21262d] text-army-text border border-border'
            : 'bg-surface border border-army-tan text-army-text'
        }`}
      >
        {content}
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

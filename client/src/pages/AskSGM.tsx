import { useEffect, useRef, useState } from 'react';
import { askSGM } from '../lib/api';
import ChatMessage from '../components/ChatMessage';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const STARTERS = [
  'What does AR 600-20 say about NCO authority?',
  'How do I counsel a soldier who keeps missing formation?',
  'What are the FM 6-22 attributes of a good leader?',
  'When is a relief for cause NCOER warranted?',
];

export default function AskSGM() {
  const [history, setHistory] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  const send = async (message: string) => {
    const trimmed = message.trim();
    if (!trimmed || streaming) return;

    setError('');
    setInput('');

    const userMsg: Message = { role: 'user', content: trimmed };
    const assistantMsg: Message = { role: 'assistant', content: '' };

    setHistory(h => [...h, userMsg, assistantMsg]);
    setStreaming(true);

    try {
      await askSGM(
        { message: trimmed, history },
        chunk => {
          setHistory(h => {
            const updated = [...h];
            updated[updated.length - 1] = {
              ...updated[updated.length - 1],
              content: updated[updated.length - 1].content + chunk,
            };
            return updated;
          });
        }
      );
    } catch {
      setError('Failed to reach the SGM. Check your server connection.');
      setHistory(h => h.slice(0, -1));
    } finally {
      setStreaming(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 px-8 py-5 border-b border-border bg-surface">
        <div className="font-mono text-[10px] tracking-widest text-army-muted uppercase mb-0.5">AI-Powered Doctrine Advisor</div>
        <div className="font-mono text-lg font-bold text-army-gold">Ask the SGM</div>
        <div className="font-mono text-xs text-army-muted mt-0.5">
          Doctrine citations · AR/FM references · Practical NCO guidance
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-8 py-6 space-y-4">
        {history.length === 0 && (
          <div className="space-y-6">
            <div className="text-center py-8">
              <div className="font-mono text-army-gold text-4xl mb-3">◇</div>
              <div className="font-mono text-army-text text-sm">
                Ask me anything about Army doctrine, regulations, or leadership.
              </div>
              <div className="font-mono text-army-muted text-xs mt-1">
                I cite my sources and never guess at regulations.
              </div>
            </div>

            <div>
              <div className="font-mono text-[10px] tracking-widest text-army-muted uppercase mb-3">
                Try asking:
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {STARTERS.map(s => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="text-left bg-surface border border-border hover:border-army-tan px-4 py-3 font-mono text-xs text-army-muted hover:text-army-text transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {history.map((msg, i) => (
          <ChatMessage
            key={i}
            role={msg.role}
            content={msg.content}
            streaming={streaming && i === history.length - 1 && msg.role === 'assistant'}
          />
        ))}

        {error && (
          <div className="bg-[#1f0e0d] border border-danger px-4 py-2 font-mono text-xs text-danger">
            {error}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 border-t border-border bg-surface px-8 py-4">
        <div className="flex gap-3 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            disabled={streaming}
            rows={2}
            className="flex-1 bg-bg border border-border px-4 py-3 font-mono text-sm text-army-text placeholder-army-muted focus:outline-none focus:border-army-tan resize-none disabled:opacity-50"
            placeholder="Ask a doctrine or leadership question... (Enter to send, Shift+Enter for newline)"
          />
          <button
            onClick={() => send(input)}
            disabled={!input.trim() || streaming}
            className="bg-army-tan hover:bg-[#9e8562] disabled:opacity-40 disabled:cursor-not-allowed text-army-text font-mono text-xs tracking-widest uppercase px-5 py-3 h-full transition-colors"
          >
            {streaming ? '...' : 'SEND'}
          </button>
        </div>
        <div className="font-mono text-[10px] text-army-muted mt-2">
          AI responses may contain errors. Always verify against official Army publications.
        </div>
      </div>
    </div>
  );
}

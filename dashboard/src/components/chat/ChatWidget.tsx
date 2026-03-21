import { useMemo, useState } from 'react';
import { MessageSquare, Send, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { sendAiChatMessage } from '../../services/ai-chat.service';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { cn } from '../../lib/utils';

type ChatRole = 'user' | 'assistant';

interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
}

const QUICK_QUESTIONS = ['Why did my last task fail?', 'System Health?'] as const;

function createMessage(role: ChatRole, content: string): ChatMessage {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    content,
  };
}

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    createMessage('assistant', 'ZenFlow Ops Assistant online. Ask about logs, failures, and system health.'),
  ]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);

  const canSend = input.trim().length > 0 && !isSending;

  const visibleMessages = useMemo(() => messages.slice(-30), [messages]);

  async function submitMessage(rawMessage: string): Promise<void> {
    const message = rawMessage.trim();
    if (!message || isSending) {
      return;
    }

    setIsSending(true);
    setMessages((prev) => [...prev, createMessage('user', message)]);
    setInput('');

    try {
      const answer = await sendAiChatMessage(message);
      setMessages((prev) => [...prev, createMessage('assistant', answer)]);
    } catch {
      setMessages((prev) => [
        ...prev,
        createMessage(
          'assistant',
          'I could not reach the AI backend. Verify API availability and Gemini configuration.',
        ),
      ]);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 md:bottom-6 md:right-6">
      {isOpen && (
        <Card className="pointer-events-auto mb-3 flex h-[460px] w-[min(92vw,380px)] flex-col border-zinc-700 bg-zinc-900/95 p-0 shadow-2xl">
          <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-zinc-100">Ops Assistant</p>
              <p className="text-xs text-zinc-400">Talk to your live log context</p>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-md p-1 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
              aria-label="Close chat"
            >
              <X size={16} />
            </button>
          </div>

          <div className="space-y-2 border-b border-zinc-800 px-3 py-2">
            <p className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">Quick Questions</p>
            <div className="flex flex-wrap gap-2">
              {QUICK_QUESTIONS.map((question) => (
                <button
                  key={question}
                  type="button"
                  onClick={() => void submitMessage(question)}
                  disabled={isSending}
                  className="rounded-md border border-zinc-700 bg-zinc-800/70 px-2 py-1 text-xs text-zinc-200 transition-colors hover:border-amber-400/60 hover:text-amber-200 disabled:opacity-50"
                >
                  {question}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
            {visibleMessages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  'max-w-[92%] rounded-lg px-3 py-2 text-sm leading-relaxed',
                  message.role === 'assistant'
                    ? 'mr-auto border border-zinc-700 bg-zinc-800 text-zinc-100'
                    : 'ml-auto bg-amber-500 text-zinc-950',
                )}
              >
                {message.role === 'assistant' ? (
                  <div className="space-y-2 [&_h3]:mb-1 [&_h3]:mt-3 [&_h3]:text-sm [&_h3]:font-semibold [&_p]:my-1 [&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-rose-400/80 [&_blockquote]:pl-3 [&_blockquote]:text-rose-100 [&_strong]:font-semibold [&_table]:my-2 [&_table]:w-full [&_table]:border-collapse [&_table]:overflow-hidden [&_table]:rounded-md [&_table]:text-xs [&_thead]:bg-zinc-700/60 [&_th]:border [&_th]:border-zinc-600 [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_td]:border [&_td]:border-zinc-700 [&_td]:px-2 [&_td]:py-1 [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-5">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
                  </div>
                ) : (
                  message.content
                )}
              </div>
            ))}

            {isSending && (
              <div className="mr-auto rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-300">
                Analyzing live context...
              </div>
            )}
          </div>

          <form
            className="flex items-center gap-2 border-t border-zinc-800 p-3"
            onSubmit={(event) => {
              event.preventDefault();
              void submitMessage(input);
            }}
          >
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask a diagnostic question..."
              className="h-10 flex-1 rounded-md border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none transition-colors placeholder:text-zinc-500 focus:border-amber-400"
            />
            <Button type="submit" disabled={!canSend} className="h-10 gap-2 px-3">
              <Send size={14} />
              Send
            </Button>
          </form>
        </Card>
      )}

      <Button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="pointer-events-auto h-12 w-12 rounded-full p-0 shadow-lg"
        aria-label="Toggle AI chat"
      >
        <MessageSquare size={18} />
      </Button>
    </div>
  );
}

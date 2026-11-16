import { useEffect, useRef, useState } from 'react';
import { ArrowUp, LoaderCircle, Sparkles, X } from 'lucide-react';
import { api } from '../lib/api';
import { CLASS_META } from '../lib/format';
import { useToast } from '../context.jsx';

const SUGGESTIONS = [
  "Which emails require the client's attention?",
  'What am I waiting for a response on?',
  'Show unread emails',
  'Any meetings to schedule?',
];

export default function AskDrawer({ open, onClose, selectedThread, onOpenThread }) {
  const toast = useToast();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);
  const endRef = useRef(null);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 150);
  }, [open]);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, busy]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const ask = async (question) => {
    const q = question.trim();
    if (!q || busy) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', text: q }]);
    setBusy(true);
    try {
      const d = await api.ask(q, selectedThread?._id);
      setMessages((m) => [...m, { role: 'ai', text: d.answer, threads: d.threads, source: d.source }]);
    } catch (e) {
      setMessages((m) => [...m, { role: 'ai', text: e.message, error: true }]);
      toast(e.message, { kind: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const chips = selectedThread ? ['Summarize this thread', ...SUGGESTIONS] : SUGGESTIONS;

  return (
    <div className={`fixed inset-0 z-[60] ${open ? '' : 'pointer-events-none'}`} aria-hidden={!open}>
      <div className={`absolute inset-0 bg-black/40 backdrop-blur-[2px] transition-opacity ${open ? 'opacity-100' : 'opacity-0'}`} onClick={onClose} />
      <aside
        role="dialog"
        aria-label="Ask AI assistant"
        className={`absolute inset-y-0 right-0 flex w-full flex-col border-l border-line/10 bg-surface shadow-2xl transition-transform duration-200 sm:w-[28rem] ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex items-center gap-2 border-b border-line/10 px-4 py-3">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-emerald-600 to-lime-500 text-white">
            <Sparkles size={16} />
          </span>
          <div className="leading-tight">
            <h2 className="text-sm font-bold">Ask AI</h2>
            <p className="text-xs text-mute">{selectedThread ? `Open thread: ${selectedThread.subject.slice(0, 34)}${selectedThread.subject.length > 34 ? '…' : ''}` : 'Ask anything about your inbox'}</p>
          </div>
          <button className="icon-btn ml-auto" onClick={onClose} aria-label="Close Ask AI">
            <X size={18} />
          </button>
        </div>

        <div className="scroll-thin flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {messages.length === 0 && (
            <div className="pt-2">
              <p className="text-sm text-mute">Ask in plain language. For example:</p>
              <div className="mt-3 flex flex-col items-start gap-2">
                {chips.map((s) => (
                  <button key={s} onClick={() => ask(s)} className="rounded-xl border border-line/10 bg-raised/60 px-3 py-2 text-left text-sm transition hover:border-emerald-400/50 hover:bg-emerald-500/10">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) =>
            m.role === 'user' ? (
              <div key={i} className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-emerald-700 px-3.5 py-2 text-sm text-white">{m.text}</div>
            ) : (
              <div key={i} className="max-w-[92%]">
                <div className={`whitespace-pre-wrap rounded-2xl rounded-bl-md border px-3.5 py-2.5 text-sm leading-relaxed ${m.error ? 'border-rose-400/30 bg-rose-500/10' : 'border-line/10 bg-raised/60'}`}>{m.text}</div>
                {m.threads?.length > 0 && (
                  <div className="mt-2 flex flex-col items-start gap-1.5">
                    {m.threads.map((t) => (
                      <button key={t._id} onClick={() => onOpenThread(t._id)} className="flex max-w-full items-center gap-2 rounded-lg border border-line/10 bg-surface px-2.5 py-1.5 text-xs transition hover:border-emerald-400/50">
                        <span className={`h-2 w-2 shrink-0 rounded-full ${CLASS_META[t.classification]?.dot}`} />
                        <span className="truncate font-medium">{t.subject}</span>
                        <span className="shrink-0 font-semibold text-emerald-700 dark:text-emerald-300">Open</span>
                      </button>
                    ))}
                  </div>
                )}
                {m.source && <p className="mt-1.5 text-[11px] text-mute">Answered by {m.source === 'mock' ? 'built-in mock AI' : m.source}</p>}
              </div>
            )
          )}
          {busy && (
            <div className="flex max-w-[60%] items-center gap-2 rounded-2xl rounded-bl-md border border-line/10 bg-raised/60 px-3.5 py-3 text-sm text-mute" aria-label="AI is thinking">
              <LoaderCircle size={15} className="animate-spin" /> Looking through your inbox…
            </div>
          )}
          <div ref={endRef} />
        </div>

        {messages.length > 0 && (
          <div className="scroll-thin flex gap-2 overflow-x-auto px-4 pb-2">
            {chips.slice(0, 3).map((s) => (
              <button key={s} onClick={() => ask(s)} className="shrink-0 rounded-full border border-line/10 px-3 py-1 text-xs text-mute transition hover:border-emerald-400/50 hover:text-ink">{s}</button>
            ))}
          </div>
        )}

        <form
          className="border-t border-line/10 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            ask(input);
          }}
        >
          <div className="flex items-center gap-2 rounded-xl border border-line/10 bg-raised/70 py-1.5 pl-3 pr-1.5 focus-within:border-emerald-400/60 focus-within:ring-2 focus-within:ring-emerald-400/20">
            <input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask about your inbox…" aria-label="Ask a question" className="flex-1 bg-transparent text-sm outline-none placeholder:text-mute/80" />
            <button type="submit" disabled={!input.trim() || busy} className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-700 text-white transition hover:bg-emerald-600 disabled:opacity-40" aria-label="Send question">
              <ArrowUp size={16} />
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
}

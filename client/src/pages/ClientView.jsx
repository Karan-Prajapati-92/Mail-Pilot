import { useCallback, useEffect, useState } from 'react';
import { CalendarClock, Check, ChevronDown, LoaderCircle, PartyPopper, Sparkles, UserRoundCog } from 'lucide-react';
import TopBar from '../components/TopBar.jsx';
import { Avatar } from '../components/EmailList.jsx';
import { api } from '../lib/api';
import { counterpart, fullDate } from '../lib/format';
import { useAuth, useToast } from '../context.jsx';

function ClientCard({ thread, onDone }) {
  const toast = useToast();
  const who = counterpart(thread);
  const [expanded, setExpanded] = useState(false);
  const [delegating, setDelegating] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(null);
  const last = thread.messages[thread.messages.length - 1];

  const act = async (action) => {
    setBusy(action);
    try {
      await api.clientAction(thread._id, action, note);
      toast(action === 'handled' ? 'Marked as handled' : 'Delegated to your assistant');
      onDone(thread._id);
    } catch (e) {
      toast(e.message, { kind: 'error' });
      setBusy(null);
    }
  };

  return (
    <article className="glass rounded-2xl p-5 sm:p-6" aria-label={thread.subject}>
      <div className="flex items-start gap-3">
        <Avatar name={who.name} size="h-10 w-10 text-sm" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-bold">{who.name}</span>
            <time className="text-xs text-mute">{fullDate(last.sentAt)}</time>
          </div>
          <h2 className="mt-0.5 text-lg font-extrabold leading-snug tracking-tight">{thread.subject}</h2>
        </div>
      </div>

      <p className="mt-3 line-clamp-2 text-[15px] leading-relaxed text-ink/90">{thread.aiSummary}</p>

      <div className="mt-4 flex gap-3 rounded-xl border border-orange-400/30 bg-orange-500/10 p-3.5">
        <Sparkles size={17} className="mt-0.5 shrink-0 text-orange-500 dark:text-orange-300" />
        <div>
          <div className="text-sm font-bold text-orange-700 dark:text-orange-300">Why your input is needed</div>
          <p className="mt-0.5 text-sm leading-relaxed">{thread.clientReason || 'Your assistant flagged this for your attention.'}</p>
        </div>
      </div>

      {thread.extractedDates?.[0] && (
        <p className="mt-3 flex items-center gap-1.5 text-sm text-mute">
          <CalendarClock size={15} /> {thread.extractedDates[0].label}: <span className="font-semibold text-ink">{thread.extractedDates[0].date}</span>
        </p>
      )}

      <button onClick={() => setExpanded((e) => !e)} aria-expanded={expanded} className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-mute transition hover:text-ink">
        <ChevronDown size={16} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
        {expanded ? 'Hide original thread' : `View original thread (${thread.messages.length})`}
      </button>
      {expanded && (
        <div className="mt-3 space-y-3 border-l-2 border-line/15 pl-4">
          {thread.messages.map((m) => (
            <div key={m._id}>
              <div className="text-xs text-mute">
                <span className="font-semibold text-ink">{m.isFromUser ? 'You' : m.fromName}</span> · {fullDate(m.sentAt)}
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-ink/90">{m.body}</p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-5 border-t border-line/10 pt-4">
        {delegating ? (
          <div className="animate-fade">
            <label htmlFor={`note-${thread._id}`} className="text-sm font-semibold">Add a note for your assistant <span className="font-normal text-mute">(optional)</span></label>
            <textarea id={`note-${thread._id}`} value={note} onChange={(e) => setNote(e.target.value)} rows={2} autoFocus className="input mt-2 resize-none" placeholder="e.g. Accept the Thursday slot and confirm with everyone" />
            <div className="mt-3 flex flex-wrap gap-2">
              <button className="btn-primary" onClick={() => act('delegate')} disabled={!!busy}>
                {busy === 'delegate' ? <LoaderCircle size={16} className="animate-spin" /> : <UserRoundCog size={16} />} Delegate to assistant
              </button>
              <button className="btn-ghost" onClick={() => setDelegating(false)} disabled={!!busy}>Cancel</button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button className="btn bg-emerald-700 text-white hover:bg-emerald-600" onClick={() => act('handled')} disabled={!!busy}>
              {busy === 'handled' ? <LoaderCircle size={16} className="animate-spin" /> : <Check size={16} />} Mark as handled
            </button>
            <button className="btn-ghost" onClick={() => setDelegating(true)} disabled={!!busy}>
              <UserRoundCog size={16} /> Delegate to assistant
            </button>
          </div>
        )}
      </div>
    </article>
  );
}

export default function ClientView() {
  const { user } = useAuth();
  const [threads, setThreads] = useState(null);
  const toast = useToast();

  const load = useCallback(async () => {
    try {
      const d = await api.emails('client_reply');
      setThreads(d.threads);
    } catch (e) {
      toast(e.message, { kind: 'error' });
      setThreads([]);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const first = 'Alex';
  const count = threads?.length ?? 0;

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar view="client" />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-16 pt-8 sm:pt-12">
        <header className="mb-6">
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
            {threads === null ? `Hi ${first}` : count > 0 ? `${count} ${count === 1 ? 'email needs' : 'emails need'} your reply` : `You're all caught up, ${first}`}
          </h1>
          <p className="mt-1.5 text-sm text-mute">Your assistant handles everything else. Only the decisions that need you are shown here{user?.isDemo ? '' : '.'}</p>
        </header>

        {threads === null ? (
          <div className="space-y-4" aria-busy="true" aria-label="Loading">
            {[0, 1].map((i) => (
              <div key={i} className="glass space-y-3 rounded-2xl p-6">
                <div className="skeleton h-5 w-2/5" />
                <div className="skeleton h-4 w-full" />
                <div className="skeleton h-16 w-full" />
                <div className="skeleton h-9 w-52" />
              </div>
            ))}
          </div>
        ) : count === 0 ? (
          <div className="glass grid place-items-center rounded-2xl px-6 py-16 text-center">
            <span className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-emerald-500/15 text-emerald-500 dark:text-emerald-300">
              <PartyPopper size={24} />
            </span>
            <h2 className="font-bold">Nothing needs your reply</h2>
            <p className="mt-1 max-w-xs text-sm text-mute">When your assistant flags an email for you, it will appear here.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {threads.map((t) => (
              <ClientCard key={t._id} thread={t} onDone={(id) => setThreads((cur) => cur.filter((x) => x._id !== id))} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

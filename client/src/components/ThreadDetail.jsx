import { useEffect, useRef, useState } from 'react';
import {
  Archive, ArchiveRestore, ArrowLeft, CalendarDays, CheckCheck, Clock, LoaderCircle, Mail, RefreshCw, RotateCcw, Send, ShieldCheck, Sparkles, Star, StickyNote,
} from 'lucide-react';
import ClassPill from './ClassPill.jsx';
import { Avatar } from './EmailList.jsx';
import { api } from '../lib/api';
import { CLASS_META, PROVIDER_LABEL, fullDate } from '../lib/format';
import { useToast } from '../context.jsx';

function ActionBtn({ icon: Icon, label, onClick, active, activeTone = '', disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={`icon-btn disabled:opacity-40 ${active ? activeTone : ''}`}
    >
      <Icon size={18} className={active && Icon === Star ? 'fill-current' : ''} />
    </button>
  );
}

function Insights({ thread, onRerun, busy }) {
  const meta = CLASS_META[thread.classification];
  const pct = Math.round((thread.confidence || 0) * 100);
  const bySomeoneElse = thread.classificationSource !== 'ai';
  return (
    <section className="relative overflow-hidden rounded-2xl border border-violet-400/25 bg-gradient-to-br from-violet-500/10 via-emerald-500/5 to-transparent p-4 sm:p-5" aria-label="AI insights">
      <div className="mb-3 flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-violet-500/20 text-violet-600 dark:text-violet-300">
          <Sparkles size={15} />
        </span>
        <h3 className="text-sm font-bold">AI insights</h3>
        <button onClick={onRerun} disabled={busy} className="ml-auto inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold text-mute transition hover:bg-raised hover:text-ink disabled:opacity-50">
          <RefreshCw size={12} className={busy ? 'animate-spin' : ''} /> Re-run AI
        </button>
      </div>

      <p className="text-[13px] font-semibold text-mute">
        {bySomeoneElse ? `Set by ${thread.classificationSource}` : `Why it's assigned to ${meta.who}`}
      </p>
      <p className="mt-1 text-sm leading-relaxed">{thread.aiReason}</p>

      <div className="mt-3 flex items-center gap-2 text-xs text-mute">
        <span>Confidence</span>
        <div className="h-1.5 w-28 overflow-hidden rounded-full bg-line/10" role="img" aria-label={`${pct}% confidence`}>
          <div className={`h-full rounded-full ${pct >= 80 ? 'bg-emerald-400' : pct >= 60 ? 'bg-emerald-400' : 'bg-yellow-400'}`} style={{ width: `${pct}%` }} />
        </div>
        <span className="font-semibold tabular-nums text-ink">{pct}%</span>
        {pct < 60 && <span className="font-medium text-yellow-600 dark:text-yellow-300">Low, review recommended</span>}
      </div>

      {thread.delegateNote && (
        <div className="mt-3 flex gap-2 rounded-lg border border-orange-400/30 bg-orange-500/10 p-3 text-sm">
          <StickyNote size={16} className="mt-0.5 shrink-0 text-orange-500 dark:text-orange-300" />
          <div>
            <div className="text-xs font-semibold text-orange-700 dark:text-orange-300">Note from the client</div>
            {thread.delegateNote}
          </div>
        </div>
      )}

      {thread.aiBullets?.length > 0 && (
        <ul className="mt-4 space-y-1.5 text-sm">
          {thread.aiBullets.map((b, i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-violet-400" />
              <span>{b}</span>
            </li>
          ))}
        </ul>
      )}

      {thread.extractedDates?.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {thread.extractedDates.map((d, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 rounded-lg border border-line/10 bg-surface/70 px-2.5 py-1 text-xs">
              <CalendarDays size={12} className="text-lime-600 dark:text-lime-300" />
              <span className="text-mute">{d.label}:</span>
              <span className="font-semibold">{d.date}</span>
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

function Composer({ thread, onChange }) {
  const toast = useToast();
  const [text, setText] = useState(thread.draftReply || '');
  const [note, setNote] = useState('');
  const [drafting, setDrafting] = useState(false);
  const [sending, setSending] = useState(false);
  const [open, setOpen] = useState(!!thread.draftReply);
  const taRef = useRef(null);

  const draft = async () => {
    setDrafting(true);
    setOpen(true);
    try {
      const d = await api.draft(thread._id, note);
      setText(d.draft);
      toast(`Draft ready (${d.source === 'mock' ? 'mock AI' : d.source}). Review it before sending.`, { kind: 'info' });
      setTimeout(() => taRef.current?.focus(), 50);
    } catch (e) {
      toast(e.message, { kind: 'error' });
    } finally {
      setDrafting(false);
    }
  };

  const saveDraft = () => {
    if (text !== (thread.draftReply || '')) api.patch(thread._id, { draftReply: text }).catch(() => {});
  };

  const send = async () => {
    setSending(true);
    try {
      const d = await api.send(thread._id, text);
      setText('');
      setOpen(false);
      setNote('');
      toast('Reply sent. Now waiting for a response.');
      onChange(d.thread);
    } catch (e) {
      toast(e.message, { kind: 'error' });
    } finally {
      setSending(false);
    }
  };

  const discard = () => {
    setText('');
    setOpen(false);
    api.patch(thread._id, { draftReply: '' }).catch(() => {});
  };

  return (
    <section className="glass rounded-2xl p-4 sm:p-5" aria-label="Reply">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-bold">Reply</h3>
        <span className="inline-flex items-center gap-1 text-xs text-mute">
          <ShieldCheck size={13} className="text-emerald-500" /> Nothing sends until you approve
        </span>
      </div>

      {!open ? (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input value={note} onChange={(e) => setNote(e.target.value)} className="input" placeholder="Optional: tell the AI what to include" aria-label="Context for the draft" />
          <button className="btn-primary shrink-0" onClick={draft} disabled={drafting}>
            {drafting ? <LoaderCircle size={16} className="animate-spin" /> : <Sparkles size={16} />} Draft reply
          </button>
          <button className="btn-ghost shrink-0" onClick={() => setOpen(true)}>Write manually</button>
        </div>
      ) : (
        <div className="mt-3">
          {drafting ? (
            <div className="space-y-2 rounded-lg border border-line/10 bg-raised/60 p-3" aria-busy="true" aria-label="Drafting reply">
              <div className="skeleton h-3.5 w-1/4" />
              <div className="skeleton h-3.5 w-full" />
              <div className="skeleton h-3.5 w-11/12" />
              <div className="skeleton h-3.5 w-2/3" />
            </div>
          ) : (
            <textarea
              ref={taRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onBlur={saveDraft}
              rows={9}
              className="input resize-y leading-relaxed"
              placeholder="Write your reply…"
              aria-label="Reply text"
            />
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button className="btn-primary" onClick={send} disabled={sending || drafting || !text.trim()}>
              {sending ? <LoaderCircle size={16} className="animate-spin" /> : <Send size={16} />} Approve & Send
            </button>
            <button className="btn-ghost" onClick={draft} disabled={drafting || sending}>
              <RotateCcw size={15} /> {text ? 'Regenerate' : 'Draft with AI'}
            </button>
            <button className="btn-ghost" onClick={discard} disabled={sending}>Discard</button>
            <span className="ml-auto text-xs text-mute">Draft, not sent</span>
          </div>
        </div>
      )}
    </section>
  );
}

export default function ThreadDetail({ thread, onChange, onClose, refresh }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const scroller = useRef(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
  }, [thread._id]);

  const patch = async (body, msg, undo) => {
    try {
      const d = await api.patch(thread._id, body);
      onChange(d.thread);
      if (msg) toast(msg, undo ? { action: { label: 'Undo', onClick: async () => { await api.patch(thread._id, undo); refresh(); } } } : {});
      return d.thread;
    } catch (e) {
      toast(e.message, { kind: 'error' });
    }
  };

  const archived = thread.status === 'archived';
  const completed = thread.status === 'completed';

  const rerun = async () => {
    setBusy(true);
    try {
      const d = await api.classify(thread._id);
      onChange(d.thread);
      toast(`AI re-checked this thread (${d.source === 'mock' ? 'mock AI' : d.source})`, { kind: 'info' });
    } catch (e) {
      toast(e.message, { kind: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="flex min-h-0 flex-1 flex-col" aria-label={thread.subject}>
      <div className="flex items-center gap-1 border-b border-line/10 px-2 py-2 sm:px-4">
        <button className="icon-btn lg:hidden" onClick={onClose} aria-label="Back to list">
          <ArrowLeft size={19} />
        </button>
        <div className="flex-1" />
        <ActionBtn icon={Star} label={thread.isImportant ? 'Remove important' : 'Mark important'} active={thread.isImportant} activeTone="!text-amber-400" onClick={() => patch({ isImportant: !thread.isImportant }, thread.isImportant ? 'Removed from important' : 'Marked important')} />
        <ActionBtn
          icon={Mail}
          label="Mark unread"
          onClick={async () => {
            const t = await patch({ isRead: false }, 'Marked as unread');
            if (t) onClose();
          }}
        />
        <ActionBtn
          icon={CheckCheck}
          label={completed ? 'Reopen' : 'Mark completed'}
          active={completed}
          activeTone="!text-emerald-400"
          onClick={() => patch({ status: completed ? 'open' : 'completed' }, completed ? 'Reopened' : 'Marked completed', { status: completed ? 'completed' : 'open' })}
        />
        <ActionBtn
          icon={archived ? ArchiveRestore : Archive}
          label={archived ? 'Move back to inbox' : 'Archive'}
          onClick={async () => {
            const t = await patch({ status: archived ? 'open' : 'archived' }, archived ? 'Moved back to inbox' : 'Archived', { status: archived ? 'archived' : 'open' });
            if (t) onClose();
          }}
        />
      </div>

      <div ref={scroller} className="scroll-thin min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-4 sm:px-6 sm:py-5">
        <header>
          <h2 className="text-xl font-extrabold leading-snug tracking-tight sm:text-2xl">{thread.subject}</h2>
          <p className="mt-1.5 text-sm text-mute">
            {thread.participants.map((p) => p.name).join(', ')} · {PROVIDER_LABEL[thread.provider]} · {thread.messages.length} message{thread.messages.length > 1 ? 's' : ''}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <ClassPill value={thread.classification} editable onChange={(v) => patch({ classification: v }, `Reclassified as ${CLASS_META[v].label}`, { classification: thread.classification })} />
            {(thread.waitingForResponse || thread.status === 'waiting') && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300">
                <Clock size={12} /> Waiting for response
              </span>
            )}
            {completed && <span className="rounded-full bg-slate-500/15 px-2.5 py-1 text-xs font-semibold text-mute">Completed</span>}
            {archived && <span className="rounded-full bg-slate-500/15 px-2.5 py-1 text-xs font-semibold text-mute">Archived</span>}
          </div>
        </header>

        <Insights thread={thread} onRerun={rerun} busy={busy} />

        <section aria-label="Conversation" className="space-y-3">
          <h3 className="text-sm font-bold">Conversation</h3>
          {thread.messages.map((m) => (
            <div key={m._id} className={`rounded-2xl border p-4 ${m.isFromUser ? 'border-emerald-400/25 bg-emerald-500/8' : 'border-line/10 bg-surface/60'}`}>
              <div className="mb-2 flex items-center gap-2.5">
                <Avatar name={m.fromName} size="h-8 w-8 text-[11px]" />
                <div className="min-w-0 leading-tight">
                  <div className="truncate text-sm font-semibold">
                    {m.fromName} {m.isFromUser && <span className="ml-1 text-xs font-medium text-mute">(you)</span>}
                  </div>
                  <div className="truncate text-xs text-mute">{m.fromEmail}</div>
                </div>
                <time className="ml-auto shrink-0 text-xs text-mute">{fullDate(m.sentAt)}</time>
              </div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink/90">{m.body}</p>
            </div>
          ))}
        </section>

        <Composer key={thread._id} thread={thread} onChange={onChange} />
      </div>
    </article>
  );
}

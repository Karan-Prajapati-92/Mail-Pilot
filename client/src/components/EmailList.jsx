import { CalendarDays, Clock, Inbox, Search, SearchX, Sparkles, Star } from 'lucide-react';
import ClassPill from './ClassPill.jsx';
import { CLASS_META, PROVIDER_LABEL, avatarClass, counterpart, initials, timeAgo } from '../lib/format';

export function Avatar({ name, size = 'h-9 w-9 text-xs' }) {
  return (
    <span className={`grid shrink-0 place-items-center rounded-full bg-gradient-to-br font-bold text-white ${avatarClass(name)} ${size}`} aria-hidden="true">
      {initials(name)}
    </span>
  );
}

function EmailCard({ thread, active, onSelect, onReclassify }) {
  const who = counterpart(thread);
  const meta = CLASS_META[thread.classification];
  const waiting = thread.waitingForResponse || thread.status === 'waiting';
  const last = thread.messages[thread.messages.length - 1];
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(thread)}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onSelect(thread))}
      aria-current={active ? 'true' : undefined}
      className={`relative flex cursor-pointer gap-3 overflow-hidden rounded-xl border py-3 pl-4 pr-3 transition ${
        active ? 'border-emerald-400/50 bg-emerald-500/10' : 'border-line/10 bg-surface/60 hover:border-line/25 hover:bg-raised/70'
      }`}
    >
      <span className={`absolute inset-y-0 left-0 w-1 ${meta.rail}`} aria-hidden="true" />
      <Avatar name={who.name} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {!thread.isRead && <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400" aria-label="Unread" />}
          <span className={`truncate text-sm ${thread.isRead ? 'font-medium text-ink/90' : 'font-bold'}`}>{who.name}</span>
          {thread.isImportant && <Star size={13} className="shrink-0 fill-amber-400 text-amber-400" aria-label="Important" />}
          <span className="ml-auto shrink-0 text-xs text-mute">{timeAgo(last?.sentAt || thread.lastMessageAt)}</span>
        </div>
        <div className={`mt-0.5 truncate text-sm ${thread.isRead ? 'text-ink/80' : 'font-semibold'}`}>{thread.subject}</div>
        <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-mute">
          <Sparkles size={11} className="mr-1 inline -translate-y-px text-violet-500 dark:text-violet-300" aria-hidden="true" />
          {thread.aiSummary}
        </p>
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <ClassPill value={thread.classification} size="sm" editable onChange={(v) => onReclassify(thread, v)} />
          {waiting && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
              <Clock size={11} /> Waiting
            </span>
          )}
          {thread.isMeeting && (
            <span className="inline-flex items-center gap-1 rounded-full bg-lime-600/12 px-2 py-0.5 text-[11px] font-semibold text-lime-800 dark:text-lime-300">
              <CalendarDays size={11} /> Meeting
            </span>
          )}
          {thread.status === 'completed' && (
            <span className="rounded-full bg-slate-500/15 px-2 py-0.5 text-[11px] font-semibold text-mute">Completed</span>
          )}
          <span className="ml-auto text-[11px] text-mute">{PROVIDER_LABEL[thread.provider]}</span>
        </div>
      </div>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-2.5" aria-busy="true" aria-label="Loading emails">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="flex gap-3 rounded-xl border border-line/10 bg-surface/50 p-3">
          <div className="skeleton h-9 w-9 rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-3.5 w-1/3" />
            <div className="skeleton h-3.5 w-4/5" />
            <div className="skeleton h-3 w-full" />
            <div className="skeleton h-5 w-28 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

function Empty({ filter, q, onClear, onAll }) {
  const searching = !!q;
  const Icon = searching ? SearchX : Inbox;
  return (
    <div className="grid place-items-center px-6 py-16 text-center">
      <span className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-raised text-mute">
        <Icon size={22} />
      </span>
      <h3 className="font-bold">{searching ? 'No matching emails' : 'Nothing here right now'}</h3>
      <p className="mt-1 max-w-xs text-sm text-mute">
        {searching ? `No threads match “${q}”. Try a sender, subject or keyword.` : 'New emails in this segment will show up here as they are classified.'}
      </p>
      {searching ? (
        <button className="btn-ghost mt-4" onClick={onClear}>Clear search</button>
      ) : (
        filter !== 'all' && <button className="btn-ghost mt-4" onClick={onAll}>Show all inbox</button>
      )}
    </div>
  );
}

export default function EmailList({ threads, loading, selectedId, onSelect, onReclassify, q, setQ, filter, setFilter, title, className = '' }) {
  return (
    <section className={`flex min-h-0 flex-col ${className}`} aria-label="Email list">
      <div className="flex items-center gap-2 px-3 pb-2 pt-3 sm:px-4">
        <h2 className="shrink-0 text-sm font-bold">{title}</h2>
        <span className="rounded-md bg-raised px-1.5 text-xs tabular-nums text-mute">{loading ? '–' : threads.length}</span>
        <div className="relative ml-auto w-full max-w-[15rem]">
          <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-mute" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search emails"
            aria-label="Search emails"
            className="input !py-1.5 !pl-8 text-[13px]"
          />
        </div>
      </div>
      <div className="scroll-thin min-h-0 flex-1 space-y-2.5 overflow-y-auto px-3 pb-6 sm:px-4">
        {loading ? (
          <ListSkeleton />
        ) : threads.length === 0 ? (
          <Empty filter={filter} q={q} onClear={() => setQ('')} onAll={() => setFilter('all')} />
        ) : (
          threads.map((t) => <EmailCard key={t._id} thread={t} active={t._id === selectedId} onSelect={onSelect} onReclassify={onReclassify} />)
        )}
      </div>
    </section>
  );
}

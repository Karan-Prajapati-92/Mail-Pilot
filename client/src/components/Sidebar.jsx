import { Archive, BellOff, CalendarDays, Clock, Inbox, Plug, Sparkles, Star, TriangleAlert, UserRound, Zap, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { timeAgo } from '../lib/format';
import { Logo } from './TopBar.jsx';

export const NAV = [
  { key: 'all', label: 'All Inbox', icon: Inbox },
  { key: 'assistant_reply', label: 'Assistant to Reply', icon: Sparkles, tone: 'text-violet-500 dark:text-violet-300' },
  { key: 'client_reply', label: 'Client to Reply', icon: UserRound, tone: 'text-orange-500 dark:text-orange-300' },
  { key: 'no_reply', label: 'No Reply Needed', icon: BellOff },
  { key: 'action_required', label: 'Action Required', icon: Zap },
  { key: 'waiting', label: 'Waiting for Response', icon: Clock },
  { key: 'meetings', label: 'Meetings & Appointments', icon: CalendarDays },
  { key: 'important', label: 'Important', icon: Star, tone: 'text-amber-500 dark:text-amber-300' },
  { key: 'needs_review', label: 'Needs Review', icon: TriangleAlert, tone: 'text-yellow-600 dark:text-yellow-300' },
  { key: 'archived', label: 'Archived', icon: Archive },
];

function NavList({ filter, setFilter, counts, onPick }) {
  return (
    <nav className="space-y-0.5" aria-label="Inbox segments">
      {NAV.map(({ key, label, icon: Icon, tone }) => {
        const active = filter === key;
        return (
          <button
            key={key}
            onClick={() => {
              setFilter(key);
              onPick?.();
            }}
            aria-current={active ? 'page' : undefined}
            className={`group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-medium transition ${
              active ? 'bg-emerald-500/12 text-ink ring-1 ring-inset ring-emerald-400/30' : 'text-mute hover:bg-raised hover:text-ink'
            }`}
          >
            <Icon size={16} className={active ? 'text-emerald-700 dark:text-emerald-300' : tone || ''} />
            <span className="flex-1 truncate">{label}</span>
            {counts[key] != null && key !== 'archived' && (
              <span className={`rounded-md px-1.5 text-xs tabular-nums ${active ? 'text-ink' : 'text-mute'}`}>{counts[key]}</span>
            )}
          </button>
        );
      })}
    </nav>
  );
}

function ManageAccounts() {
  return (
    <Link to="/onboarding" className="mt-4 flex items-center gap-2.5 rounded-lg border border-line/10 px-2.5 py-2 text-sm font-medium text-mute transition hover:bg-raised hover:text-ink">
      <Plug size={16} /> Connect or manage inboxes
    </Link>
  );
}

function Activity({ logs }) {
  if (!logs.length) return null;
  return (
    <div className="mt-6 border-t border-line/10 pt-4">
      <h3 className="px-2.5 pb-2 text-xs font-semibold text-mute">Recent activity</h3>
      <ul className="space-y-2.5 px-2.5">
        {logs.slice(0, 5).map((l) => (
          <li key={l._id} className="text-xs leading-snug text-mute">
            <span className="line-clamp-2 text-ink/80">{l.detail}</span>
            <span className="opacity-70">{timeAgo(l.createdAt)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Sidebar({ filter, setFilter, counts, activity, open, onClose }) {
  const body = (onPick) => (
    <>
      <NavList filter={filter} setFilter={setFilter} counts={counts} onPick={onPick} />
      <ManageAccounts />
      <Activity logs={activity} />
    </>
  );
  return (
    <>
      <aside className="scroll-thin hidden w-64 shrink-0 overflow-y-auto border-r border-line/10 p-3 lg:block">{body()}</aside>

      {/* Mobile drawer */}
      <div className={`fixed inset-0 z-50 lg:hidden ${open ? '' : 'pointer-events-none'}`} aria-hidden={!open}>
        <div className={`absolute inset-0 bg-black/50 transition-opacity ${open ? 'opacity-100' : 'opacity-0'}`} onClick={onClose} />
        <div
          className={`absolute inset-y-0 left-0 flex w-72 flex-col bg-surface p-3 shadow-2xl transition-transform duration-200 ${open ? 'translate-x-0' : '-translate-x-full'}`}
        >
          <div className="mb-3 flex items-center justify-between px-1">
            <Logo />
            <button className="icon-btn" onClick={onClose} aria-label="Close navigation">
              <X size={18} />
            </button>
          </div>
          <div className="scroll-thin flex-1 overflow-y-auto">{body(onClose)}</div>
        </div>
      </div>
    </>
  );
}

import { CalendarDays, Clock, Inbox, Mail, Sparkles, UserRound } from 'lucide-react';

const KPIS = [
  { key: 'all', label: 'Total emails', icon: Inbox, tone: 'text-emerald-700 dark:text-emerald-300', glow: 'from-emerald-500/20' },
  { key: 'unread', label: 'Unread', icon: Mail, tone: 'text-rose-600 dark:text-rose-300', glow: 'from-rose-500/20' },
  { key: 'assistant_reply', label: 'Assistant to reply', icon: Sparkles, tone: 'text-violet-500 dark:text-violet-300', glow: 'from-violet-500/25' },
  { key: 'client_reply', label: 'Client to reply', icon: UserRound, tone: 'text-orange-500 dark:text-orange-300', glow: 'from-orange-500/25' },
  { key: 'waiting', label: 'Waiting for response', icon: Clock, tone: 'text-amber-600 dark:text-amber-300', glow: 'from-amber-500/25' },
  { key: 'meetings', label: 'Upcoming meetings', icon: CalendarDays, tone: 'text-lime-600 dark:text-lime-300', glow: 'from-lime-600/20' },
];

export default function KpiStrip({ counts, filter, setFilter, loading }) {
  return (
    <div className="scroll-thin flex gap-2.5 overflow-x-auto px-3 pt-3 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-4 xl:grid-cols-6">
      {KPIS.map(({ key, label, icon: Icon, tone, glow }) => {
        const active = filter === key;
        return (
          <button
            key={key}
            onClick={() => setFilter(key)}
            aria-pressed={active}
            className={`glass group relative min-w-[9.5rem] shrink-0 overflow-hidden rounded-xl p-3 text-left sm:min-w-0 sm:shrink transition hover:-translate-y-px hover:border-line/25 ${
              active ? '!border-emerald-400/60 ring-1 ring-emerald-400/40' : ''
            }`}
          >
            <span className={`pointer-events-none absolute -right-6 -top-8 h-20 w-20 rounded-full bg-gradient-to-br ${glow} to-transparent blur-xl`} />
            <div className="relative flex items-center justify-between text-xs font-medium text-mute">
              <span className="truncate">{label}</span>
              <Icon size={15} className={tone} />
            </div>
            <div className="relative mt-1.5 text-2xl font-bold tabular-nums">
              {loading && counts[key] == null ? <span className="skeleton inline-block h-7 w-8 align-middle" /> : counts[key] ?? 0}
            </div>
          </button>
        );
      })}
    </div>
  );
}

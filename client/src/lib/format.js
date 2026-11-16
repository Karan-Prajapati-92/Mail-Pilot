export const CLASS_META = {
  assistant_reply: {
    label: 'Assistant to Reply',
    short: 'Assistant',
    pill: 'bg-violet-500/15 text-violet-700 dark:text-violet-300 ring-violet-500/30',
    rail: 'bg-violet-500',
    dot: 'bg-violet-400',
    who: 'the assistant',
  },
  client_reply: {
    label: 'Client to Reply',
    short: 'Client',
    pill: 'bg-orange-500/15 text-orange-700 dark:text-orange-300 ring-orange-500/30',
    rail: 'bg-orange-500',
    dot: 'bg-orange-400',
    who: 'the client',
  },
  no_reply: {
    label: 'No Reply Needed',
    short: 'No reply',
    pill: 'bg-slate-500/15 text-slate-700 dark:text-slate-300 ring-slate-500/30',
    rail: 'bg-slate-400/70',
    dot: 'bg-slate-400',
    who: 'nobody',
  },
  needs_review: {
    label: 'Needs Review',
    short: 'Review',
    pill: 'bg-yellow-400/15 text-yellow-700 dark:text-yellow-300 ring-yellow-500/40',
    rail: 'bg-yellow-400',
    dot: 'bg-yellow-400',
    who: 'someone to decide',
  },
};

export const CLASS_ORDER = ['assistant_reply', 'client_reply', 'no_reply', 'needs_review'];

export function timeAgo(date) {
  const d = new Date(date);
  const s = Math.max(0, Math.round((Date.now() - d.getTime()) / 1000));
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.round(h / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function fullDate(date) {
  return new Date(date).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function initials(name = '?') {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || '?') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

const AVATARS = [
  'from-emerald-500 to-lime-500',
  'from-rose-500 to-orange-500',
  'from-violet-500 to-fuchsia-500',
  'from-amber-500 to-orange-500',
  'from-fuchsia-500 to-pink-500',
  'from-lime-600 to-emerald-600',
];
export function avatarClass(seed = '') {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AVATARS[h % AVATARS.length];
}

/** The most recent message not written by the user, i.e. who we're talking to. */
export function counterpart(thread) {
  const m = [...thread.messages].reverse().find((x) => !x.isFromUser) || thread.messages[thread.messages.length - 1];
  return { name: m?.fromName || thread.participants?.[0]?.name || 'Unknown', email: m?.fromEmail || '' };
}

export const PROVIDER_LABEL = { gmail: 'Gmail', outlook: 'Outlook' };

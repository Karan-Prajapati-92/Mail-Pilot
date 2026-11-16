import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeftRight, LogOut, Menu, Moon, RefreshCw, Sparkles, Sun } from 'lucide-react';
import { api } from '../lib/api';
import { timeAgo } from '../lib/format';
import { useAuth, useTheme, useToast } from '../context.jsx';

export function Logo({ className = '' }) {
  return (
    <span className={`inline-flex items-center gap-2 font-extrabold tracking-tight ${className}`}>
      <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-emerald-600 to-lime-500 text-white shadow-[0_6px_18px_-6px_rgb(99_102_241/0.9)]">
        <Sparkles size={15} />
      </span>
      Mailpilot
    </span>
  );
}

function SyncBadge({ onSynced }) {
  const toast = useToast();
  const [accounts, setAccounts] = useState([]);
  const [busy, setBusy] = useState(false);
  const [, tick] = useState(0);

  const load = () => api.accounts().then((d) => setAccounts(d.accounts)).catch(() => {});
  useEffect(() => {
    load();
    const t = setInterval(() => tick((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  if (!accounts.length) return null;
  const oldest = accounts.reduce((a, b) => (new Date(a.lastSyncedAt) < new Date(b.lastSyncedAt) ? a : b));
  const names = accounts.map((a) => (a.provider === 'gmail' ? 'Gmail' : 'Outlook')).join(' + ');

  const sync = async () => {
    setBusy(true);
    try {
      const results = await Promise.all(accounts.map((a) => api.sync(a._id)));
      await load();
      onSynced?.();
      const n = results.reduce((t, r) => t + (r.imported || 0), 0);
      toast(n ? `${n} new email${n > 1 ? 's' : ''} imported` : 'Inbox is up to date');
    } catch (e) {
      toast(e.message, { kind: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={sync}
      disabled={busy}
      title={`${names}\nClick to sync now`}
      className="hidden items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-500/15 dark:text-emerald-300 md:inline-flex"
    >
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60 motion-reduce:hidden" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
      </span>
      Connected • Synced {timeAgo(oldest.lastSyncedAt)}
      <RefreshCw size={12} className={busy ? 'animate-spin' : ''} />
    </button>
  );
}

export function ViewSwitch({ view }) {
  const navigate = useNavigate();
  const item = (key, label, short, to) => (
    <button
      onClick={() => view !== key && navigate(to)}
      aria-pressed={view === key}
      className={`rounded-md px-3 py-1.5 text-xs font-semibold transition sm:text-sm ${
        view === key ? 'bg-emerald-700 text-white shadow-sm' : 'text-mute hover:text-ink'
      }`}
    >
      <span className="hidden sm:inline">{label}</span>
      <span className="sm:hidden">{short}</span>
    </button>
  );
  return (
    <div className="flex items-center gap-2" role="group" aria-label="Switch view">
      <span className="hidden items-center gap-1 text-xs font-medium text-mute 2xl:flex">
        Switch view <ArrowLeftRight size={12} />
      </span>
      <div className="flex rounded-lg border border-line/10 bg-raised/70 p-0.5">
        {item('assistant', 'Assistant Workspace', 'Assistant', '/app')}
        {item('client', 'Client View', 'Client', '/client')}
      </div>
    </div>
  );
}

export default function TopBar({ view, onMenu, onAsk, onSynced }) {
  const { theme, toggle } = useTheme();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-line/10 bg-base/80 px-3 backdrop-blur-md sm:gap-3 sm:px-4">
      {onMenu && (
        <button className="icon-btn lg:hidden" onClick={onMenu} aria-label="Open navigation">
          <Menu size={20} />
        </button>
      )}
      <Logo className="mr-1 text-[15px] max-sm:hidden" />
      <ViewSwitch view={view} />
      <div className="flex-1" />
      {view === 'assistant' && <SyncBadge onSynced={onSynced} />}
      {onAsk && (
        <button onClick={onAsk} className="btn-ghost !px-3 !py-1.5">
          <Sparkles size={15} className="text-violet-500 dark:text-violet-300" />
          <span className="hidden sm:inline">Ask AI</span>
          <kbd className="hidden rounded border border-line/15 px-1.5 text-[10px] font-semibold text-mute lg:inline">⌘K</kbd>
        </button>
      )}
      <button className="icon-btn" onClick={toggle} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      </button>
      <button
        className="icon-btn"
        onClick={() => {
          signOut();
          navigate('/login');
        }}
        aria-label={`Sign out ${user?.name || ''}`}
        title="Sign out"
      >
        <LogOut size={18} />
      </button>
    </header>
  );
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { MousePointerClick, Sparkles } from 'lucide-react';
import TopBar from '../components/TopBar.jsx';
import Sidebar, { NAV } from '../components/Sidebar.jsx';
import KpiStrip from '../components/KpiStrip.jsx';
import EmailList from '../components/EmailList.jsx';
import ThreadDetail from '../components/ThreadDetail.jsx';
import AskDrawer from '../components/AskDrawer.jsx';
import { api } from '../lib/api';
import { CLASS_META } from '../lib/format';
import { useToast } from '../context.jsx';

export default function Workspace() {
  const toast = useToast();
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');
  const [dq, setDq] = useState('');
  const [threads, setThreads] = useState([]);
  const [counts, setCounts] = useState({});
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null);
  const [askOpen, setAskOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const reqId = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => setDq(q), 250);
    return () => clearTimeout(t);
  }, [q]);

  const load = useCallback(
    async ({ silent = false } = {}) => {
      const id = ++reqId.current;
      if (!silent) setLoading(true);
      try {
        const [list, stats, act] = await Promise.all([api.emails(filter, dq), api.stats(), api.activity()]);
        if (id !== reqId.current) return;
        setThreads(list.threads);
        setCounts(stats.counts);
        setActivity(act.logs);
      } catch (e) {
        if (id === reqId.current) toast(e.message, { kind: 'error' });
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    },
    [filter, dq, toast]
  );

  useEffect(() => {
    load();
  }, [load]);

  // Pick up new mail automatically (server checks Gmail every minute)
  useEffect(() => {
    const t = setInterval(() => !document.hidden && load({ silent: true }), 30000);
    const onVis = () => !document.hidden && load({ silent: true });
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [load]);

  // Cmd/Ctrl+K opens Ask AI
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setAskOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const select = async (thread) => {
    setDetail(thread);
    if (!thread.isRead) {
      try {
        const d = await api.patch(thread._id, { isRead: true });
        setDetail((cur) => (cur && cur._id === thread._id ? d.thread : cur));
        load({ silent: true });
      } catch { /* non-critical */ }
    }
  };

  const onChange = (t) => {
    setDetail(t);
    load({ silent: true });
  };

  const reclassify = async (thread, classification) => {
    if (classification === thread.classification) return;
    const prev = thread.classification;
    try {
      const d = await api.patch(thread._id, { classification });
      if (detail?._id === thread._id) setDetail(d.thread);
      load({ silent: true });
      toast(`Moved to ${CLASS_META[classification].label}`, {
        action: { label: 'Undo', onClick: async () => { await api.patch(thread._id, { classification: prev }); load({ silent: true }); } },
      });
    } catch (e) {
      toast(e.message, { kind: 'error' });
    }
  };

  const openFromAsk = async (id) => {
    try {
      const d = await api.email(id);
      setFilter('all');
      setQ('');
      setAskOpen(false);
      select(d.thread);
    } catch (e) {
      toast(e.message, { kind: 'error' });
    }
  };

  const title = NAV.find((n) => n.key === filter)?.label || 'Inbox';
  const showDetail = !!detail;

  return (
    <div className="flex h-screen flex-col">
      <TopBar view="assistant" onMenu={() => setNavOpen(true)} onAsk={() => setAskOpen(true)} onSynced={() => load({ silent: true })} />
      <div className="flex min-h-0 flex-1">
        <Sidebar filter={filter} setFilter={setFilter} counts={counts} activity={activity} open={navOpen} onClose={() => setNavOpen(false)} />

        <main className="flex min-w-0 flex-1 flex-col">
          <div className={showDetail ? 'hidden lg:block' : ''}>
            <KpiStrip counts={counts} filter={filter} setFilter={setFilter} loading={loading} />
          </div>
          <div className="flex min-h-0 flex-1 pt-1">
            <EmailList
              className={`w-full lg:w-[26rem] lg:shrink-0 lg:border-r lg:border-line/10 ${showDetail ? 'hidden lg:flex' : 'flex'}`}
              threads={threads}
              loading={loading}
              selectedId={detail?._id}
              onSelect={select}
              onReclassify={reclassify}
              q={q}
              setQ={setQ}
              filter={filter}
              setFilter={setFilter}
              title={title}
            />
            <section className={`min-w-0 flex-1 flex-col ${showDetail ? 'flex' : 'hidden lg:flex'}`} aria-label="Thread detail">
              {detail ? (
                <ThreadDetail thread={detail} onChange={onChange} onClose={() => setDetail(null)} refresh={() => load({ silent: true })} />
              ) : (
                <div className="grid flex-1 place-items-center px-6 text-center">
                  <div className="max-w-sm">
                    <span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-emerald-500/20 to-lime-500/20 text-violet-500 dark:text-violet-300">
                      <MousePointerClick size={24} />
                    </span>
                    <h3 className="font-bold">Pick a thread to see the AI’s take</h3>
                    <p className="mt-1 text-sm text-mute">You’ll get the reasoning behind each assignment, key dates, and a reply draft that waits for your approval.</p>
                    <button className="btn-ghost mx-auto mt-4" onClick={() => setAskOpen(true)}>
                      <Sparkles size={15} className="text-violet-500 dark:text-violet-300" /> Ask AI about your inbox
                    </button>
                  </div>
                </div>
              )}
            </section>
          </div>
        </main>
      </div>
      <AskDrawer open={askOpen} onClose={() => setAskOpen(false)} selectedThread={detail} onOpenThread={openFromAsk} />
    </div>
  );
}

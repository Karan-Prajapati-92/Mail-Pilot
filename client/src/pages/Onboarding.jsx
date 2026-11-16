import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Check, ExternalLink, KeyRound, LoaderCircle, Lock, Mail, ShieldCheck, TriangleAlert, X } from 'lucide-react';
import { Logo } from '../components/TopBar.jsx';
import { api } from '../lib/api';
import { useAuth, useToast } from '../context.jsx';

const STEPS = [
  { t: 'Connect your inbox', d: 'Link your real Gmail, or load a sample inbox to explore.' },
  { t: 'AI sorts every thread', d: 'Each email is labeled by who should reply: the assistant or the client, with the reason.' },
  { t: 'Assistant drafts, client decides', d: 'Routine replies are drafted for approval. Big decisions go to the client’s own view.' },
];

const PROVIDERS = {
  gmail: { name: 'Gmail', email: 'alex.founder@company.com', tint: 'from-rose-500 to-orange-500', blurb: 'Your real inbox, or a sample one' },
  outlook: { name: 'Outlook / Microsoft', email: 'alex.rivera@company.onmicrosoft.com', tint: 'from-slate-600 to-slate-800', blurb: 'Sample data only for now' },
};

function Modal({ label, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={label}>
      <div className="w-full max-w-md animate-pop rounded-2xl border border-line/10 bg-surface p-6 shadow-2xl">{children}</div>
    </div>
  );
}

function ConsentModal({ provider, onCancel, onAllow }) {
  const p = PROVIDERS[provider];
  return (
    <Modal label={`Load sample ${p.name} inbox`} onClose={onCancel}>
      <div className="flex items-center gap-3">
        <span className={`grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br text-white ${p.tint}`}><Mail size={20} /></span>
        <div className="leading-tight">
          <div className="font-bold">Load sample {p.name} inbox</div>
          <div className="text-xs text-mute">Made-up emails. No real mailbox is accessed.</div>
        </div>
      </div>
      <div className="mt-5 rounded-xl border border-line/10 bg-raised/60 px-3 py-2.5 text-sm">
        <div className="text-xs text-mute">Sample account</div>
        <div className="font-semibold">{p.email}</div>
      </div>
      <ul className="mt-4 space-y-2 text-sm">
        {['Loads realistic business email threads', 'AI classifies every thread', 'Replies are never really sent'].map((x) => (
          <li key={x} className="flex items-center gap-2"><Check size={15} className="text-emerald-600" />{x}</li>
        ))}
      </ul>
      <div className="mt-6 flex gap-2">
        <button className="btn-ghost flex-1" onClick={onCancel}>Cancel</button>
        <button className="btn-primary flex-1" onClick={onAllow} autoFocus>Load sample inbox</button>
      </div>
    </Modal>
  );
}

function GmailModal({ onClose, onConnected }) {
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const d = await api.connectGmail(email, pw);
      onConnected(d.account, d.imported);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <Modal label="Connect your Gmail" onClose={busy ? () => {} : onClose}>
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-rose-500 to-orange-500 text-white"><Mail size={20} /></span>
        <div className="flex-1 leading-tight">
          <div className="font-bold">Connect your Gmail</div>
          <div className="text-xs text-mute">New emails will appear in Mailpilot within a minute</div>
        </div>
        <button className="icon-btn -mr-2 -mt-1" onClick={onClose} disabled={busy} aria-label="Close"><X size={18} /></button>
      </div>

      <ol className="mt-4 space-y-2 rounded-xl border border-line/10 bg-raised/60 p-3.5 text-[13px] leading-snug">
        <li><b>1.</b> Turn on <b>2-Step Verification</b> in your Google account.</li>
        <li><b>2.</b> Open <a className="font-semibold text-emerald-700 underline dark:text-emerald-300" href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer">myaccount.google.com/apppasswords <ExternalLink size={11} className="inline -translate-y-px" /></a> and create an App Password (name it “Mailpilot”).</li>
        <li><b>3.</b> In Gmail go to Settings → Forwarding and POP/IMAP and make sure <b>IMAP is enabled</b>.</li>
        <li><b>4.</b> Paste your Gmail address and the 16-letter App Password below.</li>
      </ol>

      <form onSubmit={submit} className="mt-4 space-y-3">
        <div>
          <label htmlFor="g-email" className="mb-1.5 block text-sm font-medium">Gmail address</label>
          <input id="g-email" type="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@gmail.com" autoComplete="email" disabled={busy} />
        </div>
        <div>
          <label htmlFor="g-pass" className="mb-1.5 block text-sm font-medium">App Password</label>
          <div className="relative">
            <KeyRound size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mute" />
            <input id="g-pass" required className="input !pl-9 font-mono tracking-wider" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="abcd efgh ijkl mnop" autoComplete="off" spellCheck={false} disabled={busy} />
          </div>
        </div>
        {error && (
          <p role="alert" className="flex items-start gap-2 rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">
            <TriangleAlert size={16} className="mt-0.5 shrink-0" /> {error}
          </p>
        )}
        <p className="flex items-start gap-1.5 text-xs text-mute">
          <Lock size={13} className="mt-0.5 shrink-0" />
          The App Password is stored encrypted on your server. Mailpilot reads mail without marking it as read, and only sends when you click Approve &amp; Send.
        </p>
        <button type="submit" className="btn-primary w-full !py-2.5" disabled={busy || !email || !pw}>
          {busy ? <><LoaderCircle size={16} className="animate-spin" /> Connecting and importing latest emails…</> : 'Connect Gmail'}
        </button>
      </form>
    </Modal>
  );
}

export default function Onboarding() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState({});
  const [consent, setConsent] = useState(null);
  const [gmailOpen, setGmailOpen] = useState(false);
  const [syncing, setSyncing] = useState(null);
  const [finishing, setFinishing] = useState(false);

  const loadAccounts = () => api.accounts().then((d) => setAccounts(Object.fromEntries(d.accounts.map((a) => [a.provider, a])))).catch(() => {});
  useEffect(() => {
    loadAccounts();
  }, []);

  const connectSample = async (provider) => {
    setConsent(null);
    setSyncing(provider);
    try {
      const [d] = await Promise.all([api.connect(provider), new Promise((r) => setTimeout(r, 1500))]);
      setAccounts((a) => ({ ...a, [provider]: d.account }));
      toast(`Sample ${PROVIDERS[provider].name} inbox loaded. ${d.account.threadsSynced} threads classified.`);
    } catch (e) {
      toast(e.message, { kind: 'error' });
    } finally {
      setSyncing(null);
    }
  };

  const disconnect = async (acc) => {
    if (!window.confirm(`Disconnect ${acc.email}? Its emails will be removed from Mailpilot (your real mailbox is not touched).`)) return;
    try {
      await api.disconnect(acc._id);
      await loadAccounts();
      toast('Disconnected');
    } catch (e) {
      toast(e.message, { kind: 'error' });
    }
  };

  const finish = async () => {
    setFinishing(true);
    try {
      if (!user.onboarded) {
        const d = await api.finishOnboarding();
        setUser(d.user);
      }
      navigate('/app', { replace: true });
    } catch (e) {
      toast(e.message, { kind: 'error' });
      setFinishing(false);
    }
  };

  const connectedCount = Object.keys(accounts).length;
  const returning = !!user?.onboarded;

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col px-5 py-6 sm:px-8">
      <Logo className="text-lg" />
      <main className="flex-1 py-10 sm:py-14">
        <h1 className="text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
          {returning ? 'Your connected inboxes' : `Welcome${user?.name ? `, ${user.name.split(' ')[0]}` : ''}. Let’s set up your workspace.`}
        </h1>
        <p className="mt-3 max-w-xl text-mute">Mailpilot pairs an assistant with a client. The AI decides who should answer each email, so nothing important waits and nothing routine reaches the client.</p>

        {!returning && (
          <ol className="mt-8 grid gap-3 sm:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.t} className="glass rounded-2xl p-4">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-emerald-500/15 text-sm font-bold text-emerald-700 dark:text-emerald-300">{i + 1}</span>
                <h2 className="mt-3 text-sm font-bold">{s.t}</h2>
                <p className="mt-1 text-[13px] leading-snug text-mute">{s.d}</p>
              </li>
            ))}
          </ol>
        )}

        <h2 className="mt-10 text-lg font-bold">Connect an email account</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {Object.entries(PROVIDERS).map(([key, p]) => {
            const acc = accounts[key];
            const isSyncing = syncing === key;
            return (
              <div key={key} className={`glass rounded-2xl p-5 transition ${acc ? '!border-emerald-400/40' : ''}`}>
                <div className="flex items-center gap-3">
                  <span className={`grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br text-white ${p.tint}`}><Mail size={20} /></span>
                  <div className="leading-tight">
                    <div className="font-bold">{p.name}</div>
                    <div className="text-xs text-mute">{p.blurb}</div>
                  </div>
                </div>
                {acc ? (
                  <div className="mt-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/12 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Connected
                      </span>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${acc.isReal ? 'bg-emerald-700 text-white' : 'bg-slate-500/15 text-mute'}`}>{acc.isReal ? 'Real inbox' : 'Sample data'}</span>
                    </div>
                    <p className="mt-2 break-all text-sm text-mute">{acc.email} · {acc.threadsSynced} threads</p>
                    {acc.isReal && acc.threadsSynced === 0 && <p className="mt-1 text-xs text-mute">No emails imported yet. New mail appears within a minute.</p>}
                    <button className="mt-3 text-xs font-semibold text-mute underline-offset-2 hover:text-ink hover:underline" onClick={() => disconnect(acc)}>Disconnect</button>
                  </div>
                ) : isSyncing ? (
                  <div className="mt-4" aria-live="polite">
                    <div className="flex items-center gap-2 text-sm font-medium"><LoaderCircle size={15} className="animate-spin text-emerald-700" /> Syncing and classifying…</div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line/10"><div className="h-full animate-bar rounded-full bg-gradient-to-r from-emerald-600 to-lime-400" /></div>
                  </div>
                ) : key === 'gmail' ? (
                  <div className="mt-4 space-y-2">
                    <button className="btn-primary w-full" onClick={() => setGmailOpen(true)} disabled={!!syncing}>Connect my Gmail</button>
                    <button className="btn-ghost w-full" onClick={() => setConsent('gmail')} disabled={!!syncing}>Use sample inbox</button>
                  </div>
                ) : (
                  <button className="btn-ghost mt-4 w-full" onClick={() => setConsent(key)} disabled={!!syncing}>Load sample inbox</button>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <button className="btn-primary !px-5 !py-2.5" onClick={finish} disabled={!connectedCount || !!syncing || finishing}>
            {finishing ? <LoaderCircle size={16} className="animate-spin" /> : null} {returning ? 'Back to workspace' : 'Open my workspace'} <ArrowRight size={16} />
          </button>
          {!connectedCount && <span className="flex items-center gap-1.5 text-sm text-mute"><ShieldCheck size={15} /> Connect at least one inbox to continue</span>}
        </div>
      </main>

      {consent && <ConsentModal provider={consent} onCancel={() => setConsent(null)} onAllow={() => connectSample(consent)} />}
      {gmailOpen && (
        <GmailModal
          onClose={() => setGmailOpen(false)}
          onConnected={(acc, imported) => {
            setGmailOpen(false);
            setAccounts((a) => ({ ...a, gmail: acc }));
            toast(imported ? `Gmail connected. ${imported} emails imported and classified.` : 'Gmail connected. New emails will appear here shortly.');
          }}
        />
      )}
    </div>
  );
}

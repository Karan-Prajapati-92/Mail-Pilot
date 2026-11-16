import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, LoaderCircle, Moon, Sun, TriangleAlert, Zap } from 'lucide-react';
import { Logo } from '../components/TopBar.jsx';
import ClassPill from '../components/ClassPill.jsx';
import { api } from '../lib/api';
import { useAuth, useTheme } from '../context.jsx';

const PREVIEW = [
  { who: 'Priya Nair', subject: 'Board meeting: move to Thursday?', cls: 'assistant_reply' },
  { who: 'Daniel Okafor', subject: 'Series A term sheet: response by Friday', cls: 'client_reply' },
  { who: 'Notion Billing', subject: 'Invoice #4821, November', cls: 'no_reply' },
  { who: 'Maya Chen', subject: 'Intro: Lumen Labs <> Alex', cls: 'needs_review' },
];
const RAIL = { assistant_reply: 'bg-violet-500', client_reply: 'bg-orange-500', no_reply: 'bg-slate-400/70', needs_review: 'bg-yellow-400' };

export default function Auth() {
  const { signIn } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(null);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const finish = (d) => {
    signIn(d.token, d.user);
    navigate(d.user.onboarded ? '/app' : '/onboarding', { replace: true });
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy('form');
    try {
      finish(mode === 'login' ? await api.login(form) : await api.signup(form));
    } catch (err) {
      setError(err.message);
      setBusy(null);
    }
  };

  const demo = async () => {
    setError('');
    setBusy('demo');
    try {
      finish(await api.demo());
    } catch (err) {
      setError(err.message);
      setBusy(null);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="flex flex-col px-5 py-6 sm:px-10">
        <div className="flex items-center justify-between">
          <Logo className="text-lg" />
          <button className="icon-btn" onClick={toggle} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>

        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          <h1 className="text-3xl font-extrabold tracking-tight">{mode === 'login' ? 'Welcome back' : 'Create your workspace'}</h1>
          <p className="mt-2 text-sm text-mute">An assistant workspace where AI sorts every email by who should reply.</p>

          <button onClick={demo} disabled={!!busy} className="btn-primary mt-7 w-full !py-3">
            {busy === 'demo' ? <LoaderCircle size={17} className="animate-spin" /> : <Zap size={17} />} One-click demo login
          </button>
          <p className="mt-2 text-center text-xs text-mute">Loads a realistic inbox so you can try everything right away.</p>

          <div className="my-6 flex items-center gap-3 text-xs text-mute">
            <span className="h-px flex-1 bg-line/10" /> or use email <span className="h-px flex-1 bg-line/10" />
          </div>

          <form onSubmit={submit} className="space-y-3" noValidate>
            {mode === 'signup' && (
              <div>
                <label htmlFor="name" className="mb-1.5 block text-sm font-medium">Name</label>
                <input id="name" className="input" value={form.name} onChange={set('name')} autoComplete="name" placeholder="Sam Taylor" />
              </div>
            )}
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium">Email</label>
              <input id="email" type="email" className="input" value={form.email} onChange={set('email')} autoComplete="email" placeholder="you@company.com" />
            </div>
            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium">Password</label>
              <input id="password" type="password" className="input" value={form.password} onChange={set('password')} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder="At least 6 characters" />
            </div>
            {error && (
              <p role="alert" className="flex items-start gap-2 rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">
                <TriangleAlert size={16} className="mt-0.5 shrink-0" /> {error}
              </p>
            )}
            <button type="submit" disabled={!!busy} className="btn-ghost w-full !py-2.5">
              {busy === 'form' && <LoaderCircle size={16} className="animate-spin" />}
              {mode === 'login' ? 'Log in' : 'Create account'}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-mute">
            {mode === 'login' ? 'New here?' : 'Already have an account?'}{' '}
            <button className="font-semibold text-emerald-700 hover:underline dark:text-emerald-300" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); }}>
              {mode === 'login' ? 'Create an account' : 'Log in'}
            </button>
          </p>
        </div>
      </div>

      {/* Product preview */}
      <div className="relative hidden overflow-hidden border-l border-line/10 bg-surface/40 lg:flex lg:items-center lg:justify-center">
        <div className="pointer-events-none absolute -right-24 top-10 h-80 w-80 rounded-full bg-amber-400/25 blur-3xl" />
        <div className="pointer-events-none absolute -left-16 bottom-0 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="relative w-full max-w-md px-8">
          <h2 className="mb-2 text-2xl font-extrabold leading-tight tracking-tight">Every email, assigned before you open it.</h2>
          <p className="mb-6 text-sm text-mute">The color on the left edge tells you who owns the reply. The AI explains why, and drafts, but never sends on its own.</p>
          <div className="space-y-2.5">
            {PREVIEW.map((p) => (
              <div key={p.subject} className="glass relative flex items-center gap-3 overflow-hidden rounded-xl py-3 pl-5 pr-3">
                <span className={`absolute inset-y-0 left-0 w-1 ${RAIL[p.cls]}`} />
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-mute">{p.who}</div>
                  <div className="truncate text-sm font-semibold">{p.subject}</div>
                </div>
                <ClassPill value={p.cls} size="sm" />
              </div>
            ))}
          </div>
          <p className="mt-6 flex items-center gap-1.5 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
            Try it with the demo login <ArrowRight size={15} />
          </p>
        </div>
      </div>
    </div>
  );
}

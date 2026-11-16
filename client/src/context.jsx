import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, CircleAlert, Info, X } from 'lucide-react';
import { api, getToken, setToken } from './lib/api';

/* ------------------------------- Theme ------------------------------- */
const ThemeCtx = createContext(null);
export const useTheme = () => useContext(ThemeCtx);

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('mp_theme_v2') === 'dark' ? 'dark' : 'light'; } catch { return 'light'; }
  });
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    try { localStorage.setItem('mp_theme_v2', theme); } catch { /* ignore */ }
  }, [theme]);
  const value = useMemo(() => ({ theme, toggle: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')) }), [theme]);
  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

/* ------------------------------- Toasts ------------------------------- */
const ToastCtx = createContext(null);
export const useToast = () => useContext(ToastCtx);

const TOAST_ICON = {
  success: <CheckCircle2 size={18} className="text-emerald-400" />,
  error: <CircleAlert size={18} className="text-rose-400" />,
  info: <Info size={18} className="text-emerald-700 dark:text-emerald-300" />,
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const toast = useCallback(
    (message, opts = {}) => {
      const id = ++idRef.current;
      setToasts((t) => [...t.slice(-3), { id, message, kind: opts.kind || 'success', action: opts.action }]);
      setTimeout(() => dismiss(id), opts.action ? 6000 : 3500);
    },
    [dismiss]
  );

  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="glass pointer-events-auto flex max-w-md animate-toast items-center gap-3 rounded-xl bg-surface/95 px-4 py-3 text-sm shadow-2xl shadow-black/30">
            {TOAST_ICON[t.kind]}
            <span className="flex-1">{t.message}</span>
            {t.action && (
              <button
                className="font-semibold text-emerald-700 hover:text-emerald-600 dark:text-emerald-300"
                onClick={() => {
                  t.action.onClick();
                  dismiss(t.id);
                }}
              >
                {t.action.label}
              </button>
            )}
            <button className="text-mute hover:text-ink" onClick={() => dismiss(t.id)} aria-label="Dismiss notification">
              <X size={15} />
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/* -------------------------------- Auth -------------------------------- */
const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!getToken());

  useEffect(() => {
    if (!getToken()) return;
    api
      .me()
      .then((d) => setUser(d.user))
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const onUnauth = () => {
      setToken(null);
      setUser(null);
    };
    window.addEventListener('mp:unauthorized', onUnauth);
    return () => window.removeEventListener('mp:unauthorized', onUnauth);
  }, []);

  const signIn = useCallback((token, u) => {
    setToken(token);
    setUser(u);
  }, []);
  const signOut = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, setUser, loading, signIn, signOut }), [user, loading, signIn, signOut]);
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

// Use VITE_API_URL only if it is a real http(s) address (e.g. https://my-backend.onrender.com/api).
// Anything else (empty, "undefined", a typo) falls back to the same-origin /api.
const RAW_API = String(import.meta.env.VITE_API_URL || '').trim();
const BASE = /^https?:\/\//i.test(RAW_API) ? RAW_API.replace(/\/+$/, '') : '/api';


export const getToken = () => {
  try { return localStorage.getItem('mp_token'); } catch { return null; }
};
export const setToken = (t) => {
  try { t ? localStorage.setItem('mp_token', t) : localStorage.removeItem('mp_token'); } catch { /* storage blocked */ }
};

async function req(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(BASE + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error("Can't reach the server. Check that the API is running on port 5000.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith('/auth/login') && !path.startsWith('/auth/signup')) {
      window.dispatchEvent(new Event('mp:unauthorized'));
    }
    throw new Error(data.message || 'Something went wrong');
  }
  return data;
}

const qs = (o) => {
  const p = new URLSearchParams();
  Object.entries(o).forEach(([k, v]) => v && p.set(k, v));
  const s = p.toString();
  return s ? `?${s}` : '';
};

export const api = {
  signup: (b) => req('/auth/signup', { method: 'POST', body: b }),
  login: (b) => req('/auth/login', { method: 'POST', body: b }),
  demo: () => req('/auth/demo', { method: 'POST' }),
  me: () => req('/auth/me'),
  finishOnboarding: () => req('/auth/onboarded', { method: 'POST' }),

  accounts: () => req('/accounts'),
  connect: (provider) => req('/accounts/connect', { method: 'POST', body: { provider } }),
  connectGmail: (email, appPassword) => req('/accounts/connect-gmail', { method: 'POST', body: { email, appPassword } }),
  sync: (id) => req(`/accounts/${id}/sync`, { method: 'POST' }),
  disconnect: (id) => req(`/accounts/${id}`, { method: 'DELETE' }),

  emails: (filter, q) => req(`/emails${qs({ filter, q })}`),
  stats: () => req('/emails/stats'),
  email: (id) => req(`/emails/${id}`),
  patch: (id, body) => req(`/emails/${id}`, { method: 'PATCH', body }),
  send: (id, body) => req(`/emails/${id}/send`, { method: 'POST', body: { body } }),
  clientAction: (id, action, note) => req(`/emails/${id}/client-action`, { method: 'POST', body: { action, note } }),

  classify: (threadId) => req('/ai/classify', { method: 'POST', body: { threadId } }),
  draft: (threadId, note) => req('/ai/draft', { method: 'POST', body: { threadId, note } }),
  ask: (question, threadId) => req('/ai/ask', { method: 'POST', body: { question, threadId } }),

  activity: () => req('/activity'),
};

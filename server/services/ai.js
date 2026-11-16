// AI engine: OpenAI -> Gemini -> deterministic mock fallback.
// Every public function ALWAYS resolves (falls back to mock on any error).

const hasOpenAI = () => !!process.env.OPENAI_API_KEY;
const hasGemini = () => !!process.env.GEMINI_API_KEY;

export const aiProvider = () => (hasOpenAI() ? 'openai' : hasGemini() ? 'gemini' : 'mock');

async function callLLM(system, user, json = false) {
  if (hasOpenAI()) {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
        ...(json ? { response_format: { type: 'json_object' } } : {}),
        temperature: 0.3,
      }),
    });
    if (!r.ok) throw new Error(`OpenAI ${r.status}`);
    const d = await r.json();
    return d.choices[0].message.content;
  }
  if (hasGemini()) {
    const model = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: user }] }],
          generationConfig: { temperature: 0.3, ...(json ? { responseMimeType: 'application/json' } : {}) },
        }),
      }
    );
    if (!r.ok) throw new Error(`Gemini ${r.status}`);
    const d = await r.json();
    return d.candidates[0].content.parts[0].text;
  }
  throw new Error('no provider');
}

const threadText = (t) =>
  `Subject: ${t.subject}\n` +
  t.messages.map((m) => `From: ${m.fromName} <${m.fromEmail}>\n${m.body}`).join('\n---\n');

const lastExternal = (t) => [...t.messages].reverse().find((m) => !m.isFromUser) || t.messages[t.messages.length - 1];

/* ----------------------------- MOCK ENGINE ----------------------------- */

const RX = {
  newsletter: /(newsletter|unsubscribe|weekly|digest|read online|no-reply|noreply|automated|receipt|invoice|usage report)/i,
  clientOnly: /(term sheet|valuation|equity|offer letter|compensation|salary|acquisition|board seat|renewal|legal|lawsuit|contract signature|sign off|approve|approval|escalat|at risk|decision)/i,
  scheduling: /(reschedul|schedule|calendar|meeting|sync|call|availability|slot|\d{1,2}\s?(am|pm)|tuesday|wednesday|thursday|friday|monday)/i,
  question: /\?/,
  vague: /(synerg|explor|touch base|pick your brain|partnership|collaborat)/i,
};

function mockClassify(t) {
  const text = threadText(t);
  const last = lastExternal(t);
  const fromUserLast = t.messages[t.messages.length - 1]?.isFromUser;
  let classification = 'needs_review';
  let confidence = 0.5;
  let reason = 'Mixed signals, so the assistant should review.';
  let clientReason = '';
  let waiting = false;

  if (fromUserLast) {
    classification = 'assistant_reply';
    confidence = 0.8;
    waiting = true;
    reason = 'The last message was ours, so we are waiting on the other side. A follow-up may be needed.';
  } else if (RX.newsletter.test(last.fromEmail + ' ' + text)) {
    classification = 'no_reply';
    confidence = 0.93;
    reason = 'Looks automated or informational, so no reply is expected.';
  } else if (RX.clientOnly.test(text)) {
    classification = 'client_reply';
    confidence = 0.88;
    reason = 'Mentions a financial, legal, compensation or relationship-critical decision that the client should make.';
    clientReason = 'This involves a decision with real consequences, so your input is needed.';
  } else if (RX.vague.test(text) && !RX.scheduling.test(text)) {
    classification = 'needs_review';
    confidence = 0.4;
    reason = 'The intent is unclear, so confidence is low.';
    clientReason = 'Unclear intent; you may want to decide whether to engage.';
  } else if (RX.scheduling.test(text) || RX.question.test(last.body)) {
    classification = 'assistant_reply';
    confidence = 0.85;
    reason = 'Routine scheduling or an inquiry the assistant can handle.';
  }

  const dates = [...text.matchAll(/\b(Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day\b[^.\n]{0,30}|\b\d{1,2}\s(?:Nov|Dec|Jan|Feb)[a-z]*\b/gi)]
    .slice(0, 3)
    .map((m) => ({ label: 'Mentioned', date: m[0].trim() }));

  const firstSentence = last.body.replace(/\s+/g, ' ').split(/(?<=[.!?])\s/)[0] || t.subject;
  return {
    classification,
    confidence,
    reason,
    clientReason,
    summary: `${last.fromName}: ${firstSentence}`.slice(0, 200),
    bullets: [
      `${t.messages.length} message${t.messages.length > 1 ? 's' : ''} in thread`,
      `Latest from ${last.fromName}`,
      dates[0] ? `Date mentioned: ${dates[0].date}` : 'No explicit deadline found',
    ],
    dates,
    waiting,
    actionRequired: classification !== 'no_reply' && !waiting,
    isMeeting: /(meeting|sync|call|calendar|appointment)/i.test(t.subject + ' ' + last.body),
  };
}

function mockDraft(t, note = '') {
  const last = lastExternal(t);
  const first = (last.fromName || 'there').split(' ')[0];
  const body = last.body;
  let core;
  if (t.classification === 'no_reply') {
    core = 'Thanks for the update, noted on our side.';
  } else if (t.classification === 'client_reply') {
    core = "Thank you for the note. Alex has seen this and is giving it careful consideration. We'll come back to you with a response before your deadline.";
  } else if (/reschedul|\bmove\b|\bsync\b|\d\s?(am|pm)/i.test(body + t.subject)) {
    core = "Thanks for flagging. That timing works, and I'll send an updated calendar invite shortly. Please let me know if anything else changes.";
  } else if (/(follow|waiting|update|revert|feedback)/i.test(t.subject + t.aiSummary) && t.status === 'waiting') {
    core = "Just following up on this thread. Could you share an update when you have a moment? We're keen to keep things moving on our side.";
  } else if (/(demo|webinar|checklist)/i.test(t.subject)) {
    core = "Thank you for sharing the checklist, it's useful. We're not scheduling demos right now, but I'll reach out if that changes.";
  } else if (/\?/.test(body)) {
    core = "Thanks for reaching out. I've looked into this and will come back with a full answer shortly.";
  } else {
    core = 'Thanks for your message. I will review and get back to you soon.';
  }
  const noteLine = note ? `\n\n(Note from Alex: ${note})` : '';
  return `Hi ${first},\n\n${core}${noteLine}\n\nBest regards,\nOn behalf of Alex Rivera`;
}

function mockAsk(question, threads, currentThread) {
  const q = question.toLowerCase();
  const list = (arr) => arr.map((t, i) => `${i + 1}. ${t.subject}`).join('\n');
  const cite = (arr) => arr.map((t) => t._id);

  if (currentThread && /(summar|this thread|tl;?dr|recap)/.test(q)) {
    return {
      answer: `Summary of "${currentThread.subject}":\n\n${currentThread.aiSummary}\n\n${currentThread.aiBullets.map((b) => '• ' + b).join('\n')}`,
      threadIds: [currentThread._id],
    };
  }
  if (/(client).*(attention|reply|need|input)|require.*client|needs? my/.test(q)) {
    const r = threads.filter((t) => t.classification === 'client_reply' && t.status !== 'completed' && t.status !== 'archived');
    return {
      answer: r.length ? `${r.length} email${r.length > 1 ? 's need' : ' needs'} the client's attention:\n\n${list(r)}` : 'Nothing is waiting on the client right now.',
      threadIds: cite(r),
    };
  }
  if (/waiting|awaiting|pending response|haven.t heard/.test(q)) {
    const r = threads.filter((t) => t.waitingForResponse || t.status === 'waiting');
    return {
      answer: r.length ? `You're waiting on ${r.length} response${r.length > 1 ? 's' : ''}:\n\n${list(r)}` : 'You are not waiting on anyone.',
      threadIds: cite(r),
    };
  }
  if (/(assistant).*(reply|todo|to do)|what should i reply|my to.?do/.test(q)) {
    const r = threads.filter((t) => t.classification === 'assistant_reply' && !t.waitingForResponse && t.status === 'open');
    return { answer: r.length ? `Emails for the assistant to reply to:\n\n${list(r)}` : 'The assistant has nothing to reply to.', threadIds: cite(r) };
  }
  if (/(meeting|appointment|calendar|schedule)/.test(q)) {
    const r = threads.filter((t) => t.isMeeting);
    return { answer: r.length ? `Meetings and scheduling threads:\n\n${list(r)}` : 'No meetings found.', threadIds: cite(r) };
  }
  if (/(unread|new)/.test(q)) {
    const r = threads.filter((t) => !t.isRead);
    return { answer: `${r.length} unread:\n\n${list(r)}`, threadIds: cite(r) };
  }
  if (/(important|urgent|priority|deadline)/.test(q)) {
    const r = threads.filter((t) => t.isImportant && t.status !== 'archived');
    return { answer: r.length ? `Top priorities:\n\n${list(r)}` : 'Nothing marked important.', threadIds: cite(r) };
  }
  // keyword search fallback
  const words = q.replace(/[^a-z0-9 ]/g, '').split(' ').filter((w) => w.length > 3);
  const r = threads.filter((t) => words.some((w) => (t.subject + ' ' + t.aiSummary).toLowerCase().includes(w)));
  if (r.length) return { answer: `Here is what I found related to your question:\n\n${list(r)}`, threadIds: cite(r) };
  return {
    answer: 'I can answer questions like "Which emails need the client\'s attention?", "What am I waiting on?", "Summarize this thread", or "Show unread emails".',
    threadIds: [],
  };
}

/* ------------------------------ PUBLIC API ------------------------------ */

export async function classifyThread(t) {
  if (aiProvider() !== 'mock') {
    try {
      const out = await callLLM(
        'You triage an executive inbox for a personal assistant. Return JSON with keys: classification (assistant_reply|client_reply|no_reply|needs_review), confidence (0-1), reason, clientReason (why the client personally must act, or empty), summary (max 2 sentences), bullets (array of 3 strings), dates (array of {label,date}), waiting (boolean), actionRequired (boolean), isMeeting (boolean). client_reply = approvals, sensitive deals, personal decisions. assistant_reply = scheduling, routine inquiries, follow-ups. no_reply = newsletters, receipts, FYIs. needs_review if unsure.',
        threadText(t),
        true
      );
      const j = JSON.parse(out);
      if (['assistant_reply', 'client_reply', 'no_reply', 'needs_review'].includes(j.classification)) return { ...j, source: aiProvider() };
    } catch (e) {
      console.warn('[ai] falling back to mock:', e.message);
    }
  }
  return { ...mockClassify(t), source: 'mock' };
}

export async function draftReply(t, note = '') {
  if (aiProvider() !== 'mock') {
    try {
      const out = await callLLM(
        "You draft concise, warm, professional email replies on behalf of an executive's assistant. Output only the email body, no subject line.",
        `${threadText(t)}\n\nOptional note to include/consider: ${note || 'none'}`
      );
      return { draft: out.trim(), source: aiProvider() };
    } catch (e) {
      console.warn('[ai] draft fallback to mock:', e.message);
    }
  }
  return { draft: mockDraft(t, note), source: 'mock' };
}

export async function askInbox(question, threads, currentThread) {
  if (aiProvider() !== 'mock') {
    try {
      const ctx = threads
        .map((t) => `[${t._id}] ${t.subject} | ${t.classification} | status=${t.status} | unread=${!t.isRead} | ${t.aiSummary}`)
        .join('\n');
      const out = await callLLM(
        'You answer questions about an inbox. Return JSON {"answer": string, "threadIds": string[]} using only the ids provided. Be concise.',
        `Inbox:\n${ctx}\n\n${currentThread ? `Currently open thread: [${currentThread._id}]\n${threadText(currentThread)}\n\n` : ''}Question: ${question}`,
        true
      );
      const j = JSON.parse(out);
      return { answer: j.answer, threadIds: j.threadIds || [], source: aiProvider() };
    } catch (e) {
      console.warn('[ai] ask fallback to mock:', e.message);
    }
  }
  return { ...mockAsk(question, threads, currentThread), source: 'mock' };
}

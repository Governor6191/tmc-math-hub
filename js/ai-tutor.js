// AI tutor: a small chat panel that talks to a free Gemini proxy (see
// ai-config.js + ai/README.md). Stays hidden until AI_ENDPOINT is set, so the
// rest of the site is unaffected when the tutor is not configured.

import { escapeHtml } from './app.js';
import { renderMathIn } from './math-render.js';
import { AI_ENDPOINT } from './ai-config.js';

export function tutorEnabled() {
  return typeof AI_ENDPOINT === 'string' && AI_ENDPOINT.length > 0;
}

async function askTutor(messages) {
  const r = await fetch(AI_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
  });
  if (!r.ok) throw new Error('tutor http ' + r.status);
  const d = await r.json();
  return (d && d.text) ? String(d.text) : 'Sorry, I could not answer that right now.';
}

let panel = null;
let convo = [];
let gen = 0;      // bumped by resetTutor so stale in-flight replies are dropped
let busy = false; // one request at a time
let lastFocus = null;

// Markdown-lite. Code (fenced and inline) is pulled out first so the bold pass
// cannot corrupt things like a**2 inside code; KaTeX skips pre/code by default.
function mdToHtml(text) {
  const blocks = [];
  let s = String(text).replace(/```(?:\w+)?\n?([\s\S]*?)```/g, (m, c) => {
    blocks.push('<pre class="tutor-code">' + escapeHtml(c.trim()) + '</pre>');
    return '\u0000' + (blocks.length - 1) + '\u0000';
  });
  s = escapeHtml(s);
  const spans = [];
  s = s.replace(/`([^`]+)`/g, (m, c) => {
    spans.push('<code>' + c + '</code>');
    return '\u0001' + (spans.length - 1) + '\u0001';
  });
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\n/g, '<br>');
  s = s.replace(/\u0001(\d+)\u0001/g, (m, i) => spans[Number(i)]);
  s = s.replace(/\u0000(\d+)\u0000/g, (m, i) => blocks[Number(i)]);
  return s;
}

function bubble(role, text, pending) {
  const div = document.createElement('div');
  div.className = 'tutor-msg tutor-' + role + (pending ? ' is-pending' : '');
  div.innerHTML = pending ? '<span class="tutor-dots" aria-label="The tutor is thinking"><i></i><i></i><i></i></span>' : mdToHtml(text);
  return div;
}

function ensurePanel() {
  if (panel) return panel;
  const el = document.createElement('div');
  el.className = 'tutor-overlay';
  el.hidden = true;
  el.innerHTML = `
    <div class="tutor-panel" role="dialog" aria-label="AI tutor" aria-modal="true">
      <div class="tutor-head">
        <div><span class="tutor-title">AI Tutor</span> <span class="tutor-sub">here to help you understand</span></div>
        <button class="tutor-close" type="button" aria-label="Close">&#215;</button>
      </div>
      <div class="tutor-messages" role="log" aria-live="polite"></div>
      <form class="tutor-form">
        <textarea class="tutor-input" rows="1" placeholder="Ask anything about this topic..." aria-label="Ask the tutor"></textarea>
        <button class="tutor-send" type="submit" aria-label="Send">Send</button>
      </form>
      <p class="tutor-foot hint">Answers come from Google Gemini and can be wrong. Always check against your notes.</p>
    </div>`;
  document.body.appendChild(el);
  const close = () => {
    el.hidden = true;
    if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
  };
  el.querySelector('.tutor-close').addEventListener('click', close);
  el.addEventListener('click', e => { if (e.target === el) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !el.hidden) close(); });
  const form = el.querySelector('.tutor-form');
  const input = el.querySelector('.tutor-input');
  input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } });
  form.addEventListener('submit', e => {
    e.preventDefault();
    if (busy) return;
    const t = input.value.trim();
    if (t) { input.value = ''; send(t); }
  });
  panel = el;
  return el;
}

async function send(text) {
  if (busy) return;
  busy = true;
  const el = ensurePanel();
  const sendBtn = el.querySelector('.tutor-send');
  sendBtn.disabled = true;
  const myGen = gen;
  const msgs = el.querySelector('.tutor-messages');
  convo.push({ role: 'user', text });
  const mine = bubble('user', text);
  msgs.appendChild(mine);
  renderMathIn(mine);
  const pend = bubble('assistant', '', true);
  msgs.appendChild(pend);
  msgs.scrollTop = msgs.scrollHeight;
  let answer = null;
  try { answer = await askTutor(convo.slice(-12)); } catch { answer = null; }
  busy = false;
  sendBtn.disabled = false;
  if (myGen !== gen) { pend.remove(); return; } // conversation was reset while waiting
  pend.classList.remove('is-pending');
  if (answer == null) {
    pend.textContent = 'Sorry, the tutor is unavailable right now. Try again in a moment.';
  } else {
    convo.push({ role: 'assistant', text: answer });
    pend.innerHTML = mdToHtml(answer);
    renderMathIn(pend);
  }
  msgs.scrollTop = msgs.scrollHeight;
}

export function resetTutor() {
  gen += 1;
  busy = false;
  convo = [];
  if (panel) {
    panel.querySelector('.tutor-messages').innerHTML = '';
    panel.querySelector('.tutor-send').disabled = false;
  }
}

// Open the tutor. If seedText is given it is sent as the first question.
// Pass fresh = true to start a new conversation (used for "explain this question").
export function openTutor(seedText, fresh) {
  const el = ensurePanel();
  if (fresh) resetTutor();
  lastFocus = document.activeElement;
  el.hidden = false;
  if (seedText) send(seedText);
  el.querySelector('.tutor-input').focus();
}

// Add a floating "Ask the tutor" button (only when the tutor is configured).
export function mountTutorFab() {
  if (!tutorEnabled() || document.querySelector('.tutor-fab')) return;
  const b = document.createElement('button');
  b.className = 'tutor-fab';
  b.type = 'button';
  b.textContent = 'Ask the tutor';
  b.addEventListener('click', () => openTutor());
  document.body.appendChild(b);
  document.body.classList.add('has-tutor-fab');
}

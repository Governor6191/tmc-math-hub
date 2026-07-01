// Cloudflare Worker: a tiny free proxy between the site and Google Gemini.
// It holds the API key (as a secret) so the key never appears in the website,
// only answers requests coming from the site's own origin, and never relays
// Google's raw error text to students. Deploy per ai/README.md.

const SYSTEM = [
  'You are a warm, encouraging tutor for KNUST (Kwame Nkrumah University of Science and Technology) mathematics undergraduates.',
  'Explain clearly and step by step, in simple language. Keep answers fairly short unless the student asks for more depth.',
  'When a student got a question wrong, explain plainly why their choice is wrong and why the correct answer is right.',
  'Use plain text; you may use $...$ for inline math and simple markdown. Do not invent facts or citations.',
  'If a question is outside mathematics or their coursework, gently steer back to studying.',
].join(' ');

const BUSY = 'The tutor has reached its free daily limit or is briefly unavailable. Please try again later, or tomorrow.';

export default {
  async fetch(request, env) {
    // Only the site itself may call this proxy. Set ALLOWED_ORIGIN to override
    // (comma separated for more than one, e.g. a local dev origin).
    const allowed = (env.ALLOWED_ORIGIN || 'https://governor6191.github.io')
      .split(',').map(s => s.trim()).filter(Boolean);
    const origin = request.headers.get('Origin') || '';
    const originOk = allowed.includes(origin);
    const cors = {
      'Access-Control-Allow-Origin': originOk ? origin : allowed[0],
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Vary': 'Origin',
      'Content-Type': 'application/json',
    };
    const reply = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: cors });

    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (request.method !== 'POST') return reply({ error: 'POST only' }, 405);
    if (!originOk) return reply({ error: 'origin not allowed' }, 403);
    if (!env.GEMINI_KEY) return reply({ text: 'The tutor is not configured yet.' });

    let body;
    try { body = await request.json(); } catch { body = {}; }
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const contents = messages
      .filter(m => m && typeof m.text === 'string' && m.text.trim())
      .slice(-12)
      .map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.text.slice(0, 4000) }] }));

    if (!contents.length) return reply({ text: 'Ask me a question and I will help.' });

    const model = env.GEMINI_MODEL || 'gemini-2.0-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_KEY}`;
    const payload = {
      system_instruction: { parts: [{ text: SYSTEM }] },
      contents,
      generationConfig: { temperature: 0.4, maxOutputTokens: 800 },
    };

    try {
      const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      // Never forward Google's raw error text (quota and key errors leak
      // project identifiers); students get a calm message instead.
      if (!resp.ok) return reply({ text: BUSY });
      const data = await resp.json();
      const text = (data.candidates && data.candidates[0] && data.candidates[0].content
        && data.candidates[0].content.parts.map(p => p.text).join(''))
        || 'Sorry, I could not answer that right now.';
      return reply({ text });
    } catch {
      return reply({ text: 'The tutor had a network problem. Please try again.' });
    }
  },
};

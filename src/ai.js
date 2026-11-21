'use strict';

function getConfig() {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    return {
      provider: 'gemini',
      key: geminiKey,
      model: process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
    };
  }
  const key = process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY;
  if (key) {
    const baseUrl = process.env.OPENAI_BASE_URL || 'https://api.deepseek.com';
    const model = process.env.OPENAI_MODEL || (process.env.DEEPSEEK_API_KEY ? 'deepseek-chat' : 'gpt-4o-mini');
    return { provider: 'openai', key: key, baseUrl: baseUrl, model: model };
  }
  return null;
}

function isEnabled() {
  return getConfig() ? true : false;
}

function normalizeName(n) {
  return String(n == null ? '' : n)
    .toLowerCase()
    .replace(/[^a-z ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildSystem(clinic, lang) {
  const data = JSON.stringify(clinic);
  const langNames = { en: 'English', hi: 'Hindi', te: 'Telugu' };
  const langNote = lang && lang !== 'en'
    ? 'Reply in the same language as the patient message (' + (langNames[lang] || lang) + ').'
    : 'Reply in English.';
  return [
    'You are the front desk assistant for a dental clinic.',
    'Answer the patient question using ONLY the information in the clinic file below.',
    'Never invent a price, doctor, timing, or policy. If the answer is not in the clinic file, reply with exactly: NOT_IN_FILE',
    'Never give medical advice or a diagnosis. If asked about pain or symptoms, tell them a dentist must see them and offer to book.',
    'Never offer discounts or change prices.',
    langNote,
    'Keep replies short, friendly and factual.',
    'CLINIC FILE: ' + data,
  ].join('\n');
}

function extractPrices(reply) {
  const out = [];
  const re = /(?:rs\.?|inr|\u20b9)\s*([\d,]+)/gi;
  let match;
  while ((match = re.exec(reply)) !== null) {
    out.push(match[1].replace(/,/g, ''));
  }
  return out;
}

function extractDoctorNames(reply) {
  const out = [];
  const re = /dr\.?\s+([a-z][a-z]+)/gi;
  let match;
  while ((match = re.exec(reply)) !== null) {
    out.push(normalizeName(match[1]));
  }
  return out;
}

function validateReply(reply, clinic) {
  const allowedPrices = new Set();
  clinic.services.forEach((s) => {
    extractPrices(s.price).forEach((p) => allowedPrices.add(p));
  });
  const prices = extractPrices(reply);
  for (const p of prices) {
    if (!allowedPrices.has(p)) return false;
  }
  const allowedDocs = new Set();
  clinic.doctors.forEach((d) => {
    normalizeName(d.name.replace(/^dr\.?\s*/i, ''))
      .split(' ')
      .forEach((w) => {
        if (w) allowedDocs.add(w);
      });
  });
  const names = extractDoctorNames(reply);
  for (const n of names) {
    if (!allowedDocs.has(n)) return false;
  }
  return true;
}

async function callGemini(cfg, system, message) {
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + cfg.model + ':generateContent?key=' + cfg.key;
  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts: [{ text: message }] }],
    generationConfig: { temperature: 0.2, maxOutputTokens: 300 },
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('gemini ' + res.status);
  const data = await res.json();
  const parts = data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts;
  return parts ? parts.map((p) => p.text).join('') : '';
}

async function callOpenAI(cfg, system, message) {
  const url = cfg.baseUrl.replace(/\/+$/, '') + '/chat/completions';
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + cfg.key },
    body: JSON.stringify({
      model: cfg.model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: message },
      ],
      temperature: 0.2,
      max_tokens: 300,
    }),
  });
  if (!res.ok) throw new Error('openai ' + res.status);
  const data = await res.json();
  return (data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
}

async function answerFromClinic(message, clinic, opts) {
  const options = opts || {};
  const cfg = getConfig();
  if (!cfg) return { known: false, disabled: true };
  const system = buildSystem(clinic, options.lang);
  try {
    let reply;
    if (cfg.provider === 'gemini') reply = await callGemini(cfg, system, message);
    else reply = await callOpenAI(cfg, system, message);
    reply = (reply || '').trim();
    if (!reply) return { known: false };
    if (/\bNOT_IN_FILE\b/.test(reply)) return { known: false };
    if (!validateReply(reply, clinic)) return { known: false, rejected: true };
    return { known: true, reply: reply };
  } catch (e) {
    return { known: false, error: String((e && e.message) || e) };
  }
}

module.exports = { isEnabled, answerFromClinic, getConfig };
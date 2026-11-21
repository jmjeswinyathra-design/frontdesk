'use strict';

const assert = require('assert');
const os = require('os');
const fs = require('fs');
const path = require('path');

const TMP = path.join(os.tmpdir(), 'fd_bonus_' + Date.now());
fs.mkdirSync(TMP, { recursive: true });

process.env.TICKETS_FILE = path.join(TMP, 'tickets.json');
process.env.CLINIC_FILE = path.join(TMP, 'clinic.json');
fs.copyFileSync(path.join(__dirname, '..', 'data', 'clinic.json'), process.env.CLINIC_FILE);
process.env.GEMINI_API_KEY = '';
process.env.DEEPSEEK_API_KEY = '';
process.env.OPENAI_API_KEY = '';
process.env.OPENAI_BASE_URL = '';

const JSDOM_PATH = 'C:/Users/USER/AppData/Local/Temp/kilo/domtest/node_modules/jsdom';

const { createServer } = require('../server');

let passed = 0;
function check(name, cond) {
  if (cond) {
    passed++;
    console.log('PASS  ' + name);
  } else {
    console.log('FAIL  ' + name);
    throw new Error('FAILED: ' + name);
  }
}

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', function () { resolve(server.address().port); });
  });
}

function postJSON(url, obj) {
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(obj),
  }).then(async (r) => {
    const text = await r.text();
    assert(r.ok, 'expected 2xx, got ' + r.status + ' ' + text);
    return JSON.parse(text);
  });
}

function getJSON(url) {
  return fetch(url).then(async (r) => {
    assert(r.ok, 'expected 2xx, got ' + r.status);
    return r.json();
  });
}

async function main() {
  const server = createServer();
  const port = await listen(server);
  const base = 'http://127.0.0.1:' + port;
  const chat = (sessionId, message) => postJSON(base + '/api/chat', { sessionId: sessionId, message: message });

  // Bonus 1: Hindi / any-language reply
  {
    const r = await chat('h1', 'सोमवार से शनिवार तक कब खुलते हैं?');
    const dev = /[\u0900-\u097F]/.test(r.reply);
    check('Hindi question gets a Hindi reply', dev && r.reply.length > 5);
    check('Hindi reply labelled from clinic file', r.label === 'Answered from the clinic file.');
  }

  // Bonus 1 (Telugu): Telugu question -> Telugu reply
  {
    const r = await chat('t1', 'శనివారం మీరు ఎప్పుడు తెరుస్తారు?');
    const tel = /[\u0C00-\u0C7F]/.test(r.reply);
    check('Telugu question gets a Telugu reply', tel && r.reply.length > 5);
    check('Telugu reply labelled from clinic file', r.label === 'Answered from the clinic file.');
  }

  // Chat control: greeting, thanks, end-chat
  {
    const hi = await chat('g1', 'hi');
    check('Greeting is answered without a ticket', hi.kind === 'chat' && hi.intent === 'greeting' && !hi.ticket);

    const th = await chat('g2', 'thank you');
    check('Thanks is answered without a ticket', th.kind === 'chat' && th.intent === 'thanks' && !th.ticket);

    const end = await chat('g3', "I'm done, thanks!");
    check('End phrase completes the chat', end.kind === 'ended');
    check('End reply mentions a fresh chat', /complete|fresh/i.test(end.reply));
    check('End phrase creates no ticket', !end.ticket);

    const notEnd = await chat('g4', "I'm not done yet");
    check('Negated done does not end the chat', notEnd.kind !== 'ended');

    const night = await chat('g5', 'good night');
    check('Farewell phrase ends the chat', night.kind === 'ended');

    const close = await chat('g6', 'close the chat please');
    check('Close-the-chat phrase ends the chat', close.kind === 'ended');
  }

  // Bonus 2: booking request becomes a ticket with a time
  {
    const r = await chat('b1', 'I want to book an appointment for tomorrow at 3 pm');
    check('Booking creates a ticket', !!r.ticket);
    check('Booking ticket status = needs human', r.ticket && r.ticket.status === 'needs human');
    const tickets = await getJSON(base + '/api/tickets');
    const mine = tickets.tickets.filter((t) => t.sessionId === 'b1')[0];
    check('Booking ticket stores the requested time', mine && mine.time === 'tomorrow at 3 pm');
    check('Booking reply mentions the time', /tomorrow at 3 pm/i.test(r.reply));
    check('Booking returns a digital receipt', !!r.receipt && !!r.receipt.reference);
    check('Receipt has clinic and requested time', !!r.receipt && !!r.receipt.clinic && r.receipt.time === 'tomorrow at 3 pm');
    check('Reply includes the booking reference', /reference is FD-/.test(r.reply));
  }

  // Booking without a time asks for one, no ticket
  {
    const r = await chat('b2', 'Can I book an appointment?');
    check('Booking without time asks for day/time', /what day and time/i.test(r.reply));
    check('Booking without time creates no ticket', !r.ticket);
  }

  // Bonus 3 + 6: staff edits clinic data, replies stay correct
  {
    const clinic = await getJSON(base + '/api/clinic');
    clinic.services = clinic.services.map((s) =>
      s.name === 'Root canal treatment' ? Object.assign({}, s, { price: 'Rs 7,000 to Rs 10,000' }) : s
    );
    const saved = await postJSON(base + '/api/clinic', clinic);
    check('Clinic save returns ok', saved.ok === true);

    const r = await chat('e1', 'How much is a root canal?');
    check('Reply uses the edited price', /7,000/.test(r.reply) && /10,000/.test(r.reply));
    check('Edited reply labelled from clinic file', r.label === 'Answered from the clinic file.');

    const clinic2 = await getJSON(base + '/api/clinic');
    const rc = clinic2.services.filter((s) => s.name === 'Root canal treatment')[0];
    check('Edited price persisted in clinic file', rc && /7,000/.test(rc.price));
  }

  // Bonus 4: quick replies + ?q= auto-ask, using jsdom against the live server
  {
    const { JSDOM } = require(JSDOM_PATH);
    const dom = await JSDOM.fromURL(base + '/', {
      runScripts: 'dangerously',
      resources: 'usable',
      pretendToBeVisual: true,
      beforeParse(window) {
        window.fetch = (u, o) => fetch(new URL(u, base), o);
        window.localStorage.clear();
      },
    });
    const w = dom.window;
    const d = w.document;
    await new Promise((res) => w.addEventListener('load', res));

    const quick = d.getElementById('quick');
    check('Quick-reply bar exists', !!quick);
    const btns = quick ? quick.querySelectorAll('button[data-q]') : [];
    check('Quick replies render buttons', btns.length >= 5);

    // click a quick reply -> a bot bubble appears
    const first = btns[0];
    first.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 700));
    const bots = d.querySelectorAll('.bot-msg');
    check('Clicking a quick reply produces a bot message', bots.length >= 1);
    const lastText = bots.length ? bots[bots.length - 1].textContent : '';
    check('Quick-reply answer is the clinic answer', /9:00 am|8:00 pm|time|open/i.test(lastText));
    w.close();
  }

  // Bonus 4 (cont): ?q= auto-asks on load
  {
    const { JSDOM } = require(JSDOM_PATH);
    const dom = await JSDOM.fromURL(base + '/?q=' + encodeURIComponent('How much is a root canal?'), {
      runScripts: 'dangerously',
      resources: 'usable',
      pretendToBeVisual: true,
      beforeParse(window) {
        window.fetch = (u, o) => fetch(new URL(u, base), o);
        window.localStorage.clear();
      },
    });
    const w = dom.window;
    await new Promise((res) => w.addEventListener('load', res));
    await new Promise((r) => setTimeout(r, 800));
    const bots = w.document.querySelectorAll('.bot-msg');
    check('?q= auto-asks and returns a bot answer', bots.length >= 1);
    const lastText = bots.length ? bots[bots.length - 1].textContent : '';
    check('?q= answer reflects edited root canal price', /7,000|10,000/.test(lastText));
    w.close();
  }

  // End chat resets to a fresh conversation (client-side)
  {
    const { JSDOM } = require(JSDOM_PATH);
    const dom = await JSDOM.fromURL(base + '/', {
      runScripts: 'dangerously',
      resources: 'usable',
      pretendToBeVisual: true,
      beforeParse(window) {
        window.fetch = (u, o) => fetch(new URL(u, base), o);
        try { window.localStorage.clear(); } catch (e) {}
      },
    });
    const w = dom.window;
    const d = w.document;
    await new Promise((res) => w.addEventListener('load', res));
    await new Promise((r) => setTimeout(r, 300));

    const input = d.getElementById('chat-input');
    const form = d.getElementById('composer');
    const oldSession = w.localStorage.getItem('fd_session');

    input.value = 'What time do you open on Saturday?';
    form.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 700));
    let bots = d.querySelectorAll('.bot-msg');
    check('Fresh chat answers a question', bots.length >= 1 && /9:00 am/.test(bots[bots.length - 1].textContent));

    input.value = "I'm done, thanks!";
    form.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 3200));

    const users = d.querySelectorAll('.msg.user');
    bots = d.querySelectorAll('.bot-msg');
    const lastBot = bots.length ? bots[bots.length - 1].textContent : '';
    const newSession = w.localStorage.getItem('fd_session');
    check('End chat clears the conversation', users.length === 0);
    check('End chat shows a fresh greeting', /help with clinic timings/i.test(lastBot));
    check('End chat starts a new session', !!newSession && newSession !== oldSession);
    w.close();
  }

  // New chat button resets immediately
  {
    const { JSDOM } = require(JSDOM_PATH);
    const dom = await JSDOM.fromURL(base + '/', {
      runScripts: 'dangerously',
      resources: 'usable',
      pretendToBeVisual: true,
      beforeParse(window) {
        window.fetch = (u, o) => fetch(new URL(u, base), o);
        try { window.localStorage.clear(); } catch (e) {}
      },
    });
    const w = dom.window;
    const d = w.document;
    await new Promise((res) => w.addEventListener('load', res));
    await new Promise((r) => setTimeout(r, 300));

    const input = d.getElementById('chat-input');
    const form = d.getElementById('composer');
    const oldSession = w.localStorage.getItem('fd_session');

    input.value = 'What are your prices?';
    form.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 700));
    check('New chat: question answered first', d.querySelectorAll('.msg.user').length === 1);

    const btn = d.getElementById('new-chat');
    check('New chat button exists', !!btn);
    btn.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 200));

    const users = d.querySelectorAll('.msg.user');
    const bots = d.querySelectorAll('.bot-msg');
    const lastBot = bots.length ? bots[bots.length - 1].textContent : '';
    const newSession = w.localStorage.getItem('fd_session');
    check('New chat clears messages', users.length === 0);
    check('New chat shows greeting', /help with clinic timings/i.test(lastBot));
    check('New chat starts a new session', !!newSession && newSession !== oldSession);
    w.close();
  }

  // Digital receipt renders for a booking
  {
    const { JSDOM } = require(JSDOM_PATH);
    const dom = await JSDOM.fromURL(base + '/', {
      runScripts: 'dangerously',
      resources: 'usable',
      pretendToBeVisual: true,
      beforeParse(window) {
        window.fetch = (u, o) => fetch(new URL(u, base), o);
        try { window.localStorage.clear(); } catch (e) {}
      },
    });
    const w = dom.window;
    const d = w.document;
    await new Promise((res) => w.addEventListener('load', res));
    await new Promise((r) => setTimeout(r, 300));

    const input = d.getElementById('chat-input');
    const form = d.getElementById('composer');
    input.value = 'I want to book an appointment for tomorrow at 3 pm';
    form.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 900));

    const receipt = d.querySelector('.receipt');
    check('Booking shows a receipt card', !!receipt);
    check('Receipt shows a reference', !!receipt && /FD-/.test(receipt.textContent));
    check('Receipt shows the requested time', !!receipt && /tomorrow at 3 pm/.test(receipt.textContent));
    check('Receipt has a print/save button', !!receipt && !!receipt.querySelector('.receipt-print'));
    w.close();
  }

  // Bonus 6 (theme): dark/light toggle + persistence
  {
    const { JSDOM } = require(JSDOM_PATH);
    const dom = await JSDOM.fromURL(base + '/', {
      runScripts: 'dangerously',
      resources: 'usable',
      pretendToBeVisual: true,
      beforeParse(window) {
        window.fetch = (u, o) => fetch(new URL(u, base), o);
        try { window.localStorage.setItem('fd_theme', 'dark'); } catch (e) {}
      },
    });
    const w = dom.window;
    const d = w.document;
    await new Promise((res) => w.addEventListener('load', res));
    await new Promise((r) => setTimeout(r, 300));

    check('Theme initialises to dark from storage', d.documentElement.getAttribute('data-theme') === 'dark');
    const btn = d.getElementById('theme-toggle');
    check('Theme toggle button exists', !!btn);
    check('Toggle label reflects dark mode', !!btn && /light/i.test(btn.textContent));

    btn.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 100));
    check('Toggle switches to light', d.documentElement.getAttribute('data-theme') === 'light');
    check('Toggle persists choice', w.localStorage.getItem('fd_theme') === 'light');
    w.close();
  }

  // Bonus 7 (responsive): stylesheet guards against sideways scroll + has dark theme
  {
    const css = fs.readFileSync(path.join(__dirname, '..', 'public', 'styles.css'), 'utf8');
    check('CSS sets border-box globally', /box-sizing:\s*border-box/.test(css));
    check('CSS guards against sideways scroll', /overflow-x:\s*hidden/.test(css));
    check('CSS has a narrow-screen breakpoint', /max-width:\s*380px/.test(css));
    check('CSS defines dark theme variables', /\[data-theme="dark"\]/.test(css));
  }

  // Bonus 5: staff ticket queue shows ageing + priority, and staff reply closes loop
  {
    const tickets = await getJSON(base + '/api/tickets');
    check('Tickets exist for staff queue', tickets.tickets.length >= 1);

    const { JSDOM } = require(JSDOM_PATH);
    const dom = await JSDOM.fromURL(base + '/staff', {
      runScripts: 'dangerously',
      resources: 'usable',
      pretendToBeVisual: true,
      beforeParse(window) {
        window.fetch = (u, o) => fetch(new URL(u, base), o);
      },
    });
    const w = dom.window;
    await new Promise((res) => w.addEventListener('load', res));
    await new Promise((r) => setTimeout(r, 800));
    const d = w.document;

    const queue = d.getElementById('ticket-queue');
    const cards = queue ? queue.querySelectorAll('[data-ticket]') : [];
    check('Staff queue renders ticket cards', cards.length >= 1);
    check('Each ticket card exposes data-status', cards[0].getAttribute('data-status') !== null);
    check('Ticket card shows a priority badge', !!cards[0].querySelector('.prio'));
    check('Ticket card shows age text', /Age:/.test(cards[0].textContent));

    // clinic editor loads JSON
    const cj = d.getElementById('clinic-json');
    check('Clinic editor is prefilled with JSON', cj && /Root canal/.test(cj.value));

    // reply to a needs-human ticket
    const target = tickets.tickets.filter((t) => t.status === 'needs human')[0];
    if (target) {
      const r = await postJSON(base + '/api/tickets/' + target.id + '/reply', { reply: 'Yes, we can help with that.' });
      check('Staff reply sets ticket to answered', r.ticket.status === 'answered');
    }

    const forClose = await chat('close1', 'Do you offer teeth jewellery?');
    check('Close: a ticket is created', !!forClose.ticket);
    const closeRes = await postJSON(base + '/api/tickets/' + forClose.ticket.id + '/close', {});
    check('Staff can close a ticket', !!closeRes.ticket && closeRes.ticket.status === 'closed');
    w.close();
  }

  // Doctor availability answers
  {
    const r1 = await chat('a1', 'Is Dr. Sneha available on Saturday?');
    check('Availability: doctor works Saturday', r1.intent === 'doctor_day_yes' && /saturday/i.test(r1.reply) && /sneha/i.test(r1.reply));
    check('Availability answer labelled from clinic file', r1.label === 'Answered from the clinic file.');
    check('Availability answer creates no ticket', !r1.ticket);

    const r2 = await chat('a2', 'Is Dr. Imran available on Sunday?');
    check('Availability: doctor off Sunday', r2.intent === 'doctor_day_no' && /not available/i.test(r2.reply) && /tuesday/i.test(r2.reply));

    const r3 = await chat('a3', 'When is Dr. Imran available?');
    check('Availability: doctor days listed', r3.intent === 'doctor_days' && /tuesday/i.test(r3.reply) && /saturday/i.test(r3.reply));

    const r4 = await chat('a4', 'Which doctors are available on Wednesday?');
    check('Availability: doctors on a day', r4.intent === 'doctors_on_day' && /meera/i.test(r4.reply));
    check('Availability: only working doctors listed', /imran/i.test(r4.reply) === false && /sneha/i.test(r4.reply) === false);
  }

  // Availability-aware booking
  {
    const r1 = await chat('ab1', 'Can I book on Sunday at 3 pm?');
    check('Booking on Sunday is flagged', r1.intent === 'booking_sunday' && /sunday/i.test(r1.reply) && /monday to saturday/i.test(r1.reply));
    check('Sunday booking still creates a ticket', !!r1.ticket && r1.ticket.status === 'needs human');
    const all = await getJSON(base + '/api/tickets');
    const sun = all.tickets.filter((t) => t.sessionId === 'ab1')[0];
    check('Sunday booking ticket records availability false', sun && sun.available === false);

    const r2 = await chat('ab2', 'Can I book with Dr. Imran on Tuesday at 3 pm?');
    check('Booking with an available doctor confirms doctor', r2.intent === 'booking_doctor_ok' && /imran/i.test(r2.reply));
    check('Receipt names the doctor', !!r2.receipt && r2.receipt.doctor === 'Dr. Imran Qureshi' && r2.receipt.available === true);

    const r3 = await chat('ab3', 'Book on Monday at 2 pm');
    check('Booking in the lunch break is flagged', r3.intent === 'booking_hours' && /lunch/i.test(r3.reply));

    const r4 = await chat('ab4', 'Can I book on Friday at 9 pm?');
    check('Booking after hours is flagged', r4.intent === 'booking_hours' && /9 pm/i.test(r4.reply));

    const r5 = await chat('ab5', 'I want to book with Dr. Meera on Sunday at 11 am');
    check('Unavailable doctor beats the hours check', r5.intent === 'booking_doctor_unavailable' && /not available/i.test(r5.reply));
    check('Unavailable-doctor booking still gets a receipt', !!r5.receipt && /sunday at 11 am/i.test(r5.reply));
  }

  // Doctor + availability surface in the patient receipt and the staff card
  {
    const { JSDOM } = require(JSDOM_PATH);
    const dom = await JSDOM.fromURL(base + '/', {
      runScripts: 'dangerously',
      resources: 'usable',
      pretendToBeVisual: true,
      beforeParse(window) {
        window.fetch = (u, o) => fetch(new URL(u, base), o);
        try { window.localStorage.clear(); } catch (e) {}
      },
    });
    const w = dom.window;
    const d = w.document;
    await new Promise((res) => w.addEventListener('load', res));
    await new Promise((r) => setTimeout(r, 300));

    const input = d.getElementById('chat-input');
    const form = d.getElementById('composer');
    input.value = 'I want to book with Dr. Imran on Tuesday at 3 pm';
    form.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 900));

    const receipt = d.querySelector('.receipt');
    check('Receipt card shows the doctor', !!receipt && /Doctor/.test(receipt.textContent) && /Imran Qureshi/.test(receipt.textContent));
    check('Receipt card shows availability', !!receipt && /Open at requested time/.test(receipt.textContent));
    w.close();

    const tickets = await getJSON(base + '/api/tickets');
    const mine = tickets.tickets.filter((t) => t.doctor === 'Dr. Imran Qureshi' && t.available === true).pop();
    check('Booking ticket stores doctor and availability', !!mine);

    const dom2 = await JSDOM.fromURL(base + '/staff', {
      runScripts: 'dangerously',
      resources: 'usable',
      pretendToBeVisual: true,
      beforeParse(window) {
        window.fetch = (u, o) => fetch(new URL(u, base), o);
      },
    });
    const w2 = dom2.window;
    await new Promise((res) => w2.addEventListener('load', res));
    await new Promise((r) => setTimeout(r, 800));
    const card = w2.document.querySelector('[data-ticket="' + mine.id + '"]');
    check('Staff card shows the requested doctor', !!card && /Doctor: Dr. Imran Qureshi/.test(card.textContent));
    check('Staff card shows the availability note', !!card && /Availability: open at requested time/.test(card.textContent));
    w2.close();
  }

  server.close();
  console.log('\nAll ' + passed + ' bonus checks passed.');
  process.exit(0);
}

main().catch((e) => {
  console.error(e && e.stack ? e.stack : e);
  process.exit(1);
});

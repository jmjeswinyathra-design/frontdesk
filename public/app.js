(function () {
  var chatEl = document.getElementById('chat');
  var formEl = document.getElementById('composer');
  var inputEl = document.getElementById('chat-input');
  var sendEl = document.getElementById('chat-send');

  var SESSION_KEY = 'fd_session';
  var MSGS_KEY = 'fd_messages';
  var SHOWN_KEY = 'fd_shown_staff';
  var GREETING = 'Hello! I can help with clinic timings, doctors, prices, insurance and location. What would you like to know?';

  function getSession() {
    var id = localStorage.getItem(SESSION_KEY);
    if (!id) {
      id = (window.crypto && crypto.randomUUID && crypto.randomUUID()) || ('s_' + Date.now() + '_' + Math.random().toString(36).slice(2));
      localStorage.setItem(SESSION_KEY, id);
    }
    return id;
  }

  var sessionId = getSession();

  function loadMsgs() {
    try { return JSON.parse(localStorage.getItem(MSGS_KEY) || '[]'); } catch (e) { return []; }
  }
  function saveMsgs(list) {
    try { localStorage.setItem(MSGS_KEY, JSON.stringify(list)); } catch (e) {}
  }

  var messages = loadMsgs();
  var shownStaff = {};
  try { shownStaff = JSON.parse(localStorage.getItem(SHOWN_KEY) || '{}'); } catch (e) {}
  function saveShown() {
    try { localStorage.setItem(SHOWN_KEY, JSON.stringify(shownStaff)); } catch (e) {}
  }

  function scrollToBottom() {
    chatEl.scrollTop = chatEl.scrollHeight;
  }

  function addBubble(role, text, extra) {
    var wrap = document.createElement('div');
    if (role === 'user') wrap.className = 'msg user';
    else if (role === 'staff') wrap.className = 'msg staff';
    else wrap.className = 'msg bot bot-msg';

    if (role === 'staff') {
      var who = document.createElement('span');
      who.className = 'who';
      who.textContent = 'Staff';
      wrap.appendChild(who);
    }

    var span = document.createElement('span');
    span.textContent = text;
    wrap.appendChild(span);

    if (extra && extra.label && role === 'bot') {
      var lab = document.createElement('span');
      lab.className = 'label';
      lab.textContent = ' ' + extra.label;
      wrap.appendChild(lab);
    }

    if (extra && extra.emergency && role === 'bot') wrap.classList.add('emergency');

    chatEl.appendChild(wrap);

    if (extra && extra.ticketNote) {
      var note = document.createElement('div');
      note.className = 'ticket-note';
      note.textContent = extra.ticketNote;
      chatEl.appendChild(note);
    }

    scrollToBottom();
    return wrap;
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function receiptRows(r) {
    var avail = '';
    if (r.available === true) avail = 'Open at requested time';
    else if (r.available === false) avail = 'Outside clinic hours - team will suggest a slot';
    return '' +
      '<div class="receipt-row"><span class="k">Reference</span><span class="v">' + escapeHtml(r.reference) + '</span></div>' +
      '<div class="receipt-row"><span class="k">Clinic</span><span class="v">' + escapeHtml(r.clinic) + '</span></div>' +
      '<div class="receipt-row"><span class="k">Requested</span><span class="v">' + escapeHtml(r.time) + '</span></div>' +
      (r.doctor ? '<div class="receipt-row"><span class="k">Doctor</span><span class="v">' + escapeHtml(r.doctor) + '</span></div>' : '') +
      (avail ? '<div class="receipt-row"><span class="k">Availability</span><span class="v">' + escapeHtml(avail) + '</span></div>' : '') +
      '<div class="receipt-row"><span class="k">Status</span><span class="v">' + escapeHtml(r.status) + '</span></div>' +
      '<div class="receipt-row"><span class="k">Phone</span><span class="v"><a href="tel:' + escapeHtml(String(r.phone).replace(/[^0-9+]/g, '')) + '">' + escapeHtml(r.phone) + '</a></span></div>' +
      '<div class="receipt-row"><span class="k">Address</span><span class="v">' + escapeHtml(r.address) + '</span></div>';
  }

  function addReceipt(r) {
    if (!r) return;
    var wrap = document.createElement('div');
    wrap.className = 'receipt';
    wrap.innerHTML =
      '<div class="receipt-head">' +
        '<span class="receipt-title">Booking receipt</span>' +
        '<span class="receipt-ref">' + escapeHtml(r.reference) + '</span>' +
      '</div>' +
      '<div class="receipt-rows">' + receiptRows(r) + '</div>' +
      '<p class="receipt-foot">Show this reference at the front desk. Our team will call you to confirm the slot.</p>' +
      '<div class="receipt-actions">' +
        '<button type="button" class="receipt-print">Print / Save PDF</button>' +
      '</div>';
    var btn = wrap.querySelector('.receipt-print');
    btn.addEventListener('click', function () { printReceipt(r); });
    chatEl.appendChild(wrap);
    scrollToBottom();
    return wrap;
  }

  function printReceipt(r) {
    var w = window.open('', '_blank', 'width=420,height=680');
    if (!w) return;
    var html = '<!doctype html><html><head><meta charset="utf-8"><title>Receipt ' + escapeHtml(r.reference) + '</title>' +
      '<style>' +
      'body{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;padding:24px;color:#1f2430;max-width:420px;margin:0 auto}' +
      'h1{font-size:18px;margin:0 0 4px}.ref{font-family:ui-monospace,Menlo,Consolas,monospace;color:#2f6df6;font-weight:700}' +
      '.rows{margin:18px 0;border-top:1px dashed #ccc;border-bottom:1px dashed #ccc;padding:12px 0}' +
      '.receipt-row{display:flex;justify-content:space-between;gap:12px;padding:4px 0;font-size:14px}' +
      '.k{color:#667085}.v{text-align:right;overflow-wrap:anywhere}a{color:#2f6df6}' +
      '.foot{font-size:13px;color:#667085;margin-top:14px}' +
      '</style></head><body>' +
      '<h1>' + escapeHtml(r.clinic) + '</h1>' +
      '<div class="ref">Booking receipt ' + escapeHtml(r.reference) + '</div>' +
      '<div class="rows">' + receiptRows(r) + '</div>' +
      '<div class="foot">Show this reference at the front desk. Our team will call you to confirm the slot.</div>' +
      '</body></html>';
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(function () { try { w.print(); } catch (e) {} }, 350);
  }

  function renderAll(showGreeting) {
    chatEl.innerHTML = '';
    if (!messages.length) {
      if (showGreeting) addBubble('bot', GREETING);
      return;
    }
    messages.forEach(function (m) {
      if (m.role === 'receipt') { addReceipt(m.receipt); return; }
      addBubble(m.role, m.text, { label: m.label, ticketNote: m.ticketNote, emergency: m.emergency });
    });
  }

  function resetChat() {
    try {
      localStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(MSGS_KEY);
      localStorage.removeItem(SHOWN_KEY);
    } catch (e) {}
    try {
      if (location.search) history.replaceState(null, '', location.pathname);
    } catch (e) {}
    sessionId = getSession();
    messages = [];
    shownStaff = {};
    renderAll(true);
    document.title = 'Bright Roots Dental - Chat';
    scrollToBottom();
    sendEl.disabled = false;
    inputEl.value = '';
    inputEl.focus();
    if (chatEl && chatEl.scrollIntoView) {
      try { chatEl.scrollIntoView({ block: 'start' }); } catch (e) {}
    }
    try { window.scrollTo(0, 0); } catch (e) {}
  }

  function finishAndReset() {
    sendEl.disabled = true;
    setTimeout(resetChat, 1800);
  }

  function send(text) {
    var clean = String(text || '').trim();
    if (!clean) return;
    addBubble('user', clean);
    messages.push({ role: 'user', text: clean });
    inputEl.value = '';
    sendEl.disabled = true;
    var ended = false;

    fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: sessionId, message: clean }),
    })
      .then(function (r) { if (!r.ok) throw new Error('chat failed'); return r.json(); })
      .then(function (data) {
        var extra = { label: data.label, emergency: data.kind === 'emergency' };
        if (data.ticket && !data.receipt) {
          extra.ticketNote = 'Ticket #' + String(data.ticket.id).slice(0, 8) + ' - status: ' + data.ticket.status;
        }
        addBubble('bot', data.reply, extra);
        messages.push({ role: 'bot', text: data.reply, label: data.label, ticketNote: extra.ticketNote, emergency: extra.emergency });
        if (data.receipt) {
          addReceipt(data.receipt);
          messages.push({ role: 'receipt', receipt: data.receipt });
        }
        saveMsgs(messages);
        if (data.kind === 'ended') {
          ended = true;
          var done = document.createElement('div');
          done.className = 'ticket-note';
          done.textContent = 'Chat complete - starting a new chat...';
          chatEl.appendChild(done);
          scrollToBottom();
        }
      })
      .catch(function () {
        addBubble('bot', 'Sorry, something went wrong. Please try again.');
        saveMsgs(messages);
      })
      .then(function () {
        if (ended) {
          finishAndReset();
        } else {
          sendEl.disabled = false;
          inputEl.focus();
        }
      });
  }

  formEl.addEventListener('submit', function (e) {
    e.preventDefault();
    send(inputEl.value);
  });

  inputEl.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(inputEl.value);
    }
  });

  var quick = document.getElementById('quick');
  if (quick) {
    quick.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('button[data-q]') : null;
      if (!btn) return;
      send(btn.getAttribute('data-q'));
    });
  }

  var newChatBtn = document.getElementById('new-chat');
  if (newChatBtn) {
    newChatBtn.addEventListener('click', function () {
      resetChat();
    });
  }

  function pollStaff() {
    fetch('/api/session/' + encodeURIComponent(sessionId))
      .then(function (r) { return r.json(); })
      .then(function (data) {
        (data.tickets || []).forEach(function (t) {
          if (t.reply && !shownStaff[t.id]) {
            shownStaff[t.id] = true;
            addBubble('staff', t.reply);
            messages.push({ role: 'staff', text: t.reply });
            saveMsgs(messages);
            saveShown();
          }
        });
      })
      .catch(function () {});
  }

  function applyConfig(cfg) {
    if (!cfg) return;
    var h = document.querySelector('.topbar h1');
    if (h && cfg.name) h.textContent = cfg.name;
    var s = document.querySelector('.sub');
    if (s && cfg.address) s.textContent = 'Front desk assistant - ' + cfg.address;
    var call = document.getElementById('call-link');
    if (call && cfg.phone) {
      call.textContent = 'Call ' + cfg.phone;
      call.href = 'tel:' + String(cfg.phone).replace(/[^0-9+]/g, '');
    }
    var emg = document.getElementById('emg-link');
    if (emg && cfg.emergency) {
      emg.textContent = 'Emergency ' + cfg.emergency;
      emg.href = 'tel:' + String(cfg.emergency).replace(/[^0-9+]/g, '');
    }
  }

  fetch('/api/config')
    .then(function (r) { return r.json(); })
    .then(applyConfig)
    .catch(function () {
      addBubble('bot', 'Cannot reach the FrontDesk server. Start it with "npm start" and open http://localhost:3000 (do not open the HTML file directly).');
    });

  var qParam = new URLSearchParams(location.search).get('q');

  renderAll(!qParam);
  scrollToBottom();
  pollStaff();
  setInterval(pollStaff, 3000);

  if (qParam) {
    send(qParam);
  }
})();
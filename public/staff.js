(function () {
  var queueEl = document.getElementById('ticket-queue');
  var filterEl = document.getElementById('filter');
  var refreshEl = document.getElementById('refresh');
  var countEl = document.getElementById('count');
  var clinicJsonEl = document.getElementById('clinic-json');
  var clinicSaveEl = document.getElementById('clinic-save');
  var clinicMsgEl = document.getElementById('clinic-msg');

  function statusClass(status) {
    if (status === 'urgent') return 'badge urgent';
    if (status === 'needs human') return 'badge warn';
    if (status === 'answered') return 'badge ok';
    if (status === 'closed') return 'badge';
    return 'badge';
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function fmtTime(iso) {
    try { return new Date(iso).toLocaleString(); } catch (e) { return iso || ''; }
  }

  function ageString(iso) {
    var t = new Date(iso).getTime();
    if (isNaN(t)) return '';
    var diff = Math.max(0, Date.now() - t);
    var mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return mins + ' min';
    var hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + ' hr ' + (mins % 60) + ' min';
    var days = Math.floor(hrs / 24);
    return days + ' day' + (days > 1 ? 's' : '') + ' ' + (hrs % 24) + ' hr';
  }

  function priorityOf(t) {
    if (t.status === 'answered' || t.status === 'closed') return { label: 'done', rank: 3 };
    if (t.status === 'urgent') return { label: 'high', rank: 0 };
    var ageMin = (Date.now() - new Date(t.createdAt).getTime()) / 60000;
    if (ageMin >= 60) return { label: 'high', rank: 0 };
    if (ageMin >= 15) return { label: 'medium', rank: 1 };
    return { label: 'normal', rank: 2 };
  }

  function render(list) {
    var filter = filterEl.value;
    var visible = list.filter(function (t) { return filter === 'all' || t.status === filter; });
    countEl.textContent = visible.length + ' ticket(s)';

    if (!visible.length) {
      queueEl.innerHTML = '<p class="empty">No tickets to show.</p>';
      return;
    }

    queueEl.innerHTML = '';
    visible
      .slice()
      .sort(function (a, b) {
        var pa = priorityOf(a);
        var pb = priorityOf(b);
        if (pa.rank !== pb.rank) return pa.rank - pb.rank;
        return String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
      })
      .forEach(function (t) {
        var pr = priorityOf(t);
        var card = document.createElement('article');
        card.className = 'ticket';
        card.setAttribute('data-ticket', t.id);
        card.setAttribute('data-status', t.status);
        card.innerHTML =
          '<div class="ticket-head">' +
            '<span class="' + statusClass(t.status) + '">' + escapeHtml(t.status) + '</span>' +
            '<span class="prio prio-' + pr.label + '">' + escapeHtml(pr.label) + '</span>' +
            (t.type ? '<span class="ttype">' + escapeHtml(t.type) + '</span>' : '') +
            '<span class="tid">#' + escapeHtml(String(t.id || '').slice(0, 8)) + '</span>' +
          '</div>' +
          (t.time ? '<p class="when">Requested: ' + escapeHtml(t.time) + '</p>' : '') +
          (t.doctor ? '<p class="when">Doctor: ' + escapeHtml(t.doctor) + '</p>' : '') +
          (t.available === true ? '<p class="when">Availability: open at requested time</p>' : t.available === false ? '<p class="when">Availability: outside clinic hours</p>' : '') +
          '<p class="q">' + escapeHtml(t.question) + '</p>' +
          '<p class="meta">Ref FD-' + escapeHtml(String(t.id || '').replace(/-/g, '').slice(0, 8).toUpperCase()) + ' - Session ' + escapeHtml(String(t.sessionId || '').slice(0, 8)) + ' - ' + escapeHtml(fmtTime(t.createdAt)) + ' - Age: ' + escapeHtml(ageString(t.createdAt)) + '</p>' +
          (t.reply
            ? '<div class="reply"><span class="who">Staff reply</span>' + escapeHtml(t.reply) + '</div>'
            : '') +
          '<div class="reply-box">' +
            '<textarea id="staff-reply" rows="2" placeholder="Type a reply to the patient..."></textarea>' +
            '<div class="reply-actions">' +
              (t.status !== 'closed' ? '<button type="button" id="staff-close" class="close-ticket">Close</button>' : '') +
              '<button type="button" id="staff-send" class="send-reply">Send reply</button>' +
            '</div>' +
          '</div>';

        var ta = card.querySelector('#staff-reply');
        var btn = card.querySelector('#staff-send');
        btn.addEventListener('click', function () {
          var text = ta.value.trim();
          if (!text) { ta.focus(); return; }
          btn.disabled = true;
          btn.textContent = 'Sending...';
          fetch('/api/tickets/' + encodeURIComponent(t.id) + '/reply', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reply: text }),
          })
            .then(function (r) { if (!r.ok) throw new Error('reply failed'); return r.json(); })
            .then(function () {
              card.setAttribute('data-status', 'answered');
              var badge = card.querySelector('.badge');
              if (badge) { badge.className = 'badge ok'; badge.textContent = 'answered'; }
              var p = card.querySelector('.prio');
              if (p) { p.className = 'prio prio-done'; p.textContent = 'done'; }
              load();
            })
            .catch(function () { btn.disabled = false; btn.textContent = 'Send reply'; });
        });

        var closeBtn = card.querySelector('#staff-close');
        if (closeBtn) {
          closeBtn.addEventListener('click', function () {
            closeBtn.disabled = true;
            fetch('/api/tickets/' + encodeURIComponent(t.id) + '/close', { method: 'POST' })
              .then(function (r) { if (!r.ok) throw new Error('close failed'); return r.json(); })
              .then(function () {
                card.setAttribute('data-status', 'closed');
                var badge = card.querySelector('.badge');
                if (badge) { badge.className = 'badge'; badge.textContent = 'closed'; }
                var p = card.querySelector('.prio');
                if (p) { p.className = 'prio prio-done'; p.textContent = 'done'; }
                if (closeBtn.parentNode) closeBtn.parentNode.removeChild(closeBtn);
                load();
              })
              .catch(function () { closeBtn.disabled = false; });
          });
        }
        queueEl.appendChild(card);
      });
  }

  function load() {
    fetch('/api/tickets')
      .then(function (r) { return r.json(); })
      .then(function (data) { render(data.tickets || []); })
      .catch(function () { queueEl.innerHTML = '<p class="empty">Failed to load tickets.</p>'; });
  }

  function loadClinic() {
    fetch('/api/clinic')
      .then(function (r) { return r.json(); })
      .then(function (c) { clinicJsonEl.value = JSON.stringify(c, null, 2); })
      .catch(function () { clinicMsgEl.textContent = 'Failed to load clinic data'; });
  }

  clinicSaveEl.addEventListener('click', function () {
    var obj;
    try { obj = JSON.parse(clinicJsonEl.value); }
    catch (e) { clinicMsgEl.textContent = 'Invalid JSON'; return; }
    clinicMsgEl.textContent = 'Saving...';
    fetch('/api/clinic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(obj),
    })
      .then(function (r) { return r.json(); })
      .then(function (d) { clinicMsgEl.textContent = d.ok ? 'Saved - answers updated' : (d.error || 'Save failed'); })
      .catch(function () { clinicMsgEl.textContent = 'Save failed'; });
  });

  filterEl.addEventListener('change', load);
  refreshEl.addEventListener('click', load);

  load();
  loadClinic();
  setInterval(load, 5000);
})();
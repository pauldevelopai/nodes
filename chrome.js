/*
 * chrome.js — the ONE shared Grounded chrome for every non-React surface.
 *
 * Served statically at https://grounded.developai.co.za/nodes/chrome.js (Caddy
 * fronts /var/www/nodes). Include it on any page with:
 *
 *     <script src="/nodes/chrome.js" defer></script>
 *
 * It injects, identically everywhere:
 *   • the top nav — Home · Builder ▾ (Nodes, Tools) · Tracker ▾ (Lawsuits,
 *     Regulations, Connections, Use cases, Sources) · auth area
 *   • the feedback bubble (signed-in only; logged-out → sign-in prompt) →
 *     POST /api/feedback, lands in the admin Feedback page
 *   • the AI-law chat bubble → POST /public/chat
 *
 * It is auth-aware on its own (GET /api/auth/me), so any surface gets the same
 * chrome with zero per-page logic. Changing the menu = edit THIS file + pull
 * the nodes repo on the box; nothing else redeploys. (That's the whole point —
 * before this, every surface carried its own copy of the nav and they drifted.)
 *
 * Opt out of the nav (e.g. the React app, which renders its own) with:
 *     <script>window.GROUNDED_CHROME = { nav: false };</script>
 *     <script src="/nodes/chrome.js" defer></script>
 */
(function () {
  if (window.__groundedChrome) return;
  window.__groundedChrome = true;

  var cfg = window.GROUNDED_CHROME || {};
  var SHOW_NAV = cfg.nav !== false; // default on

  var BUILDER = [
    { label: 'Nodes', href: '/nodes/' },
    { label: 'Tools', href: '/tools/' },
    { label: 'Workflow builder', href: '/builder' },
    { label: 'Run a workflow', href: '/run' },
    { label: 'Tools & Agents', href: '/tools-hub' },
  ];
  var TRACKER = [
    { label: 'Lawsuits', href: '/legal/lawsuits' },
    { label: 'Regulations', href: '/legal/regulations' },
    { label: 'Connections', href: '/legal/explore' },
    { label: 'Use cases', href: '/legal/use-cases' },
  ];
  var DATA = [
    { label: 'Sources', href: '/legal/sources' },
  ];
  var AREAS =['General', 'Nodes', 'Tools', 'Lawsuits', 'Regulations', 'Connections', 'Use cases', 'Sources'];
  var CHAT_SUGGESTIONS = [
    'What cases has OpenAI been sued in?',
    'When does the EU AI Act take effect?',
    'What is the Colorado AI Act?',
  ];
  var TERRACOTTA = '#c4761b';

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function el(html) { var t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; }

  // ── Styles ──────────────────────────────────────────────────────────────
  var css = document.createElement('style');
  css.id = 'gc-style';
  css.textContent = [
    "#gc-nav{display:block;border-bottom:1px solid #E2E8F0;background:#fff;font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif;font-size:14px;line-height:1.45;position:sticky;top:0;z-index:9000}",
    '#gc-nav *,#gc-bubbles *,.gc-panel *{box-sizing:border-box}',
    '#gc-nav .gc-bar{max-width:1200px;margin:0 auto;padding:12px 24px;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}',
    '#gc-nav .gc-brand{text-decoration:none;color:#1A202C;display:flex;flex-direction:column;line-height:1.2}',
    '#gc-nav .gc-brand b{font-size:20px;font-weight:700;letter-spacing:-0.01em}',
    '#gc-nav .gc-brand span{font-size:11px;color:#718096;font-weight:500}',
    '#gc-nav .gc-links{display:flex;gap:4px;align-items:center;flex-wrap:wrap}',
    '#gc-nav .gc-links>a,#gc-nav .gc-dd>button{padding:8px 12px;border-radius:6px;font-weight:500;font-size:14px;font-family:inherit;color:#718096;text-decoration:none;background:transparent;border:none;cursor:pointer;display:flex;align-items:center;gap:4px}',
    '#gc-nav .gc-links>a:hover,#gc-nav .gc-dd>button:hover{color:#1A202C}',
    '#gc-nav .gc-links>a.active,#gc-nav .gc-dd>button.active{font-weight:600;color:#1A202C;background:#EEF2FF}',
    '#gc-nav .gc-dd{position:relative}',
    '#gc-nav .gc-menu{position:absolute;top:calc(100% + 6px);left:0;min-width:180px;background:#fff;border:1px solid #E2E8F0;border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.12);padding:6px;z-index:9001;display:none;flex-direction:column}',
    '#gc-nav .gc-menu.open{display:flex}',
    '#gc-nav .gc-menu a{padding:8px 12px;font-weight:500;font-size:14px;font-family:inherit;color:#1A202C;text-decoration:none;border-radius:6px;white-space:nowrap}',
    '#gc-nav .gc-menu a:hover{background:#EEF2FF}',
    '#gc-nav .gc-auth{display:flex;align-items:center;gap:10px;padding-left:10px;margin-left:4px;border-left:1px solid #E2E8F0}',
    '#gc-nav .gc-email{font-size:13px;color:#1A202C;font-weight:600;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '#gc-nav .gc-btn{font-weight:500;font-size:13px;font-family:inherit;color:#718096;background:none;border:1px solid #E2E8F0;border-radius:6px;padding:7px 12px;cursor:pointer;text-decoration:none}',
    '#gc-nav .gc-btn:hover{color:#1A202C;border-color:#CBD5E1}',
    // bubbles
    '#gc-bubbles{position:fixed;right:20px;bottom:20px;z-index:99990;display:flex;flex-direction:column;gap:12px;align-items:flex-end}',
    '#gc-bubbles .gc-bub{width:52px;height:52px;border-radius:50%;background:' + TERRACOTTA + ';color:#fff;border:none;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center}',
    '#gc-bubbles .gc-bub:hover{background:#a8543a}',
    '#gc-bubbles .gc-bub svg{width:22px;height:22px}',
    '.gc-panel{position:fixed;right:20px;bottom:84px;z-index:99991;width:330px;max-width:calc(100vw - 40px);background:#fff;border:1px solid #E2E8F0;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.18);padding:18px;display:none;font-family:-apple-system,BlinkMacSystemFont,sans-serif;color:#1A202C}',
    '.gc-panel.open{display:block}',
    '.gc-panel h4{margin:0 0 10px;font-size:15px;display:flex;justify-content:space-between;align-items:center}',
    '.gc-panel h4 .gc-x{background:none;border:none;cursor:pointer;font-size:16px;color:#718096}',
    '.gc-panel label{display:block;font-size:12px;font-weight:600;margin:0 0 4px}',
    '.gc-panel select,.gc-panel textarea,.gc-panel input{width:100%;padding:8px;border:1px solid #E2E8F0;border-radius:6px;font:inherit;font-size:13px;margin-bottom:10px}',
    '.gc-panel textarea{resize:vertical;min-height:78px;margin-bottom:8px}',
    '.gc-types{display:flex;gap:5px;flex-wrap:wrap;margin-bottom:8px}',
    '.gc-types button{padding:3px 8px;border-radius:4px;font-size:11px;cursor:pointer;border:1px solid #E2E8F0;background:#fff;color:#1A202C}',
    '.gc-types button.on{background:' + TERRACOTTA + ';color:#fff;border-color:' + TERRACOTTA + '}',
    '.gc-row{display:flex;gap:6px;align-items:center}',
    '.gc-send{padding:7px 16px;background:' + TERRACOTTA + ';color:#fff;border:none;border-radius:6px;font-weight:600;font-size:13px;font-family:inherit;cursor:pointer}',
    '.gc-send:disabled{opacity:.6;cursor:wait}',
    '.gc-note{font-size:12px;color:#718096;margin-top:8px;line-height:1.5}',
    '.gc-note a{color:' + TERRACOTTA + ';font-weight:600}',
    // chat panel specifics
    '#gc-chat-panel{display:none;flex-direction:column;height:440px;max-height:calc(100vh - 120px);padding:0;overflow:hidden}',
    '#gc-chat-panel.open{display:flex}',
    '#gc-chat-head{padding:14px 16px;border-bottom:1px solid #E2E8F0;font-size:15px;font-weight:600;display:flex;justify-content:space-between;align-items:center}',
    '#gc-chat-head small{display:block;font-weight:400;font-size:11px;color:#718096}',
    '#gc-chat-log{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px}',
    '#gc-chat-log .gc-m{font-size:13px;line-height:1.5;padding:9px 12px;border-radius:10px;max-width:88%;white-space:pre-wrap}',
    '#gc-chat-log .gc-m.u{align-self:flex-end;background:' + TERRACOTTA + ';color:#fff}',
    '#gc-chat-log .gc-m.a{align-self:flex-start;background:#F1F5F9;color:#1A202C}',
    '#gc-chat-sugg{display:flex;flex-wrap:wrap;gap:6px;padding:0 14px 8px}',
    '#gc-chat-sugg button{font:inherit;font-size:11px;text-align:left;background:#fff;border:1px solid #E2E8F0;border-radius:14px;padding:5px 10px;cursor:pointer;color:#475569}',
    '#gc-chat-form{display:flex;gap:6px;padding:12px;border-top:1px solid #E2E8F0}',
    '#gc-chat-form input{flex:1;margin:0}',
    '#gc-chat-form .gc-send{flex:0 0 auto}',
  ].join('\n');
  document.head.appendChild(css);

  // ── State ────────────────────────────────────────────────────────────────
  var user = null; // {name,email,role} once /api/auth/me resolves

  // ── Nav ────────────────────────────────────────────────────────────────
  var path = location.pathname;
  var dataActive = /^\/legal\/sources/.test(path);
  var trackerActive = /^\/legal(\/|$)/.test(path) && !dataActive;
  var builderActive = /^\/(nodes|tools-hub|tool|tools|open-source|builder|run)(\/|$)/.test(path);
  var monetisationActive = /^\/monetisation(\/|$)/.test(path);
  var trainingActive = /^\/training(\/|$)/.test(path);
  var homeActive = path === '/' ;

  function ddHtml(label, items, active) {
    return '<div class="gc-dd"><button type="button" class="' + (active ? 'active' : '') + '">' + esc(label) + ' <span style="font-size:10px">▾</span></button>' +
      '<div class="gc-menu">' + items.map(function (i) { return '<a href="' + esc(i.href) + '">' + esc(i.label) + '</a>'; }).join('') + '</div></div>';
  }

  if (SHOW_NAV && !document.getElementById('gc-nav')) {
    var nav = el(
      '<nav id="gc-nav"><div class="gc-bar">' +
      '<a class="gc-brand" href="/"><b>Grounded</b><span>Newsroom-owned AI &middot; by Develop&nbsp;AI</span></a>' +
      '<div class="gc-links">' +
      '<a href="/" class="' + (homeActive ? 'active' : '') + '">Home</a>' +
      ddHtml('Builder', BUILDER, builderActive) +
      ddHtml('Tracker', TRACKER, trackerActive) +
      '<a href="/monetisation" class="' + (monetisationActive ? 'active' : '') + '">Monetisation</a>' +
      ddHtml('Data', DATA, dataActive) +
      '<a href="/training" class="' + (trainingActive ? 'active' : '') + '">Training</a>' +
      '<span class="gc-auth" id="gc-auth"></span>' +
      '</div></div></nav>'
    );
    document.body.insertBefore(nav, document.body.firstChild);

    // Dropdown open/close
    var dds = nav.querySelectorAll('.gc-dd');
    dds.forEach(function (dd) {
      var btn = dd.querySelector('button'), menu = dd.querySelector('.gc-menu');
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var wasOpen = menu.classList.contains('open');
        nav.querySelectorAll('.gc-menu.open').forEach(function (m) { m.classList.remove('open'); });
        if (!wasOpen) menu.classList.add('open');
      });
    });
    document.addEventListener('click', function () {
      nav.querySelectorAll('.gc-menu.open').forEach(function (m) { m.classList.remove('open'); });
    });
  }

  function renderAuth() {
    var slot = document.getElementById('gc-auth');
    if (!slot) return;
    if (user) {
      var first = (user.name || user.email || '').split(' ')[0] || 'you';
      var appHref = user.role === 'admin' ? '/admin' : '/lawsuits';
      slot.innerHTML =
        '<a class="gc-btn" href="' + appHref + '" style="font-weight:600;color:#fff;background:' + TERRACOTTA + ';border-color:' + TERRACOTTA + '">' + (user.role === 'admin' ? 'Admin' : 'Open app') + '</a>' +
        '<span class="gc-email" title="' + esc(user.email || '') + '">Hi, ' + esc(first) + '</span>' +
        '<button class="gc-btn" id="gc-logout">Sign out</button>';
      var lo = document.getElementById('gc-logout');
      if (lo) lo.addEventListener('click', function () {
        fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }).then(function () { location.reload(); }).catch(function () { location.reload(); });
      });
    } else {
      var next = encodeURIComponent(location.pathname + location.search);
      slot.innerHTML = '<a class="gc-btn" href="/login?next=' + next + '">Sign&nbsp;in&nbsp;/&nbsp;Register</a>';
    }
  }

  // ── Bubbles ──────────────────────────────────────────────────────────────
  var ICON_CHAT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>';
  var ICON_FB = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';

  // Order matters: in this bottom-anchored flex column the LAST child sits in the
  // corner. Feedback is the corner button; chat stacks above it (matches the React app).
  var bubbles = el(
    '<div id="gc-bubbles">' +
    '<button class="gc-bub" id="gc-chat-btn" title="Ask the AI-law assistant">' + ICON_CHAT + '</button>' +
    '<button class="gc-bub" id="gc-fb-btn" title="Send feedback about Grounded">' + ICON_FB + '</button>' +
    '</div>'
  );
  document.body.appendChild(bubbles);

  // Feedback panel
  var fbPanel = el(
    '<div class="gc-panel" id="gc-fb-panel">' +
    '<h4>Send feedback <button class="gc-x" type="button">×</button></h4>' +
    '<div id="gc-fb-body"></div>' +
    '</div>'
  );
  document.body.appendChild(fbPanel);
  fbPanel.querySelector('.gc-x').addEventListener('click', function () { fbPanel.classList.remove('open'); });

  function renderFbBody() {
    var body = document.getElementById('gc-fb-body');
    if (!user) {
      var next = encodeURIComponent(location.pathname + location.search);
      body.innerHTML = '<p class="gc-note" style="font-size:13px;color:#1A202C">Sign in to send feedback about any part of Grounded — it goes straight to the team.</p>' +
        '<a class="gc-send" style="display:inline-block;text-decoration:none;margin-top:6px" href="/login?next=' + next + '">Sign in to send feedback</a>';
      return;
    }
    body.innerHTML =
      '<label>About</label><select id="gc-fb-area">' + AREAS.map(function (a) { return '<option>' + esc(a) + '</option>'; }).join('') + '</select>' +
      '<div class="gc-types" id="gc-fb-types">' +
      [['bug', 'Bug'], ['feature', 'Feature'], ['improvement', 'Improvement'], ['ui', 'UI/Design']].map(function (c, i) {
        return '<button type="button" data-c="' + c[0] + '" class="' + (i === 1 ? 'on' : '') + '">' + c[1] + '</button>';
      }).join('') + '</div>' +
      '<textarea id="gc-fb-text" placeholder="A bug, an idea, a question — anything."></textarea>' +
      '<div class="gc-row"><select id="gc-fb-pri" style="flex:1;margin:0"><option value="low">Low priority</option><option value="medium" selected>Medium priority</option><option value="high">High priority</option></select>' +
      '<button class="gc-send" id="gc-fb-send" type="button">Submit</button></div>' +
      '<div class="gc-note" id="gc-fb-result"></div>';

    var cat = 'feature';
    body.querySelectorAll('#gc-fb-types button').forEach(function (b) {
      b.addEventListener('click', function () { cat = b.getAttribute('data-c'); body.querySelectorAll('#gc-fb-types button').forEach(function (x) { x.classList.toggle('on', x === b); }); });
    });
    body.querySelector('#gc-fb-send').addEventListener('click', function () {
      var content = body.querySelector('#gc-fb-text').value.trim();
      var result = body.querySelector('#gc-fb-result');
      if (!content) { result.style.color = '#d9543f'; result.textContent = 'Write a message first.'; return; }
      var area = body.querySelector('#gc-fb-area').value;
      var pri = body.querySelector('#gc-fb-pri').value;
      var btn = body.querySelector('#gc-fb-send');
      btn.disabled = true; result.style.color = '#718096'; result.textContent = 'Sending…';
      fetch('/api/feedback', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content, category: cat, priority: pri, page: area + ' · ' + location.pathname }),
      }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then(function () { result.style.color = '#16a34a'; result.textContent = 'Sent — thanks!'; body.querySelector('#gc-fb-text').value = ''; setTimeout(function () { fbPanel.classList.remove('open'); result.textContent = ''; }, 1500); })
        .catch(function (e) { result.style.color = '#d9543f'; result.textContent = 'Could not send (' + e.message + ').'; })
        .finally(function () { btn.disabled = false; });
    });
  }

  document.getElementById('gc-fb-btn').addEventListener('click', function () {
    document.getElementById('gc-chat-panel').classList.remove('open');
    var was = fbPanel.classList.contains('open');
    if (!was) renderFbBody();
    fbPanel.classList.toggle('open');
  });

  // Chat panel
  var STORAGE = 'grounded_chat_v1';
  var history = [];
  try { history = JSON.parse(sessionStorage.getItem(STORAGE) || '[]'); } catch (e) {}

  var chatPanel = el(
    '<div class="gc-panel" id="gc-chat-panel">' +
    '<div id="gc-chat-head">Ask about AI &amp; law<small>Answers are scoped to AI-law topics</small><button class="gc-x" type="button" style="background:none;border:none;cursor:pointer;font-size:16px;color:#718096">×</button></div>' +
    '<div id="gc-chat-log"></div>' +
    '<div id="gc-chat-sugg"></div>' +
    '<form id="gc-chat-form"><input id="gc-chat-input" placeholder="Ask a question…" autocomplete="off"/><button class="gc-send" type="submit">Send</button></form>' +
    '</div>'
  );
  document.body.appendChild(chatPanel);
  chatPanel.querySelector('.gc-x').addEventListener('click', function () { chatPanel.classList.remove('open'); });

  var chatLog = chatPanel.querySelector('#gc-chat-log');
  var chatSugg = chatPanel.querySelector('#gc-chat-sugg');
  function renderChat() {
    chatLog.innerHTML = history.map(function (m) { return '<div class="gc-m ' + (m.role === 'user' ? 'u' : 'a') + '">' + esc(m.content) + '</div>'; }).join('');
    chatLog.scrollTop = chatLog.scrollHeight;
    chatSugg.style.display = history.length ? 'none' : 'flex';
  }
  chatSugg.innerHTML = CHAT_SUGGESTIONS.map(function (s) { return '<button type="button">' + esc(s) + '</button>'; }).join('');
  chatSugg.querySelectorAll('button').forEach(function (b) { b.addEventListener('click', function () { sendChat(b.textContent); }); });

  function sendChat(text) {
    var msg = (text || '').trim();
    if (!msg) return;
    var input = chatPanel.querySelector('#gc-chat-input');
    input.value = '';
    history.push({ role: 'user', content: msg });
    renderChat();
    history.push({ role: 'assistant', content: '…' });
    var idx = history.length - 1;
    renderChat();
    fetch('/public/chat', {
      method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg, history: history.slice(0, idx - 1).map(function (h) { return { role: h.role, content: h.content }; }) }),
    }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (res) { history[idx] = { role: 'assistant', content: res.reply || res.message || res.answer || '(no answer)' }; })
      .catch(function (e) { history[idx] = { role: 'assistant', content: 'Sorry — something went wrong (' + e.message + ').' }; })
      .finally(function () { try { sessionStorage.setItem(STORAGE, JSON.stringify(history)); } catch (e) {} renderChat(); });
  }

  chatPanel.querySelector('#gc-chat-form').addEventListener('submit', function (e) { e.preventDefault(); sendChat(chatPanel.querySelector('#gc-chat-input').value); });
  document.getElementById('gc-chat-btn').addEventListener('click', function () {
    fbPanel.classList.remove('open');
    chatPanel.classList.toggle('open');
    if (chatPanel.classList.contains('open')) { renderChat(); chatPanel.querySelector('#gc-chat-input').focus(); }
  });

  // ── Auth ─────────────────────────────────────────────────────────────────
  fetch('/api/auth/me', { credentials: 'same-origin' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (u) { user = (u && (u.user || u)) || null; if (user && !user.email && !user.name) user = null; })
    .catch(function () { user = null; })
    .finally(function () { renderAuth(); });
})();

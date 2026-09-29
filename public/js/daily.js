(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  };
  var pref = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };
  var ICON = {
    plus: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    back: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>',
    next: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>',
    trash: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/></svg>',
    pencil: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>',
    bin: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/></svg>',
    search: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>',
    sort: '<svg class="sic" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 15l6-6 6 6"/></svg>',
    dice: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="4"/><circle cx="9" cy="9" r="1"/><circle cx="15" cy="15" r="1"/><circle cx="15" cy="9" r="1"/><circle cx="9" cy="15" r="1"/></svg>',
    spark: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l2.2 5.8L20 11l-5.8 2.2L12 19l-2.2-5.8L4 11l5.8-2.2z"/></svg>',
    sun: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
    moon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z"/></svg>'
  };
  var toastEl = $('#toast'), toastTimer = 0;
  function flash(msg) {
    toastEl.textContent = msg; toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.hidden = true; }, 3600);
  }

  /* ---------- HTTP ---------- */
  async function req(method, url, body, signal, keepalive) {
    var opts = { method: method, signal: signal, keepalive: !!keepalive };
    if (body !== undefined) { opts.headers = { 'Content-Type': 'application/json' }; opts.body = JSON.stringify(body); }
    var res;
    try { res = await fetch(url, opts); }
    catch (e) { if (e && e.name === 'AbortError') throw e; throw new Error('Không kết nối được tới server. Hãy kiểm tra server còn chạy không.'); }
    if (res.status === 204) return null;
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok) { var err = new Error(data.error || ('Lỗi ' + res.status)); err.status = res.status; throw err; }
    return data;
  }
  var CHAT_API = '/api/writing-fix';
  var WRITE_API = '/api/writing-task2';

  /* ---------- Theme ---------- */
  var htmlEl = document.documentElement, themeBtn = $('#theme');
  var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: light)') : null;
  function effTheme() {
    var t = htmlEl.getAttribute('data-theme');
    if (t === 'light' || t === 'dark') return t;
    return mq && mq.matches ? 'light' : 'dark';
  }
  function paintTheme() {
    var t = effTheme();
    themeBtn.innerHTML = t === 'dark' ? ICON.sun : ICON.moon;
    var label = t === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối';
    themeBtn.setAttribute('aria-label', label); themeBtn.title = label;
  }
  var savedTheme = pref.get('de-theme');
  if (savedTheme === 'light' || savedTheme === 'dark') htmlEl.setAttribute('data-theme', savedTheme);
  themeBtn.addEventListener('click', function () {
    var next = effTheme() === 'dark' ? 'light' : 'dark';
    htmlEl.setAttribute('data-theme', next); pref.set('de-theme', next); paintTheme();
  });
  if (mq && mq.addEventListener) mq.addEventListener('change', paintTheme);
  paintTheme();

  /* ---------- Tabs ---------- */
  var tabsEl = $('.tabs');
  var views = { chatbot: $('#view-chat'), writing: $('#view-writing') };
  function showTab(name, remember) {
    if (!views[name]) name = 'chatbot';
    closeDrawer();
    if (name !== 'writing') flushSave();
    tabsEl.dataset.active = name;
    document.querySelectorAll('.tab').forEach(function (b) { b.setAttribute('aria-selected', String(b.dataset.tab === name)); });
    Object.keys(views).forEach(function (k) { views[k].hidden = k !== name; });
    if (remember) { try { history.replaceState(null, '', '#' + name); } catch (e) {} }
    window.scrollTo(0, 0);
  }
  document.querySelectorAll('.tab').forEach(function (b) {
    b.addEventListener('click', function () { showTab(b.dataset.tab, true); });
  });

  /* ---------- Rich text for tutor replies ---------- */
  function inline(raw) {
    var s = esc(raw);
    s = s.replace(/~~(.+?)~~/g, '<del>$1</del>');
    s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    return s;
  }
  function plain(s) {
    return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
  }
  function secOf(label) {
    var k = plain(label);
    if (/de xuat|corrected|phien ban/.test(k)) return 'corrected';
    if (/giai thich|mistake|loi/.test(k)) return 'mistakes';
    if (/khac|tip|goi y/.test(k)) return 'tip';
    return '';
  }
  function renderRich(text) {
    var html = '', sec = '', inList = false;
    function close() { if (inList) { html += '</ul>'; inList = false; } }
    String(text).split('\n').forEach(function (line) {
      var t = line.trim();
      if (!t) { close(); return; }
      var only = t.match(/^\*\*(.+?)\*\*\s*:?\s*$/) || t.match(/^#{1,4}\s+(.+?)\s*:?\s*$/);
      var withRest = t.match(/^\*\*(.+?):\*\*\s*(.+)$/);
      if (only || withRest) {
        close();
        var label = (only ? only[1] : withRest[1]).replace(/:$/, '');
        sec = secOf(label);
        html += '<div class="label' + (sec ? ' label-' + sec : '') + '">' + esc(label) + '</div>';
        if (withRest) { html += '<p class="p">' + inline(withRest[2]) + '</p>'; sec = ''; }
        return;
      }
      var li = t.match(/^(?:[-*•]|\d+[.)])\s+(.*)$/);
      if (li) { if (!inList) { html += '<ul class="list">'; inList = true; } html += '<li>' + inline(li[1]) + '</li>'; return; }
      close();
      html += '<p class="p' + (sec === 'corrected' ? ' sec-corrected' : '') + '">' + inline(t) + '</p>';
    });
    close();
    return html;
  }

  /* ---------- Conversations (sidebar) ---------- */
  var S = { convs: [], cache: {}, ready: false, failed: false, q: '', renaming: null, renameVal: '', armed: null, timer: 0 };
  var chat = { cur: { id: null, turns: [], title: '' }, busy: false, loading: false, ctl: null, lang: pref.get('de-lang') === 'en' ? 'en' : 'vi' };
  var input = $('#chat-input'), sendBtn = $('#send'), stopBtn = $('#stop'), msgs = $('#messages');
  var intro = $('#intro'), sideEl = $('#side'), backdrop = $('#backdrop'), menuBtn = $('#menu');
  var convListEl = $('#conv-list');

  function openDrawer() { sideEl.classList.add('open'); backdrop.hidden = false; menuBtn.setAttribute('aria-expanded', 'true'); }
  function closeDrawer() { sideEl.classList.remove('open'); backdrop.hidden = true; menuBtn.setAttribute('aria-expanded', 'false'); }
  menuBtn.addEventListener('click', openDrawer);
  backdrop.addEventListener('click', closeDrawer);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeDrawer(); });

  function titleFrom(turns) {
    var u = turns.find(function (t) { return t.role === 'user'; });
    if (!u) return 'Cuộc trò chuyện mới';
    var lines = u.content.split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
    var pick = lines.find(function (l) { return !/:$/.test(l); }) || lines[0] || 'Cuộc trò chuyện mới';
    return pick.length > 48 ? pick.slice(0, 47).trim() + '…' : pick;
  }
  function group(ms) {
    var d = new Date(); d.setHours(0, 0, 0, 0);
    var t = d.getTime(), day = 86400000;
    if (ms >= t) return 'Hôm nay';
    if (ms >= t - day) return 'Hôm qua';
    if (ms >= t - 7 * day) return '7 ngày qua';
    if (ms >= t - 30 * day) return '30 ngày qua';
    return 'Cũ hơn';
  }
  function toConv(s) {
    return { id: s.id, title: s.title, createdAt: Date.parse(s.createdAt) || 0, updatedAt: Date.parse(s.updatedAt) || 0, n: s.messageCount };
  }
  async function loadConvs() {
    try {
      var list = await req('GET', CHAT_API + '/sessions');
      S.convs = list.map(toConv); S.failed = false;
    } catch (e) { S.failed = true; }
    S.ready = true; renderConvs();
  }
  function renderConvs() {
    var q = S.q.trim().toLowerCase();
    var html = S.failed ? '<div class="conv-note">Chưa tải được danh sách cuộc trò chuyện. Server có đang chạy không?</div>' : '';
    if (!S.ready) { convListEl.innerHTML = '<p class="conv-empty">Đang tải…</p>'; return; }
    var list = S.convs.filter(function (c) { return (c.n > 0 || c.id === chat.cur.id) && (!q || (c.title || '').toLowerCase().indexOf(q) >= 0); })
      .sort(function (a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); });
    if (!list.length) {
      convListEl.innerHTML = html + '<p class="conv-empty">' + (q ? 'Không có cuộc trò chuyện nào khớp.' : 'Chưa có cuộc trò chuyện nào. Gửi tin nhắn đầu tiên để bắt đầu.') + '</p>';
      return;
    }
    var last = '';
    list.forEach(function (c) {
      var g = group(c.updatedAt || 0);
      if (g !== last) { html += '<div class="conv-group">' + g + '</div>'; last = g; }
      var active = chat.cur.id === c.id, id = esc(c.id);
      if (S.renaming === c.id) {
        html += '<div class="conv active"><input class="conv-rename" id="conv-rename" maxlength="80" aria-label="Tên mới" value="' + esc(S.renameVal) + '"></div>';
      } else {
        var armed = S.armed === c.id;
        html += '<div class="conv' + (active ? ' active' : '') + (armed ? ' armed' : '') + '">' +
          '<button type="button" class="conv-main" data-act="open-chat" data-id="' + id + '"' + (active ? ' aria-current="true"' : '') + ' title="' + esc(c.title || '') + '">' + esc(c.title || 'Không có tiêu đề') + '</button>' +
          '<div class="conv-tools">' + (armed
            ? '<button type="button" class="tool danger" data-act="del-chat" data-id="' + id + '">Xóa?</button>'
            : '<button type="button" class="tool" data-act="rename" data-id="' + id + '" aria-label="Đổi tên">' + ICON.pencil + '</button>' +
              '<button type="button" class="tool" data-act="del-chat" data-id="' + id + '" aria-label="Xóa cuộc trò chuyện">' + ICON.bin + '</button>') +
          '</div></div>';
      }
    });
    convListEl.innerHTML = html;
    var r = $('#conv-rename'); if (r) { r.focus(); r.select(); }
  }
  function upsertConv(id, meta) {
    var i = S.convs.findIndex(function (c) { return c.id === id; });
    var rec = { id: id, title: meta.title, createdAt: meta.createdAt, updatedAt: meta.updatedAt, n: meta.n };
    if (i >= 0) S.convs[i] = rec; else S.convs.push(rec);
  }
  function updateBar() { $('#bar-title').textContent = chat.cur.title || 'Cuộc trò chuyện mới'; }
  function syncIntro() { intro.hidden = chat.cur.turns.length > 0 || chat.loading; }
  function renderMessages(turns) {
    msgs.innerHTML = '';
    turns.forEach(function (t) {
      if (t.role === 'user') addUser(t.content);
      else { var a = addAssistant(); a.body.innerHTML = renderRich(t.content); }
    });
  }
  var openToken = 0;
  function newChat() {
    if (chat.ctl) chat.ctl.abort();
    openToken++; chat.loading = false; setBusy(false);
    chat.cur = { id: null, turns: [], title: '' };
    msgs.innerHTML = ''; syncIntro(); updateBar(); renderConvs(); closeDrawer(); refreshSend();
  }
  async function openChat(id) {
    closeDrawer();
    if (chat.cur.id === id) return;
    var c = S.convs.find(function (x) { return x.id === id; });
    if (!c) return;
    if (chat.ctl) chat.ctl.abort();
    setBusy(false);
    var tok = ++openToken;
    var turns = S.cache[id];
    if (!turns) {
      chat.loading = true; chat.cur = { id: id, turns: [], title: c.title };
      msgs.innerHTML = '<p class="note">Đang mở cuộc trò chuyện…</p>'; syncIntro(); renderConvs(); updateBar(); refreshSend();
      try {
        var session = await req('GET', CHAT_API + '/sessions/' + encodeURIComponent(id));
        turns = session.messages || [];
      } catch (e) {
        if (tok === openToken) { chat.loading = false; flash('Chưa mở được cuộc trò chuyện này.'); newChat(); }
        return;
      }
      if (tok !== openToken) return;
      S.cache[id] = turns; chat.loading = false;
    }
    chat.cur = { id: id, turns: turns.map(function (t) { return { role: t.role, content: t.content }; }), title: c.title };
    renderMessages(chat.cur.turns); syncIntro(); renderConvs(); updateBar(); refreshSend();
    window.scrollTo({ top: document.documentElement.scrollHeight });
  }
  async function delChat(id) {
    try {
      await req('DELETE', CHAT_API + '/sessions/' + encodeURIComponent(id));
    } catch (e) {
      if (e.status !== 404) { flash('Chưa xóa được. Hãy thử lại sau vài giây.'); return; }
    }
    S.convs = S.convs.filter(function (c) { return c.id !== id; });
    delete S.cache[id];
    if (chat.cur.id === id) newChat(); else renderConvs();
    flash('Đã xóa cuộc trò chuyện.');
  }
  function commitRename() {
    if (!S.renaming) return;
    var id = S.renaming, v = S.renameVal.trim();
    S.renaming = null;
    var c = S.convs.find(function (x) { return x.id === id; });
    if (v && c && v !== c.title) {
      c.title = v;
      if (chat.cur.id === id) { chat.cur.title = v; updateBar(); }
      req('PATCH', CHAT_API + '/sessions/' + encodeURIComponent(id), { title: v }).catch(function () { flash('Chưa đổi được tên. Hãy thử lại.'); });
    }
    renderConvs();
  }
  convListEl.addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]'); if (!b) return;
    var act = b.dataset.act, id = b.dataset.id;
    if (act === 'open-chat') openChat(id);
    else if (act === 'rename') {
      var c = S.convs.find(function (x) { return x.id === id; });
      S.renaming = id; S.renameVal = c ? c.title || '' : ''; renderConvs();
    } else if (act === 'del-chat') {
      if (S.armed !== id) {
        S.armed = id; renderConvs(); clearTimeout(S.timer);
        S.timer = setTimeout(function () { S.armed = null; renderConvs(); }, 3500);
      } else { clearTimeout(S.timer); S.armed = null; delChat(id); }
    }
  });
  convListEl.addEventListener('input', function (e) { if (e.target.id === 'conv-rename') S.renameVal = e.target.value; });
  convListEl.addEventListener('keydown', function (e) {
    if (e.target.id !== 'conv-rename') return;
    if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); commitRename(); }
    else if (e.key === 'Escape') { e.stopPropagation(); S.renaming = null; renderConvs(); }
  });
  convListEl.addEventListener('focusout', function (e) { if (e.target.id === 'conv-rename') commitRename(); });
  $('#conv-search').addEventListener('input', function (e) { S.q = e.target.value; renderConvs(); });
  $('#new-chat').addEventListener('click', function () { newChat(); input.focus(); });
  $('#new-chat-bar').addEventListener('click', function () { newChat(); input.focus(); });

  /* ---------- Chat ---------- */
  var EXAMPLE = [
    '**Ngôn ngữ phát hiện:** Tiếng Anh',
    '',
    '**Bản diễn đạt đề xuất (tiếng Anh):**',
    'Yesterday I went to school and met my friend. We talked about our weekend plans.',
    '',
    '**Giải thích:**',
    '- "go" → **went**: "Yesterday" chỉ quá khứ nên dùng quá khứ đơn.',
    '- "meet" → **met**: cùng lý do; meet là động từ bất quy tắc.',
    '- "We talks" → **We talked**: chủ ngữ "We" không đi với "talks", và câu đang kể chuyện đã qua.',
    '',
    '**Cách diễn đạt khác (nếu có):**',
    '- Thân mật: Yesterday I ran into a friend at school, and we chatted about the weekend.'
  ].join('\n');
  $('#example').innerHTML = '<span class="badge">Ví dụ</span>' +
    '<div class="msg msg-u">Yesterday I go to school and meet my friend. We talks about the weekend plan.</div>' +
    '<div class="msg msg-a glass">' + renderRich(EXAMPLE) + '</div>';

  function autosize() { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 180) + 'px'; }
  function refreshSend() { sendBtn.disabled = chat.busy || chat.loading || !input.value.trim(); }
  function setBusy(b) { chat.busy = b; sendBtn.hidden = b; stopBtn.hidden = !b; refreshSend(); }
  function nearBottom() { return window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 240; }
  function toBottom() { window.scrollTo({ top: document.documentElement.scrollHeight }); }

  function addUser(text) {
    var d = document.createElement('div'); d.className = 'msg msg-u'; d.textContent = text; msgs.append(d); return d;
  }
  function addAssistant() {
    var el = document.createElement('div'); el.className = 'msg msg-a glass';
    var body = document.createElement('div'); el.append(body); msgs.append(el);
    return { el: el, body: body };
  }

  async function ask(conv, text) {
    var live = function () { return chat.cur === conv; };
    setBusy(true);
    var a = addAssistant();
    a.body.innerHTML = '<span class="dots" aria-label="Đang trả lời"><i></i><i></i><i></i></span>';
    if (nearBottom()) toBottom();
    var ctl = new AbortController(); chat.ctl = ctl;
    var createdNow = false;
    try {
      if (!conv.id) {
        var s = await req('POST', CHAT_API + '/sessions', undefined, ctl.signal);
        conv.id = s.id; createdNow = true;
      }
      var res = await req('POST', CHAT_API + '/sessions/' + encodeURIComponent(conv.id) + '/messages', { content: text, lang: chat.lang }, ctl.signal);
      var reply = res.assistantMessage.content;
      conv.turns.push({ role: 'assistant', content: reply });
      var now = Date.now();
      var ex = S.convs.find(function (c) { return c.id === conv.id; });
      var title = res.title || conv.title;
      if (conv.turns.length === 2) {
        var want = titleFrom(conv.turns);
        if (want && want !== title) {
          title = want;
          req('PATCH', CHAT_API + '/sessions/' + encodeURIComponent(conv.id), { title: want }).catch(function () {});
        }
      }
      conv.title = title;
      S.cache[conv.id] = conv.turns.map(function (t) { return { role: t.role, content: t.content }; });
      upsertConv(conv.id, { title: title, createdAt: (ex && ex.createdAt) || now, updatedAt: now, n: conv.turns.length });
      if (live()) { a.body.innerHTML = renderRich(reply); updateBar(); }
      renderConvs();
    } catch (e) {
      if (createdNow && conv.id) { req('DELETE', CHAT_API + '/sessions/' + encodeURIComponent(conv.id)).catch(function () {}); conv.id = null; }
      if (e && e.name === 'AbortError') {
        a.el.remove();
        conv.turns.pop();
        if (live()) {
          var users = msgs.querySelectorAll('.msg-u'); if (users.length) users[users.length - 1].remove();
          input.value = text; autosize(); syncIntro();
        }
      } else {
        a.body.innerHTML = '';
        var box = document.createElement('div'); box.className = 'err';
        var span = document.createElement('span');
        span.textContent = (e && e.message) || 'Không gọi được chatbot lúc này. Bấm Thử lại để gửi lần nữa.';
        box.append(span);
        var rb = document.createElement('button'); rb.type = 'button'; rb.className = 'btn btn-sm'; rb.textContent = 'Thử lại';
        rb.addEventListener('click', function () { if (chat.busy) return; a.el.remove(); ask(conv, text); });
        box.append(rb);
        a.el.append(box);
      }
    } finally {
      if (chat.ctl === ctl) { chat.ctl = null; setBusy(false); }
      if (live()) { syncIntro(); if (nearBottom()) toBottom(); }
    }
  }

  function send() {
    var text = input.value.trim();
    if (!text || chat.busy || chat.loading) return;
    var conv = chat.cur;
    conv.turns.push({ role: 'user', content: text });
    addUser(text);
    input.value = ''; autosize(); refreshSend(); syncIntro();
    toBottom();
    ask(conv, text);
  }
  function startChatWith(text) {
    newChat();
    input.value = text; autosize(); refreshSend();
    showTab('chatbot', true); input.focus();
  }
  input.addEventListener('input', function () { autosize(); refreshSend(); });
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.keyCode !== 229) { e.preventDefault(); send(); }
  });
  sendBtn.addEventListener('click', send);
  stopBtn.addEventListener('click', function () { if (chat.ctl) chat.ctl.abort(); });
  document.querySelectorAll('.chip').forEach(function (c) {
    c.addEventListener('click', function () {
      input.value = c.dataset.fill; autosize(); refreshSend(); input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    });
  });
  document.querySelectorAll('.seg button').forEach(function (b) {
    b.setAttribute('aria-pressed', String(b.dataset.lang === chat.lang));
    b.addEventListener('click', function () {
      chat.lang = b.dataset.lang; pref.set('de-lang', chat.lang);
      document.querySelectorAll('.seg button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
    });
  });
  refreshSend(); syncIntro(); renderConvs();

  /* ---------- Writing Task 2 ---------- */
  var PAGE = 25;
  var TYPE_ORDER = ['Agree / Disagree', 'Discuss both views', 'Advantages / Disadvantages', 'Causes / Solutions', 'Extent', 'Opinion'];
  var STATUS = { todo: 'Chưa viết', draft: 'Đang viết', graded: 'Đã chấm' };
  var STATUS_RANK = { todo: 0, draft: 1, graded: 2 };
  var CRITERIA = [
    ['taskResponse', 'Task Response'],
    ['coherenceCohesion', 'Coherence & Cohesion'],
    ['lexicalResource', 'Lexical Resource'],
    ['grammar', 'Grammatical Range & Accuracy']
  ];
  var SORTS = [
    ['id:asc', 'Số đề tăng dần'], ['id:desc', 'Số đề giảm dần'], ['topic:asc', 'Topic A đến Z'], ['qtype:asc', 'Question type A đến Z'],
    ['status:desc', 'Đã chấm trước'], ['status:asc', 'Chưa viết trước'], ['band:desc', 'Band cao nhất'], ['band:asc', 'Band thấp nhất']
  ];
  var W = {
    items: [], byId: {}, ready: false, error: '', view: 'list', id: null,
    q: '', ftopic: '', ftype: '', fstatus: '', sort: { key: 'id', dir: 'asc' }, page: 1,
    statsOpen: pref.get('de-stats') !== '0', d: null
  };
  var root = $('#writing-root');
  function wc(t) { t = (t || '').trim(); return t ? t.split(/\s+/).length : 0; }
  function fmtShort(iso) { return new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
  function fmtFull(iso) { return new Date(iso).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  function fmtClock(iso) { return new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }); }
  function band(v) { return v == null ? '' : Number(v).toFixed(1); }
  function chip(v, cls) { return v ? '<span class="ptag' + (cls ? ' ' + cls : '') + '" title="' + esc(v) + '">' + esc(v) + '</span>' : ''; }
  function statusTag(it) { return '<span class="st st-' + it.status + '">' + STATUS[it.status] + '</span>'; }
  function mergeSummary(id, s) {
    var it = W.byId[id]; if (!it || !s) return;
    it.status = s.status; it.words = s.words; it.updatedAt = s.updatedAt; it.gradingCount = s.gradingCount; it.band = s.band; it.gradedAt = s.gradedAt;
  }

  async function loadQuestions() {
    try {
      W.items = await req('GET', WRITE_API + '/questions');
      W.byId = {}; W.items.forEach(function (it) { W.byId[it.id] = it; });
      W.error = '';
    } catch (e) { W.error = e.message; }
    W.ready = true;
    if (W.view === 'list') drawList();
  }

  function uniqSorted(field) {
    var seen = {}, out = [];
    W.items.forEach(function (it) { var v = it[field]; if (v && !seen[v]) { seen[v] = 1; out.push(v); } });
    return out.sort(function (a, b) { return a.localeCompare(b, 'en', { sensitivity: 'base' }); });
  }
  function typeList() {
    var all = uniqSorted('qtype');
    var ordered = TYPE_ORDER.filter(function (t) { return all.indexOf(t) >= 0; });
    return ordered.concat(all.filter(function (t) { return ordered.indexOf(t) < 0; }));
  }

  function filtered() {
    var q = W.q.trim().toLowerCase().replace(/^#/, '');
    var list = W.items.filter(function (it) {
      if (W.ftopic && it.topic !== W.ftopic) return false;
      if (W.ftype && it.qtype !== W.ftype) return false;
      if (W.fstatus && it.status !== W.fstatus) return false;
      if (q && it.text.toLowerCase().indexOf(q) < 0 && String(it.id) !== q) return false;
      return true;
    });
    var k = W.sort.key, sign = W.sort.dir === 'asc' ? 1 : -1;
    return list.sort(function (a, b) {
      var r;
      if (k === 'id') r = a.id - b.id;
      else if (k === 'status') r = STATUS_RANK[a.status] - STATUS_RANK[b.status];
      else if (k === 'band') {
        if (a.band == null && b.band == null) r = 0;
        else if (a.band == null) return 1;
        else if (b.band == null) return -1;
        else r = a.band - b.band;
      } else r = String(a[k] || '').localeCompare(String(b[k] || ''), 'en', { sensitivity: 'base' });
      return r * sign || a.id - b.id;
    });
  }

  /* --- statistics (progress tracking) --- */
  function calcStats() {
    var s = { total: W.items.length, written: 0, graded: 0, bandSum: 0, bandN: 0, byTopic: {}, byType: {} };
    function add(map, key, it) {
      var m = map[key] || (map[key] = { name: key, total: 0, written: 0, graded: 0, bandSum: 0, bandN: 0 });
      m.total++;
      if (it.status !== 'todo') m.written++;
      if (it.status === 'graded') { m.graded++; if (it.band != null) { m.bandSum += it.band; m.bandN++; } }
    }
    W.items.forEach(function (it) {
      if (it.status !== 'todo') s.written++;
      if (it.status === 'graded') { s.graded++; if (it.band != null) { s.bandSum += it.band; s.bandN++; } }
      add(s.byTopic, it.topic, it); add(s.byType, it.qtype, it);
    });
    return s;
  }
  function avg(m) { return m.bandN ? (m.bandSum / m.bandN).toFixed(1) : '–'; }
  function bar(m) {
    var g = m.total ? (m.graded / m.total) * 100 : 0, d = m.total ? ((m.written - m.graded) / m.total) * 100 : 0;
    return '<span class="progress"><i class="p-graded" style="width:' + g + '%"></i><i class="p-draft" style="width:' + d + '%"></i></span>';
  }
  function statRows(map, kind, active, order) {
    var rows = Object.keys(map).map(function (k) { return map[k]; });
    if (order) rows.sort(function (a, b) { return order.indexOf(a.name) - order.indexOf(b.name); });
    else rows.sort(function (a, b) { return b.total - a.total || a.name.localeCompare(b.name); });
    return rows.map(function (m) {
      return '<button type="button" class="srow' + (active === m.name ? ' on' : '') + '" data-act="fstat" data-kind="' + kind + '" data-val="' + esc(m.name) + '" title="Lọc theo ' + esc(m.name) + '">' +
        '<span class="nm">' + esc(m.name) + '</span>' + bar(m) +
        '<span class="sval"><b>' + m.written + '</b>/' + m.total + '<em>' + (m.graded ? ' · ' + avg(m) : '') + '</em></span></button>';
    }).join('');
  }
  function statsHtml() {
    var s = calcStats();
    var pct = s.total ? Math.round((s.written / s.total) * 100) : 0;
    var recent = W.items.filter(function (it) { return it.gradedAt; })
      .sort(function (a, b) { return Date.parse(b.gradedAt) - Date.parse(a.gradedAt); }).slice(0, 5);
    var h = '<div class="stats-head"><h2>Tiến độ &amp; thống kê</h2>' +
      '<button type="button" class="btn btn-ghost btn-sm" data-act="togglestats" aria-expanded="' + W.statsOpen + '">' + (W.statsOpen ? 'Thu gọn' : 'Mở rộng') + '</button></div>';
    h += '<div class="kpis">' +
      '<div class="kpi glass"><b>' + s.written + '<small>/' + s.total + '</small></b><span>Đã viết (' + pct + '%)</span></div>' +
      '<div class="kpi glass"><b>' + s.graded + '</b><span>Đã chấm bằng AI</span></div>' +
      '<div class="kpi glass"><b>' + (s.bandN ? (s.bandSum / s.bandN).toFixed(1) : '–') + '</b><span>Band trung bình</span></div>' +
      '<div class="kpi glass kpi-bar"><span>Tổng tiến độ</span>' + bar({ total: s.total, written: s.written, graded: s.graded }) +
      '<span class="legend"><i class="p-graded"></i>Đã chấm <i class="p-draft"></i>Đang viết</span></div></div>';
    if (W.statsOpen) {
      h += '<div class="stat-cols">' +
        '<div class="stat-card glass"><h3>Theo topic</h3><p class="hint">Đã viết / tổng · band trung bình. Bấm để lọc.</p>' + statRows(s.byTopic, 'topic', W.ftopic) + '</div>' +
        '<div class="stat-card glass"><h3>Theo question type</h3><p class="hint">Đã viết / tổng · band trung bình. Bấm để lọc.</p>' + statRows(s.byType, 'type', W.ftype, TYPE_ORDER) +
        (recent.length ? '<h3 class="recent-h">Chấm gần đây</h3>' + recent.map(function (it) {
          return '<button type="button" class="recent" data-act="open" data-id="' + it.id + '"><b>' + band(it.band) + '</b><span class="rt">#' + it.id + ' · ' + esc(it.topic) + '</span><span class="rd">' + fmtShort(it.gradedAt) + '</span></button>';
        }).join('') : '') + '</div></div>';
    }
    return h;
  }
  function updateStats() { var el = $('#w-stats'); if (el) el.innerHTML = statsHtml(); }

  /* --- list --- */
  function optionsHtml(values, current, allLabel, counts) {
    var h = '<option value="">' + allLabel + '</option>';
    values.forEach(function (v) { h += '<option value="' + esc(v) + '"' + (v === current ? ' selected' : '') + '>' + esc(v) + (counts ? ' (' + counts[v] + ')' : '') + '</option>'; });
    return h;
  }
  function fillSelects() {
    var s = calcStats(), cnt = function (map) { var o = {}; Object.keys(map).forEach(function (k) { o[k] = map[k].total; }); return o; };
    $('#w-ft').innerHTML = optionsHtml(uniqSorted('topic'), W.ftopic, 'Tất cả topic', cnt(s.byTopic));
    $('#w-fq').innerHTML = optionsHtml(typeList(), W.ftype, 'Tất cả question type', cnt(s.byType));
    $('#w-fs').innerHTML = '<option value="">Tất cả trạng thái</option>' + Object.keys(STATUS).map(function (k) {
      return '<option value="' + k + '"' + (W.fstatus === k ? ' selected' : '') + '>' + STATUS[k] + '</option>';
    }).join('');
  }
  function th(key, label, cls) {
    var on = W.sort.key === key;
    return '<th class="' + (cls || '') + '" aria-sort="' + (on ? (W.sort.dir === 'asc' ? 'ascending' : 'descending') : 'none') + '">' +
      '<button type="button" data-act="sort" data-key="' + key + '">' + label + ICON.sort + '</button></th>';
  }
  function updateResults() {
    var all = W.items.length, list = filtered();
    var pages = Math.max(1, Math.ceil(list.length / PAGE));
    if (W.page > pages) W.page = pages;
    var start = (W.page - 1) * PAGE, rows = list.slice(start, start + PAGE);
    $('#w-sub').textContent = list.length === all ? all + ' đề bài' : list.length + ' trong ' + all + ' đề';
    $('#w-clear').hidden = !(W.q || W.ftopic || W.ftype || W.fstatus);
    $('#w-sort').value = W.sort.key + ':' + W.sort.dir;
    var h;
    if (!rows.length) {
      h = '<div class="empty glass"><h2>Không có đề nào khớp</h2><p>Thử đổi từ khóa hoặc bỏ bớt bộ lọc.</p><button type="button" class="btn" data-act="clear">Xóa bộ lọc</button></div>';
    } else {
      h = '<div class="tbl-wrap glass"><div class="tbl-scroll"><table class="tbl">' +
        '<colgroup><col style="width:7%"><col style="width:41%"><col style="width:14%"><col style="width:17%"><col style="width:12%"><col style="width:9%"></colgroup>' +
        '<thead><tr>' + th('id', '#', 'c-id') + '<th><span class="th-plain">Đề bài</span></th>' + th('topic', 'Topic') + th('qtype', 'Question type') + th('status', 'Trạng thái') + th('band', 'Band', 'num') + '</tr></thead><tbody>' +
        rows.map(function (it) {
          return '<tr data-act="open" data-id="' + it.id + '">' +
            '<td class="c-id">' + it.id + '</td>' +
            '<td class="c-title"><span class="qtext">' + esc(it.text) + '</span></td>' +
            '<td class="c-topic">' + chip(it.topic) + '</td>' +
            '<td class="c-type">' + chip(it.qtype, 'ptag-type') + '</td>' +
            '<td class="c-status">' + statusTag(it) + (it.words ? '<span class="snip">' + it.words + ' words</span>' : '') + '</td>' +
            '<td class="num c-band">' + (it.band != null ? '<span class="band">' + band(it.band) + '</span>' : '<span class="dash">–</span>') + '</td></tr>';
        }).join('') + '</tbody></table></div>' +
        '<div class="pager"><span>' + (start + 1) + ' đến ' + (start + rows.length) + ' trong ' + list.length + '</span>' +
        '<div class="pager-btns"><button type="button" class="btn btn-sm" data-act="page" data-d="-1"' + (W.page <= 1 ? ' disabled' : '') + '>' + ICON.back + 'Trước</button>' +
        '<span>Trang ' + W.page + ' / ' + pages + '</span>' +
        '<button type="button" class="btn btn-sm" data-act="page" data-d="1"' + (W.page >= pages ? ' disabled' : '') + '>Sau' + ICON.next + '</button></div></div></div>';
    }
    $('#w-results').innerHTML = h;
  }
  function drawList() {
    var h = '<div class="w-head"><div><h1 class="w-title">Writing Task 2</h1><p class="sub" id="w-sub">' + (W.ready ? '' : 'Đang tải đề bài…') + '</p></div>' +
      '<button type="button" class="btn btn-primary" data-act="random"' + (W.items.length ? '' : ' disabled') + '>' + ICON.dice + 'Đề ngẫu nhiên</button></div>';
    if (!W.ready) h += '<div><div class="skel"></div><div class="skel"></div><div class="skel"></div></div>';
    else if (W.error) {
      h += '<div class="empty glass"><h2>Chưa tải được đề bài</h2><p>' + esc(W.error) + '</p><button type="button" class="btn btn-primary" data-act="reload">Thử lại</button></div>';
    } else {
      h += '<section class="stats" id="w-stats"></section>' +
        '<div class="toolbar">' +
        '<label class="search"><span class="sr">Tìm đề bài</span>' + ICON.search + '<input id="w-q" type="search" placeholder="Tìm theo nội dung hoặc số đề" autocomplete="off" value="' + esc(W.q) + '"></label>' +
        '<select class="field sel" id="w-ft" aria-label="Lọc theo topic"></select>' +
        '<select class="field sel" id="w-fq" aria-label="Lọc theo question type"></select>' +
        '<select class="field sel" id="w-fs" aria-label="Lọc theo trạng thái"></select>' +
        '<select class="field sel sort-sel" id="w-sort" aria-label="Sắp xếp">' + SORTS.map(function (s) { return '<option value="' + s[0] + '">' + s[1] + '</option>'; }).join('') + '</select>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-act="clear" id="w-clear" hidden>Xóa bộ lọc</button></div>' +
        '<div id="w-results"></div>';
    }
    root.innerHTML = h;
    if ($('#w-results')) { updateStats(); fillSelects(); updateResults(); }
  }

  /* --- detail: write + grade --- */
  function neighbours(id) {
    var list = filtered(), i = list.findIndex(function (x) { return x.id === id; });
    if (i < 0) list = W.items.slice().sort(function (a, b) { return a.id - b.id; }), i = list.findIndex(function (x) { return x.id === id; });
    return { prev: i > 0 ? list[i - 1] : null, next: i >= 0 && i < list.length - 1 ? list[i + 1] : null };
  }
  function countClass(n) { return n >= 250 ? 'count good' : 'count'; }
  function countText(n) { return n + ' words' + (n >= 250 ? '' : ' · nên viết từ 250 words'); }

  function detailHtml(d) {
    var q = d.q, nb = neighbours(q.id);
    return '<div class="w-narrow"><div class="q-nav">' +
      '<button type="button" class="btn btn-ghost btn-sm" data-act="list">' + ICON.back + 'Danh sách</button>' +
      '<div class="q-step">' +
      '<button type="button" class="btn btn-ghost btn-sm" data-act="open" data-id="' + (nb.prev ? nb.prev.id : '') + '"' + (nb.prev ? '' : ' disabled') + '>' + ICON.back + 'Đề trước</button>' +
      '<button type="button" class="btn btn-ghost btn-sm" data-act="open" data-id="' + (nb.next ? nb.next.id : '') + '"' + (nb.next ? '' : ' disabled') + '>Đề sau' + ICON.next + '</button></div></div>' +
      '<article class="doc"><div class="chiprow"><span class="ptag">#' + q.id + '</span>' + chip(q.topic) + chip(q.qtype, 'ptag-type') + '</div>' +
      '<h2 class="q-h">' + esc(q.text) + '</h2></article>' +
      '<div class="form">' +
      '<textarea class="field" id="w-body" placeholder="Viết bài của bạn bằng tiếng Anh ở đây…" aria-label="Bài viết" autocomplete="off" autocorrect="off" spellcheck="false"' + (d.grading ? ' readonly' : '') + '>' + esc(d.body) + '</textarea>' +
      '<div class="form-foot"><span class="' + countClass(wc(d.body)) + '" id="w-count">' + countText(wc(d.body)) + '</span><span class="saved" id="w-saved">' + esc(d.saveText || '') + '</span></div></div>' +
      '<div class="doc-actions">' +
      '<button type="button" class="btn btn-primary" id="w-grade" data-act="grade">' + ICON.spark + '<span id="w-grade-l"></span></button>' +
      (d.essayExists ? '<button type="button" class="btn btn-danger' + (d.armed ? ' armed' : '') + '" data-act="wdelete">' + ICON.trash + (d.armed ? 'Bấm lần nữa để xóa' : 'Xóa bài và kết quả') + '</button>' : '') +
      '<button type="button" class="btn" data-act="tochat"' + (wc(d.body) ? '' : ' disabled') + '>Hỏi chatbot về bài này</button></div>' +
      '<section class="result" id="w-result"></section></div>';
  }
  function paintGrade() {
    var d = W.d; if (!d) return;
    var btn = $('#w-grade'), lab = $('#w-grade-l'); if (!btn) return;
    var n = wc(d.body);
    btn.disabled = d.grading || n < 20;
    lab.textContent = d.grading ? 'Đang chấm…' : (d.gradings.length ? 'Chấm lại bằng AI' : 'Dùng AI chấm bài');
    btn.title = n < 20 ? 'Cần viết ít nhất 20 từ để chấm' : '';
    var ta = $('#w-body'); if (ta) ta.readOnly = d.grading;
  }
  function critHtml(r) {
    return '<div class="crit-grid">' + CRITERIA.map(function (c) {
      return '<div class="crit glass"><div class="crit-h"><span>' + c[1] + '</span><b class="crit-b">' + band(r.bands[c[0]]) + '</b></div><p class="p">' + esc(r.feedback[c[0]] || '') + '</p></div>';
    }).join('') + '</div>';
  }
  function listHtml(items, cls) {
    return items.length ? '<ul class="list ' + cls + '">' + items.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>' : '';
  }
  function resultHtml(d) {
    var h = '';
    if (d.grading) h += '<div class="glass grading-note"><span class="dots"><i></i><i></i><i></i></span><span>Đang chấm bài… thường mất 15 đến 40 giây. Bài của bạn đã được lưu.</span></div>';
    if (d.gradeError) h += '<div class="err"><span>' + esc(d.gradeError) + '</span><button type="button" class="btn btn-sm" data-act="grade">Thử lại</button></div>';
    if (!d.gradings.length) return h;
    var g = d.gradings[d.sel], r = g.result;
    h += '<div class="res-head"><h3>Kết quả chấm</h3><div class="attempts" role="group" aria-label="Các lần chấm">' +
      d.gradings.map(function (x, i) {
        return '<button type="button" class="seg-btn" data-act="attempt" data-i="' + i + '" aria-pressed="' + (i === d.sel) + '">Lần ' + (i + 1) + ' · ' + band(x.result.overall) + '</button>';
      }).join('') + '</div></div>';
    h += '<div class="overall glass"><div class="big-band grad">' + band(r.overall) + '</div><div class="ov-text"><p class="p">' + esc(r.summary) + '</p>' +
      '<div class="meta"><span>Chấm lúc ' + fmtFull(g.createdAt) + '</span><span>' + g.words + ' words</span></div>' +
      (d.body.trim() !== g.body.trim() ? '<p class="note">Bài viết đã được chỉnh sửa sau lần chấm này.</p>' : '') + '</div></div>';
    h += critHtml(r);
    if (r.strengths.length || r.weaknesses.length) {
      h += '<div class="sw-grid"><div class="glass sw"><h4 class="sw-good">Điểm mạnh</h4>' + listHtml(r.strengths, 'l-good') + '</div>' +
        '<div class="glass sw"><h4 class="sw-warn">Cần cải thiện</h4>' + listHtml(r.weaknesses, 'l-warn') + '</div></div>';
    }
    if (r.corrections.length) {
      h += '<div class="glass sw"><h4>Sửa lỗi chi tiết</h4><ul class="list corr">' + r.corrections.map(function (c) {
        return '<li><del>' + esc(c.original) + '</del> → <strong>' + esc(c.corrected) + '</strong>' + (c.explanation ? '<span class="why">' + esc(c.explanation) + '</span>' : '') + '</li>';
      }).join('') + '</ul></div>';
    }
    if (r.nextSteps.length) h += '<div class="glass sw"><h4>Việc nên làm tiếp</h4>' + listHtml(r.nextSteps, 'l-tip') + '</div>';
    if (r.improvedVersion) h += '<details class="glass fold"><summary>Bản viết lại gợi ý (khoảng band 8)</summary><div class="doc-body">' + esc(r.improvedVersion) + '</div></details>';
    h += '<details class="glass fold"><summary>Bài bạn đã nộp ở lần chấm này</summary><div class="doc-body">' + esc(g.body) + '</div></details>';
    return h;
  }
  function paintResult() { var el = $('#w-result'); if (el && W.d) el.innerHTML = resultHtml(W.d); }

  async function openQuestion(id) {
    flushSave();
    var it = W.byId[id]; if (!it) return;
    var d = { q: { id: it.id, text: it.text, topic: it.topic, qtype: it.qtype }, body: '', gradings: [], sel: 0, loading: true, dirty: false, saveText: '', saveTimer: 0, chain: Promise.resolve(), grading: false, gradeError: '', armed: false, armTimer: 0, essayExists: false };
    W.view = 'detail'; W.id = id; W.d = d;
    root.innerHTML = '<div class="w-narrow"><button type="button" class="btn btn-ghost btn-sm" data-act="list">' + ICON.back + 'Danh sách</button><div class="skel" style="margin-top:16px"></div><div class="skel"></div></div>';
    window.scrollTo(0, 0);
    try {
      var data = await req('GET', WRITE_API + '/questions/' + id);
      if (W.d !== d) return;
      d.q = data.question;
      if (data.essay) { d.body = data.essay.body || ''; d.gradings = data.essay.gradings || []; d.sel = Math.max(0, d.gradings.length - 1); d.essayExists = true; }
      d.loading = false;
      root.innerHTML = detailHtml(d); paintGrade(); paintResult();
      var ta = $('#w-body'); if (ta && !d.gradings.length) ta.focus();
    } catch (e) {
      if (W.d !== d) return;
      root.innerHTML = '<div class="w-narrow"><button type="button" class="btn btn-ghost btn-sm" data-act="list">' + ICON.back + 'Danh sách</button><div class="err" style="margin-top:16px"><span>' + esc(e.message) + '</span></div></div>';
    }
  }
  function backToList() { flushSave(); W.view = 'list'; W.id = null; W.d = null; drawList(); window.scrollTo(0, 0); }

  function setSaveText(d, t) { d.saveText = t; if (W.d === d) { var el = $('#w-saved'); if (el) el.textContent = t; } }
  function saveNow(keepalive) {
    var d = W.d; if (!d || d.loading || !d.dirty) return d ? d.chain : Promise.resolve();
    var body = d.body, id = d.q.id;
    d.dirty = false;
    setSaveText(d, 'Đang lưu…');
    d.chain = d.chain.then(function () {
      return req('PUT', WRITE_API + '/questions/' + id + '/essay', { body: body }, undefined, keepalive).then(function (res) {
        mergeSummary(id, res.summary);
        d.essayExists = !!res.savedAt;
        setSaveText(d, res.savedAt ? 'Đã lưu lúc ' + fmtClock(res.savedAt) : 'Chưa có nội dung');
        if (d.dirty) scheduleSave(d);
      }).catch(function (e) {
        d.dirty = true;
        setSaveText(d, 'Chưa lưu được. Sẽ thử lại khi bạn gõ tiếp.');
      });
    });
    return d.chain;
  }
  function scheduleSave(d) { clearTimeout(d.saveTimer); d.saveTimer = setTimeout(function () { saveNow(); }, 1000); }
  function flushSave(keepalive) {
    var d = W.d; if (!d || !d.dirty) return Promise.resolve();
    clearTimeout(d.saveTimer);
    return saveNow(keepalive);
  }
  window.addEventListener('beforeunload', function () { flushSave(true); });

  async function gradeNow() {
    var d = W.d; if (!d || d.grading || wc(d.body) < 20) return;
    clearTimeout(d.saveTimer); d.dirty = false;
    d.grading = true; d.gradeError = ''; paintGrade(); paintResult();
    var id = d.q.id;
    try {
      await d.chain;
      var res = await req('POST', WRITE_API + '/questions/' + id + '/grade', { body: d.body });
      d.gradings.push(res.grading); d.sel = d.gradings.length - 1; d.essayExists = true;
      mergeSummary(id, res.summary);
      setSaveText(d, 'Đã lưu lúc ' + fmtClock(res.grading.createdAt));
      if (W.d === d) flash('Đã chấm xong. Kết quả được lưu lại để xem sau.');
    } catch (e) {
      d.gradeError = e.message || 'Không chấm được bài lúc này.';
    } finally {
      d.grading = false;
      if (W.d === d) {
        paintGrade(); paintResult();
        var el = $('#w-result'); if (el && d.gradings.length) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }
  async function deleteEssay() {
    var d = W.d; if (!d) return;
    clearTimeout(d.saveTimer); d.dirty = false;
    try {
      await d.chain;
      await req('DELETE', WRITE_API + '/questions/' + d.q.id + '/essay');
      mergeSummary(d.q.id, { status: 'todo', words: 0, updatedAt: null, gradingCount: 0, band: null, gradedAt: null });
      flash('Đã xóa bài viết và kết quả chấm.');
      backToList();
    } catch (e) { flash('Chưa xóa được. Hãy thử lại sau vài giây.'); }
  }
  function randomQuestion() {
    var list = filtered();
    var pool = list.filter(function (it) { return it.status === 'todo'; });
    if (!pool.length) pool = list;
    if (!pool.length) { flash('Không có đề nào khớp bộ lọc.'); return; }
    openQuestion(pool[Math.floor(Math.random() * pool.length)].id);
  }
  function clearFilters() { W.q = ''; W.ftopic = ''; W.ftype = ''; W.fstatus = ''; W.page = 1; var q = $('#w-q'); if (q) q.value = ''; updateStats(); fillSelects(); updateResults(); }

  root.addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
    var act = b.dataset.act;
    if (act === 'open') { var id = Number(b.dataset.id); if (id) openQuestion(id); }
    else if (act === 'list') backToList();
    else if (act === 'reload') { W.ready = false; drawList(); loadQuestions(); }
    else if (act === 'random') randomQuestion();
    else if (act === 'clear') clearFilters();
    else if (act === 'togglestats') { W.statsOpen = !W.statsOpen; pref.set('de-stats', W.statsOpen ? '1' : '0'); updateStats(); }
    else if (act === 'fstat') {
      var kind = b.dataset.kind, val = b.dataset.val;
      if (kind === 'topic') W.ftopic = W.ftopic === val ? '' : val; else W.ftype = W.ftype === val ? '' : val;
      W.page = 1; updateStats(); fillSelects(); updateResults();
      var t = $('.toolbar'); if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    else if (act === 'page') { W.page += Number(b.dataset.d); updateResults(); var tb = $('.toolbar'); if (tb) tb.scrollIntoView({ block: 'start' }); }
    else if (act === 'sort') {
      var key = b.dataset.key;
      if (W.sort.key === key) W.sort.dir = W.sort.dir === 'asc' ? 'desc' : 'asc';
      else W.sort = { key: key, dir: (key === 'band' || key === 'status') ? 'desc' : 'asc' };
      W.page = 1; updateResults();
    }
    else if (act === 'grade') gradeNow();
    else if (act === 'attempt') { var d = W.d; if (d) { d.sel = Number(b.dataset.i); paintResult(); } }
    else if (act === 'tochat') { var dd = W.d; if (dd && dd.body.trim()) startChatWith('Sửa giúp mình đoạn này:\n' + dd.body); }
    else if (act === 'wdelete') {
      var d2 = W.d; if (!d2) return;
      if (!d2.armed) {
        d2.armed = true; root.innerHTML = detailHtml(d2); paintGrade(); paintResult();
        d2.armTimer = setTimeout(function () { d2.armed = false; if (W.d === d2) { root.innerHTML = detailHtml(d2); paintGrade(); paintResult(); } }, 3500);
      } else { clearTimeout(d2.armTimer); d2.armed = false; deleteEssay(); }
    }
  });
  root.addEventListener('input', function (e) {
    var id = e.target.id;
    if (id === 'w-body') {
      var d = W.d; if (!d) return;
      d.body = e.target.value; d.dirty = true;
      var n = wc(d.body), c = $('#w-count'); c.textContent = countText(n); c.className = countClass(n);
      setSaveText(d, 'Đang soạn…'); scheduleSave(d); paintGrade();
      var tc = $('[data-act="tochat"]'); if (tc) tc.disabled = !n;
    } else if (id === 'w-q') { W.q = e.target.value; W.page = 1; updateResults(); }
  });
  root.addEventListener('change', function (e) {
    var id = e.target.id;
    if (id === 'w-ft') { W.ftopic = e.target.value; W.page = 1; updateStats(); updateResults(); }
    else if (id === 'w-fq') { W.ftype = e.target.value; W.page = 1; updateStats(); updateResults(); }
    else if (id === 'w-fs') { W.fstatus = e.target.value; W.page = 1; updateResults(); }
    else if (id === 'w-sort') { var p = e.target.value.split(':'); W.sort = { key: p[0], dir: p[1] }; W.page = 1; updateResults(); }
  });

  /* ---------- Init ---------- */
  showTab((location.hash || '').replace('#', ''), false);
  drawList();
  loadConvs();
  loadQuestions();
})();

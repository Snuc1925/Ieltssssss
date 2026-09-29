const API_BASE = '/api/writing-fix';

const state = {
  sessions: [],
  currentSessionId: null,
};

const els = {
  sessionList: document.getElementById('sessionList'),
  messages: document.getElementById('messages'),
  chatTitle: document.getElementById('chatTitle'),
  composerForm: document.getElementById('composerForm'),
  messageInput: document.getElementById('messageInput'),
  sendBtn: document.getElementById('sendBtn'),
  newSessionBtn: document.getElementById('newSessionBtn'),
  themeToggleBtn: document.getElementById('themeToggleBtn'),
  themeIcon: document.getElementById('themeIcon'),
  accentSwatches: document.getElementById('accentSwatches'),
};

// ---------- Theme ----------
function initTheme() {
  let theme = 'light';
  let accent = 'blue';
  try {
    theme = localStorage.getItem('wf-theme') || theme;
    accent = localStorage.getItem('wf-accent') || accent;
  } catch (_) {}

  applyTheme(theme);
  applyAccent(accent);
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  els.themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
  try { localStorage.setItem('wf-theme', theme); } catch (_) {}
}

function applyAccent(accent) {
  document.documentElement.setAttribute('data-accent', accent);
  document.querySelectorAll('.swatch').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.accent === accent);
  });
  try { localStorage.setItem('wf-accent', accent); } catch (_) {}
}

els.themeToggleBtn.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  applyTheme(current === 'dark' ? 'light' : 'dark');
});

els.accentSwatches.addEventListener('click', (e) => {
  const btn = e.target.closest('.swatch');
  if (!btn) return;
  applyAccent(btn.dataset.accent);
});

// ---------- Markdown-lite renderer ----------
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function renderContent(text) {
  const escaped = escapeHtml(text);
  const lines = escaped.split('\n');
  let html = '';
  let inList = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const bullet = line.match(/^[-*]\s+(.*)/);

    if (bullet) {
      if (!inList) { html += '<ul>'; inList = true; }
      html += `<li>${inlineFormat(bullet[1])}</li>`;
      continue;
    }

    if (inList) { html += '</ul>'; inList = false; }

    if (line === '') continue;
    html += `<p>${inlineFormat(line)}</p>`;
  }

  if (inList) html += '</ul>';
  return html || '<p></p>';
}

function inlineFormat(str) {
  return str.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

function formatTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

// ---------- Sessions ----------
async function fetchSessions() {
  const res = await fetch(`${API_BASE}/sessions`);
  state.sessions = await res.json();
  renderSessionList();
}

function renderSessionList() {
  if (state.sessions.length === 0) {
    els.sessionList.innerHTML = '<p class="empty-hint">Chưa có cuộc trò chuyện nào.</p>';
    return;
  }

  els.sessionList.innerHTML = '';
  for (const s of state.sessions) {
    const item = document.createElement('div');
    item.className = 'session-item' + (s.id === state.currentSessionId ? ' active' : '');
    item.innerHTML = `
      <div class="session-item-main">
        <div class="session-item-title">${escapeHtml(s.title)}</div>
        <div class="session-item-meta">${s.messageCount} tin nhắn · ${formatTime(s.updatedAt)}</div>
      </div>
      <button class="session-item-delete" title="Xoá">✕</button>
    `;
    item.addEventListener('click', () => openSession(s.id));
    item.querySelector('.session-item-delete').addEventListener('click', (e) => {
      e.stopPropagation();
      removeSession(s.id);
    });
    els.sessionList.appendChild(item);
  }
}

async function createNewSession() {
  const res = await fetch(`${API_BASE}/sessions`, { method: 'POST' });
  const session = await res.json();
  await fetchSessions();
  await openSession(session.id);
}

async function removeSession(id) {
  if (!confirm('Xoá cuộc trò chuyện này? Không thể hoàn tác.')) return;
  await fetch(`${API_BASE}/sessions/${id}`, { method: 'DELETE' });
  if (state.currentSessionId === id) {
    state.currentSessionId = null;
    els.messages.innerHTML = '';
    els.chatTitle.textContent = 'Chọn hoặc tạo một cuộc trò chuyện';
    setComposerEnabled(false);
  }
  await fetchSessions();
}

async function openSession(id) {
  state.currentSessionId = id;
  const res = await fetch(`${API_BASE}/sessions/${id}`);
  const session = await res.json();

  els.chatTitle.textContent = session.title;
  setComposerEnabled(true);
  renderSessionList();
  renderMessages(session.messages);
}

function setComposerEnabled(enabled) {
  els.messageInput.disabled = !enabled;
  els.sendBtn.disabled = !enabled;
  if (enabled) els.messageInput.focus();
}

function renderMessages(messages) {
  els.messages.innerHTML = '';
  for (const m of messages) {
    appendMessageBubble(m.role, m.content, m.createdAt);
  }
  scrollToBottom();
}

function appendMessageBubble(role, content, createdAt) {
  const row = document.createElement('div');
  row.className = `msg-row ${role}`;
  row.innerHTML = `
    <div>
      <div class="msg-bubble">${renderContent(content)}</div>
      <div class="msg-time">${createdAt ? formatTime(createdAt) : ''}</div>
    </div>
  `;
  els.messages.appendChild(row);
  return row;
}

function appendLoadingBubble() {
  const row = document.createElement('div');
  row.className = 'msg-row assistant loading';
  row.innerHTML = `
    <div>
      <div class="msg-bubble"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div>
    </div>
  `;
  els.messages.appendChild(row);
  scrollToBottom();
  return row;
}

function scrollToBottom() {
  els.messages.scrollTop = els.messages.scrollHeight;
}

// ---------- Sending messages ----------
els.composerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const content = els.messageInput.value.trim();
  if (!content || !state.currentSessionId) return;

  els.messageInput.value = '';
  setComposerEnabled(false);
  appendMessageBubble('user', content, new Date().toISOString());
  scrollToBottom();
  const loadingRow = appendLoadingBubble();

  try {
    const res = await fetch(`${API_BASE}/sessions/${state.currentSessionId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });

    loadingRow.remove();

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const row = appendMessageBubble('assistant', err.error || 'Có lỗi xảy ra, vui lòng thử lại.', new Date().toISOString());
      row.classList.add('msg-error');
    } else {
      const data = await res.json();
      appendMessageBubble('assistant', data.assistantMessage.content, data.assistantMessage.createdAt);
      els.chatTitle.textContent = data.title;
    }
  } catch (err) {
    loadingRow.remove();
    const row = appendMessageBubble('assistant', 'Không thể kết nối tới server. Kiểm tra lại kết nối mạng.', new Date().toISOString());
    row.classList.add('msg-error');
  }

  scrollToBottom();
  setComposerEnabled(true);
  await fetchSessions();
});

els.newSessionBtn.addEventListener('click', createNewSession);

els.messageInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    els.composerForm.requestSubmit();
  }
});

// ---------- Init ----------
initTheme();
fetchSessions();

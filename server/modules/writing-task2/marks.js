// Tính các đoạn cần tô màu trong bài mẫu bằng cách đối chiếu TOÀN BỘ thư viện (không chỉ các ref đã gắn).
// Hai tầng: "sent" = cả câu mang ý / ví dụ (nền nhạt), "word" = cụm / từ đồng nghĩa / khung / từ nối (đậm, nằm trong câu).

const WORD = /[a-z0-9]+(?:['’-][a-z0-9]+)*/g;

const NOISY_ALTS = new Set(['since', 'as', 'children', 'support', 'maintain', 'test', 'work', 'funds', 'ease', 'raise', 'rise', 'show', 'give', 'make', 'jobs', 'ability', 'degree', 'stress']);

const esc =(s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const norm = (s) => s.toLowerCase().replace(/[’‘]/g, "'");

function words(text) {
  const out = [];
  let m;
  WORD.lastIndex = 0;
  while ((m = WORD.exec(text))) out.push({ w: m[0], s: m.index, e: m.index + m[0].length });
  return out;
}

function sentenceBounds(text, pos) {
  let s = pos;
  while (s > 0 && !/[.!?]/.test(text[s - 1])) s--;
  while (s < text.length && /\s/.test(text[s])) s++;
  let e = pos;
  while (e < text.length && !/[.!?]/.test(text[e])) e++;
  return [s, Math.min(e + 1, text.length)];
}

// Cụm có dạng "a / b", bỏ dấu câu ở đầu và cuối; trả về các biến thể dùng để tìm.
function phraseVariants(t) {
  return String(t).split(/\s+\/\s+/).map((x) => norm(x).replace(/^[\s,;.]+|[\s,;.]+$/g, '')).filter(Boolean);
}

// Các đoạn cố định của khung câu (bỏ {…}, …, →, phần mô tả tiếng Việt).
function frameSegments(t) {
  if (/[^\x00-\x7f]/.test(t.replace(/[…→’‘]/g, ''))) return [];
  return t.split(/\{[^}]*\}|…|→|[();]/).map((x) => norm(x).replace(/^[\s,.]+|[\s,.]+$/g, '')).filter((x) => x.split(/\s+/).length >= 3);
}

function findAll(low, needle, out, meta, whole = true) {
  const re = new RegExp((whole ? '(?<![a-z0-9])' : '') + esc(needle) + (whole ? "(?![a-z0-9])" : ''), 'g');
  let m;
  while ((m = re.exec(low))) out.push({ s: m.index, e: m.index + needle.length, ...meta });
}

// Đoạn chung dài nhất (theo từ) giữa một câu của thư viện và bài viết.
function longestCommon(essayWords, field) {
  const fw = words(norm(field));
  let best = 0, bestEnd = -1;
  let prev = new Array(fw.length + 1).fill(0);
  for (let i = 1; i <= essayWords.length; i++) {
    const cur = new Array(fw.length + 1).fill(0);
    for (let j = 1; j <= fw.length; j++) {
      if (essayWords[i - 1].w === fw[j - 1].w) {
        cur[j] = prev[j - 1] + 1;
        if (cur[j] > best) { best = cur[j]; bestEnd = i - 1; }
      }
    }
    prev = cur;
  }
  return { len: best, start: bestEnd - best + 1 };
}

function resolve(list) {
  list.sort((a, b) => a.s - b.s || (b.e - b.s) - (a.e - a.s));
  const kept = [];
  let pos = 0;
  for (const r of list) { if (r.s < pos) continue; kept.push(r); pos = r.e; }
  return kept;
}

export function computeMarks(text, entries) {
  const low = norm(text);
  const ew = words(low);
  const wordMarks = [];
  const sentCand = new Map(); // "s-e" → ứng viên tốt nhất

  for (const e of entries) {
    const meta = { id: e.id, type: e.type };
    if (e.type === 'phrase' || e.type === 'connector') {
      for (const v of phraseVariants(e.text || '')) {
        if (v.includes('{')) continue;
        const single = !/\s/.test(v);
        if (single && v.length < 8) continue; // bỏ từ đơn ngắn như should / must
        findAll(low, v, wordMarks, meta);
      }
    } else if (e.type === 'synonyms') {
      for (const a of e.alts || []) {
        const v = norm(a);
        if (v.length < 4 || NOISY_ALTS.has(v) || v === norm(e.base || '') + 's') continue; // dạng số nhiều / từ quá thông dụng thì không tô
        findAll(low, v, wordMarks, meta);
      }
    } else if (e.type === 'frame') {
      for (const seg of frameSegments(e.text || '')) findAll(low, seg, wordMarks, meta);
    } else if (e.type === 'idea' || e.type === 'example') {
      const fields = e.type === 'idea' ? [e.claim, e.because, e.result] : [e.text];
      for (const f of fields) {
        if (!f) continue;
        const c = longestCommon(ew, f);
        if (c.len < 6) continue;
        const [s, en] = sentenceBounds(text, ew[c.start].s);
        const key = s + '-' + en;
        const old = sentCand.get(key);
        if (!old || c.len > old.len) sentCand.set(key, { s, e: en, id: e.id, type: e.type, len: c.len });
      }
    }
  }

  const sent = resolve([...sentCand.values()].map(({ len, ...r }) => r));
  const word = resolve(wordMarks);
  return [...sent.map((r) => ({ ...r, level: 0 })), ...word.map((r) => ({ ...r, level: 1 }))];
}

export function coverage(text, marks) {
  const cov = new Array(text.length).fill(false);
  for (const m of marks) if (m.level === 1) for (let i = m.s; i < m.e; i++) cov[i] = true;
  return cov.filter(Boolean).length / text.length;
}

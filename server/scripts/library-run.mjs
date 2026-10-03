// Công cụ cho vòng lặp: viết bài -> chấm -> sửa -> bổ sung thư viện.
//   node server/scripts/library-run.mjs merge <patch.json>    gộp entry mới vào lexicon.json (bỏ qua id trùng)
//   node server/scripts/library-run.mjs grade <id> [<id>...]  chấm drafts/<id>.json, ghi phiên bản vào essays.<topic>.json
//   node server/scripts/library-run.mjs verify <id...>        chấm chéo bản mới nhất bằng DeepSeek (khắt khe hơn), lưu vào crossCheck
//   node server/scripts/library-run.mjs check                 kiểm tra mọi ref trong phân tích đều có trong lexicon
//   node server/scripts/library-run.mjs list [type]           liệt kê entry (id + text rút gọn)
// Chấm: GRADER_ENGINE=auto (Gemini, hết quota thì DeepSeek). Ngưỡng đạt: overall >= 7.0
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gradeEssay } from '../modules/writing-task2/grader.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DATA = path.join(ROOT, 'server', 'data', 'writing-task2');
const LIB_DIR = path.join(DATA, 'library');
const LEXICON = path.join(LIB_DIR, 'lexicon.json');
const TOPIC = 'education';
const ESSAYS = path.join(LIB_DIR, `essays.${TOPIC}.json`);
const DRAFTS = path.join(LIB_DIR, 'drafts');
const PASS = 7.0;

const readJson = (f, fallback) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : fallback);
const writeJson = (f, data) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(data, null, 2) + '\n', 'utf8'); };
const words = (t) => (t.trim() ? t.trim().split(/\s+/).length : 0);

function loadLexicon() { return readJson(LEXICON, { version: 1, entries: [] }); }

function merge(patchFile) {
  const patch = readJson(path.resolve(patchFile));
  const lex = loadLexicon();
  const byId = new Map(lex.entries.map((e) => [e.id, e]));
  let added = 0, skipped = [], textDup = [];
  for (const e of patch.entries || patch) {
    if (!e.id || !e.type) { console.log('! entry thiếu id/type:', JSON.stringify(e).slice(0, 80)); continue; }
    if (byId.has(e.id)) { skipped.push(e.id); continue; }
    const key = (e.text || e.base || e.claim || '').toLowerCase();
    const dup = key && lex.entries.find((x) => (x.text || x.base || x.claim || '').toLowerCase() === key && x.type === e.type);
    if (dup) textDup.push(`${e.id} ~ ${dup.id}`);
    lex.entries.push(e); byId.set(e.id, e); added++;
  }
  writeJson(LEXICON, lex);
  console.log(`Gộp xong: +${added} entry, bỏ qua ${skipped.length} id trùng${skipped.length ? ' (' + skipped.join(', ') + ')' : ''}. Tổng: ${lex.entries.length}.`);
  if (textDup.length) console.log('Cảnh báo nội dung giống nhau:', textDup.join('; '));
}

async function grade(ids) {
  const questions = readJson(path.join(DATA, 'questions.json'));
  const store = readJson(ESSAYS, { topic: TOPIC, passScore: PASS, essays: [] });
  const rows = [];
  let next = 0;
  async function worker() {
    while (next < ids.length) {
      const id = ids[next++];
      const q = questions.find((x) => x.id === id);
      const draft = readJson(path.join(DRAFTS, `${id}.json`));
      if (!q || !draft) { rows.push({ id, error: 'thiếu đề hoặc draft' }); continue; }
      let rec = store.essays.find((e) => e.questionId === id);
      if (!rec) { rec = { questionId: id, qtype: q.qtype, question: q.text, versions: [] }; store.essays.push(rec); }
      const last = rec.versions[rec.versions.length - 1];
      if (last && last.text === draft.text && last.grade) { rows.push({ id, same: true, ...last.grade }); rec.analysis = draft.analysis; continue; }
      try {
        const g = await gradeEssay(q, draft.text);
        const v = { n: rec.versions.length + 1, at: new Date().toISOString(), words: words(draft.text), text: draft.text,
          note: draft.revisionNote || '',
          grade: { engine: g.engine, overall: g.overall, bands: g.bands, summary: g.summary, weaknesses: g.weaknesses, feedback: g.feedback } };
        rec.versions.push(v); rec.analysis = draft.analysis;
        rows.push({ id, version: v.n, words: v.words, ...v.grade });
      } catch (e) { rows.push({ id, error: e.message.slice(0, 160) }); }
      rec.final = rec.versions.length ? rec.versions.length : 0;
      rec.passed = rec.versions.some((x) => x.grade && x.grade.overall >= PASS);
      writeJson(ESSAYS, store);
    }
  }
  await Promise.all([worker(), worker(), worker()]);
  store.essays.sort((a, b) => a.questionId - b.questionId);
  writeJson(ESSAYS, store);
  rows.sort((a, b) => a.id - b.id).forEach((r) => {
    if (r.error) return console.log(`#${r.id} LỖI: ${r.error}`);
    const b = r.bands;
    console.log(`#${r.id} v${r.version || '='} ${r.words || ''}w  ${r.engine}  overall=${r.overall} ${r.overall >= PASS ? 'ĐẠT ' : 'CHƯA '}  TR=${b.taskResponse} CC=${b.coherenceCohesion} LR=${b.lexicalResource} GRA=${b.grammar}${r.same ? ' (không đổi)' : ''}`);
    if (r.overall < PASS) { console.log('    yếu:', (r.weaknesses || []).slice(0, 3).join(' | ')); console.log('    TR:', (r.feedback && r.feedback.taskResponse || '').slice(0, 220)); }
  });
}


async function verify(ids) {
  process.env.GRADER_ENGINE = 'deepseek';
  const questions = readJson(path.join(DATA, 'questions.json'));
  const store = readJson(ESSAYS, { essays: [] });
  let next = 0;
  async function worker() {
    while (next < ids.length) {
      const id = ids[next++];
      const rec = store.essays.find((e) => e.questionId === id);
      const q = questions.find((x) => x.id === id);
      if (!rec || !q) continue;
      const last = rec.versions[rec.versions.length - 1];
      try {
        const g = await gradeEssay(q, last.text);
        rec.crossCheck = { engine: g.engine, version: last.n, at: new Date().toISOString(), overall: g.overall, bands: g.bands, summary: g.summary, weaknesses: g.weaknesses };
        console.log(`#${id} v${last.n} ${g.engine} overall=${g.overall} TR=${g.bands.taskResponse} CC=${g.bands.coherenceCohesion} LR=${g.bands.lexicalResource} GRA=${g.bands.grammar}`);
      } catch (e) { console.log(`#${id} LỖI ${e.message.slice(0, 120)}`); }
      writeJson(ESSAYS, store);
    }
  }
  await Promise.all([worker(), worker(), worker()]);
}

// chunks <file.json>: {"<questionId>": [["cụm nguyên văn trong bài", "nghĩa tiếng Việt", "role?"], ...]}
// Mỗi cụm phải có nguyên văn trong bài (không phân biệt hoa/thường) → tạo mục phrase mới; trùng thì bỏ qua.
function chunks(file) {
  const lex = loadLexicon();
  const store = readJson(ESSAYS, { essays: [] });
  const norm = (x) => x.toLowerCase().replace(/[’‘]/g, "'").replace(/^[\s,;.]+|[\s,;.]+$/g, '');
  const have = new Set();
  lex.entries.forEach((e) => { if (e.text) String(e.text).split(/\s+\/\s+/).forEach((v) => have.add(norm(v))); });
  const ids = new Set(lex.entries.map((e) => e.id));
  const data = readJson(path.resolve(file), {});
  let added = 0, dup = 0, bad = 0;
  for (const [qid, items] of Object.entries(data)) {
    const rec = store.essays.find((x) => x.questionId === Number(qid));
    if (!rec) { console.log(`#${qid}: không có bài`); continue; }
    const text = rec.versions.at(-1).text.toLowerCase().replace(/[’‘]/g, "'");
    for (const [raw, vi, role] of items) {
      const t = norm(raw);
      if (!text.includes(t)) { console.log(`#${qid}: KHÔNG có trong bài: "${raw}"`); bad++; continue; }
      if (have.has(t)) { dup++; continue; }
      let id = 'PH-' + t.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 44).replace(/-$/, '');
      for (let n = 2; ids.has(id); n++) id = id.replace(/-\d+$/, '') + '-' + n;
      const topics = role === 'g' ? ['general'] : ['education', 'general'];
      lex.entries.push({ id, type: 'phrase', topics, role: role && role !== 'g' ? role : 'collocation', text: raw.replace(/^[\s,;.]+|[\s,;.]+$/g, ''), meaning_vi: vi, from: Number(qid) });
      ids.add(id); have.add(t); added++;
      rec.analysis = rec.analysis || { plan: [], newEntries: [] };
      (rec.analysis.newEntries = rec.analysis.newEntries || []).push(id);
    }
  }
  writeJson(LEXICON, lex); writeJson(ESSAYS, store);
  console.log(`Chunks: +${added} cụm mới, ${dup} trùng, ${bad} lỗi. Tổng entry: ${lex.entries.length}`);
}

function check() {
  const lex = loadLexicon(); const ids = new Set(lex.entries.map((e) => e.id));
  const store = readJson(ESSAYS, { essays: [] });
  let bad = 0, refs = 0;
  for (const e of store.essays) {
    const a = e.analysis; if (!a) { console.log(`#${e.questionId}: chưa có phân tích`); continue; }
    const all = [...(a.plan || []).flatMap((s) => s.refs || []), ...(a.paragraphs || []).flatMap((p) => p.refs || []), ...(a.newEntries || [])];
    for (const r of all) { refs++; if (!ids.has(r)) { bad++; console.log(`#${e.questionId}: ref không tồn tại: ${r}`); } }
  }
  const used = new Set(store.essays.flatMap((e) => { const a = e.analysis || {}; return [...(a.plan || []).flatMap((s) => s.refs || []), ...(a.paragraphs || []).flatMap((p) => p.refs || []), ...(a.newEntries || [])]; }));
  console.log(`Kiểm tra xong: ${refs} ref, ${bad} lỗi. Entry đã được bài nào đó dùng: ${used.size}/${lex.entries.length}.`);
}

function list(type) {
  const lex = loadLexicon();
  lex.entries.filter((e) => !type || e.type === type).forEach((e) => console.log(`${e.id} | ${(e.text || e.base + ' -> ' + (e.alts || []).join(', ') || e.claim || '').slice(0, 110)}`));
}

const [cmd, ...args] = process.argv.slice(2);
if (cmd === 'merge') merge(args[0]);
else if (cmd === 'grade') await grade(args.map(Number));
else if (cmd === 'verify') await verify(args.map(Number));
else if (cmd === 'check') check();
else if (cmd === 'chunks') chunks(args[0]);
else if (cmd === 'list') list(args[0]);
else console.log('Lệnh: merge <patch> | grade <id...> | verify <id...> | check | list [type]');

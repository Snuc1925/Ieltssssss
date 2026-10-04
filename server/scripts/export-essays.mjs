// Xuất 83 bài mẫu thành Markdown (từ quan trọng in đậm) + HTML tô màu để in PDF.
//   node server/scripts/export-essays.mjs [education|environment]  →  exports/<Topic>-<N>-essays.md / .html
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeMarks } from '../modules/writing-task2/marks.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const LIB = path.join(ROOT, 'server', 'data', 'writing-task2', 'library');
const OUT = path.join(ROOT, 'exports');
const TOPIC = process.argv[2] || 'education';
const TOPIC_NAME = { education: 'Education',environment: 'Environment & Energy',health: 'Health & Sport',transport: 'Transport, Housing & Cities',technology: 'Technology & Science',travel: 'Travel & Tourism',economy: 'Economy & Business',media: 'Media & Advertising',work: 'Work & Careers',arts: 'Arts & Culture',family: 'Family & Society',crime: 'Crime & Law',government: 'Government & Politics' }[TOPIC] || TOPIC;
const FILE_BASE = { education: 'Education',environment: 'Environment-Energy',health: 'Health-Sport',transport: 'Transport-Housing-Cities',technology: 'Technology-Science',travel: 'Travel-Tourism',economy: 'Economy-Business',media: 'Media-Advertising',work: 'Work-Careers',arts: 'Arts-Culture',family: 'Family-Society',crime: 'Crime-Law',government: 'Government-Politics' }[TOPIC] || TOPIC;
fs.mkdirSync(OUT, { recursive: true });

const lex = JSON.parse(fs.readFileSync(path.join(LIB, 'lexicon.json'), 'utf8')).entries;
const byId = Object.fromEntries(lex.map((e) => [e.id, e]));
const essays = JSON.parse(fs.readFileSync(path.join(LIB, `essays.${TOPIC}.json`), 'utf8')).essays;

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const TYPE_VI = { phrase: 'Cụm từ', synonyms: 'Từ đồng nghĩa', connector: 'Từ nối', frame: 'Khung câu', idea: 'Câu mang ý', example: 'Câu ví dụ' };

const order = [...new Set(essays.map((e) => e.qtype))];
const sorted = [...essays].sort((a, b) => order.indexOf(a.qtype) - order.indexOf(b.qtype) || a.questionId - b.questionId);

function paragraphs(text, marks) {
  let off = 0;
  return text.split(/\n\n/).map((p) => {
    const base = off; off += p.length + 2;
    const m = marks.filter((r) => r.s >= base && r.e <= base + p.length).map((r) => ({ ...r, s: r.s - base, e: r.e - base }));
    return { p, sent: m.filter((r) => r.level === 0), word: m.filter((r) => r.level === 1) };
  });
}

function mdPara({ p, word }) {
  let out = '', pos = 0;
  word.forEach((r) => { if (r.s < pos) return; out += p.slice(pos, r.s) + '**' + p.slice(r.s, r.e) + '**'; pos = r.e; });
  return out + p.slice(pos);
}

function htmlPara({ p, sent, word }) {
  const span = (r, inner, cls = '') => `<span class="hl ty-${r.type}${cls}">${inner}</span>`;
  const words = (from, to) => {
    let out = '', pos = from;
    word.forEach((r) => { if (r.s < pos || r.e > to) return; out += esc(p.slice(pos, r.s)) + span(r, esc(p.slice(r.s, r.e))); pos = r.e; });
    return out + esc(p.slice(pos, to));
  };
  let out = '', pos = 0;
  sent.forEach((r) => { if (r.s < pos) return; out += words(pos, r.s) + span(r, words(r.s, r.e), ' sent'); pos = r.e; });
  return out + words(pos, p.length);
}

const band = (g) => (g && g.overall != null ? Number(g.overall).toFixed(1) : '–');
let md = `# ${essays.length} bài mẫu IELTS Writing Task 2 — chủ đề ${TOPIC_NAME}\n\n` +
  `Mỗi bài: đề → bài mẫu (từ/cụm quan trọng **in đậm**) → các cụm cần nhớ kèm nghĩa. Điểm do AI chấm (Gemini/DeepSeek), tham khảo.\n\n## Mục lục\n\n`;
let html = '';
const toc = [];
let n = 0;

for (const type of order) {
  md += `- **${type}**: ` + sorted.filter((e) => e.qtype === type).map((e) => `#${e.questionId}`).join(', ') + '\n';
}
md += '\n';

for (const type of order) {
  md += `\n---\n\n## ${type}\n`;
  html += `<h2 class="grp">${esc(type)}</h2>`;
  toc.push(type);
  for (const rec of sorted.filter((e) => e.qtype === type)) {
    n++;
    const v = rec.versions.at(-1);
    const marks = computeMarks(v.text, lex);
    const paras = paragraphs(v.text, marks);
    const phrases = [];
    const seen = new Set();
    marks.filter((r) => r.level === 1 && (r.type === 'phrase')).forEach((r) => {
      const e = byId[r.id];
      if (!e || !e.meaning_vi || seen.has(r.id)) return;
      seen.add(r.id); phrases.push(e);
    });
    const sc = `${band(v.grade)}${rec.crossCheck ? ` (chấm chéo ${band(rec.crossCheck)})` : ''}`;

    md += `\n### #${rec.questionId} — ${rec.question}\n\n*${rec.qtype} · ${v.words} từ · điểm AI: ${sc}*\n\n` +
      paras.map(mdPara).join('\n\n') + '\n\n';
    if (phrases.length) md += `**Cụm cần nhớ**\n\n` + phrases.map((e) => `- ${e.text} — ${e.meaning_vi}`).join('\n') + '\n';

    html += `<article class="essay"><div class="meta"><span class="id">#${rec.questionId}</span><span>${esc(rec.qtype)} · ${v.words} từ · AI ${esc(sc)}</span></div>` +
      `<h3>${esc(rec.question)}</h3>` + paras.map((x) => `<p>${htmlPara(x)}</p>`).join('') +
      (phrases.length ? `<div class="kp"><b>Cụm cần nhớ</b><ul>${phrases.map((e) => `<li><span class="en">${esc(e.text)}</span> — ${esc(e.meaning_vi)}</li>`).join('')}</ul></div>` : '') +
      `</article>`;
  }
}

const css = `
@page { size: A4; margin: 16mm 14mm; }
* { box-sizing: border-box; }
body { font: 10.5pt/1.55 "Segoe UI", "Noto Sans", Arial, sans-serif; color: #1b2030; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
h1 { font-size: 22pt; margin: 0 0 4pt; } .sub { color: #5b6478; margin: 0 0 10pt; }
.legend { display: flex; flex-wrap: wrap; gap: 6pt 10pt; margin: 8pt 0 14pt; font-size: 9pt; }
h2.grp { font-size: 15pt; border-bottom: 2px solid #3b82f6; padding-bottom: 3pt; margin: 22pt 0 10pt; break-before: page; }
.essay { break-inside: avoid-page; margin: 0 0 16pt; padding: 10pt 12pt; border: 1px solid #dfe3ee; border-radius: 8pt; }
.essay h3 { font-size: 11.5pt; margin: 2pt 0 8pt; }
.meta { display: flex; gap: 8pt; align-items: center; font-size: 8.5pt; color: #5b6478; }
.meta .id { background: #3b82f6; color: #fff; border-radius: 4pt; padding: 0 5pt; font-weight: 600; }
.essay p { margin: 0 0 6pt; text-align: justify; }
.hl { border-radius: 3pt; padding: 0 1pt; background: color-mix(in srgb, var(--kc) 24%, transparent); box-shadow: inset 0 -1.5pt 0 color-mix(in srgb, var(--kc) 70%, transparent); }
.hl.sent { background: color-mix(in srgb, var(--kc) 9%, transparent); box-shadow: none; padding: 0; }
.hl.sent .hl { background: color-mix(in srgb, var(--kc) 24%, transparent); box-shadow: inset 0 -1.5pt 0 color-mix(in srgb, var(--kc) 70%, transparent); }
.ty-phrase { --kc: #3b82f6; } .ty-synonyms { --kc: #16a34a; } .ty-connector { --kc: #0ea5e9; } .ty-frame { --kc: #8b5cf6; } .ty-idea { --kc: #f59e0b; } .ty-example { --kc: #ec4899; }
.legend span { padding: 0 6pt; }
.kp { margin-top: 6pt; padding-top: 6pt; border-top: 1px dashed #cfd5e4; font-size: 9pt; }
.kp ul { columns: 2; column-gap: 16pt; margin: 3pt 0 0; padding-left: 14pt; } .kp li { break-inside: avoid; margin: 0 0 1pt; }
.kp .en { font-weight: 600; color: #1d4ed8; }
`;
const legend = Object.entries(TYPE_VI).map(([t, l]) => `<span class="hl ty-${t}${t === 'idea' || t === 'example' ? ' sent' : ''}">${l}</span>`).join('');
fs.writeFileSync(path.join(OUT, `${FILE_BASE}-${essays.length}-essays.md`), md, 'utf8');
fs.writeFileSync(path.join(OUT, `${FILE_BASE}-${essays.length}-essays.html`),
  `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${essays.length} bài mẫu IELTS Writing Task 2 — ${esc(TOPIC_NAME)}</title><style>${css}</style></head><body>` +
  `<h1>${essays.length} bài mẫu IELTS Writing Task 2 — ${esc(TOPIC_NAME)}</h1><p class="sub">Từ và cụm quan trọng được tô màu; cuối mỗi bài là các cụm cần nhớ kèm nghĩa. Điểm do AI chấm, chỉ để tham khảo.</p><div class="legend">${legend}</div>${html}</body></html>`, 'utf8');
console.log(`Đã xuất ${n} bài → exports/${FILE_BASE}-${essays.length}-essays.md / .html`);

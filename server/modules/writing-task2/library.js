import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeMarks } from './marks.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.join(__dirname, '..', '..', 'data', 'writing-task2', 'library');
const PROGRESS = path.join(DIR, 'progress.json');

let progressQueue = Promise.resolve();

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf-8'));
  } catch (err) {
    if (err.code === 'ENOENT' && fallback !== undefined) return fallback;
    throw err;
  }
}

// level: 0 = chưa nhớ, 1 = mơ hồ, 2 = đã thuộc. Ghi qua hàng đợi + rename để không hỏng file.
export function setProgress(id, level) {
  progressQueue = progressQueue.catch(() => {}).then(async () => {
    const all = await readJson(PROGRESS, {});
    if (level === 0) delete all[id];
    else all[id] = { level, updatedAt: new Date().toISOString() };
    const tmp = `${PROGRESS}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(all, null, 2), 'utf-8');
    await fs.rename(tmp, PROGRESS);
    return all;
  });
  return progressQueue;
}

// Đọc lại file mỗi lần gọi: sửa lexicon / essays xong là thấy ngay, không cần restart server.
export const LIBRARY_TOPICS = ['education','environment','health','transport','technology','travel','economy','media','work','arts','family','crime','government'];

export async function getLibrary(topic = 'education') {
  if (!LIBRARY_TOPICS.includes(topic)) topic = 'education';
  const [lexicon, store, progress] = await Promise.all([
    readJson(path.join(DIR, 'lexicon.json')),
    readJson(path.join(DIR, `essays.${topic}.json`), { topic, passScore: 7, essays: [] }),
    readJson(PROGRESS, {}),
  ]);
  // Vùng tô màu tính từ toàn bộ thư viện (không chỉ các ref gắn tay), nên cụm mới thêm vào lexicon tự hiện trong mọi bài.
  const essays = store.essays.map((rec) => ({
    ...rec,
    versions: rec.versions.map((v) => ({ ...v, marks: computeMarks(v.text, lexicon.entries) })),
  }));
  return { topic: store.topic || topic, passScore: store.passScore || 7, entries: lexicon.entries, essays, progress };
}

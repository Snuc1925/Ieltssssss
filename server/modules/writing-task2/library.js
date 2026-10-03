import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
export async function getLibrary(topic = 'education') {
  const [lexicon, store, progress] = await Promise.all([
    readJson(path.join(DIR, 'lexicon.json')),
    readJson(path.join(DIR, `essays.${topic}.json`), { topic, passScore: 7, essays: [] }),
    readJson(PROGRESS, {}),
  ]);
  return { topic: store.topic || topic, passScore: store.passScore || 7, entries: lexicon.entries, essays: store.essays, progress };
}

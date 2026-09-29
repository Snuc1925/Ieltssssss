import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.join(__dirname, '..', '..', 'data', 'writing-task2', 'essays');

// Moi de bai = 1 file <id>.json:
// { questionId, body, createdAt, updatedAt, gradings: [{ id, createdAt, body, words, result }] }
// Ghi qua hang doi theo tung file + ghi tam roi rename de khong hong file khi tat may giua chung.
const queues = new Map();

function filePath(id) {
  return path.join(DIR, `${id}.json`);
}

export function countWords(text) {
  const t = (text || '').trim();
  return t ? t.split(/\s+/).length : 0;
}

function enqueue(id, task) {
  const prev = queues.get(id) || Promise.resolve();
  const next = prev.catch(() => {}).then(task);
  queues.set(id, next);
  next.finally(() => { if (queues.get(id) === next) queues.delete(id); }).catch(() => {});
  return next;
}

async function readRaw(id) {
  try {
    return JSON.parse(await fs.readFile(filePath(id), 'utf-8'));
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

async function writeRaw(essay) {
  await fs.mkdir(DIR, { recursive: true });
  const target = filePath(essay.questionId);
  const tmp = `${target}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(essay, null, 2), 'utf-8');
  await fs.rename(tmp, target);
}

export async function getEssay(id) {
  return readRaw(id);
}

export function summarize(essay) {
  if (!essay) return { status: 'todo', words: 0, updatedAt: null, gradingCount: 0, band: null, gradedAt: null };
  const last = essay.gradings[essay.gradings.length - 1] || null;
  const words = countWords(essay.body) || (last ? last.words : 0);
  const hasBody = countWords(essay.body) > 0;
  let status = 'todo';
  if (last) status = 'graded';
  else if (hasBody) status = 'draft';
  return {
    status,
    words,
    updatedAt: essay.updatedAt,
    gradingCount: essay.gradings.length,
    band: last ? last.result.overall : null,
    gradedAt: last ? last.createdAt : null,
  };
}

export async function listSummaries() {
  let files = [];
  try {
    files = await fs.readdir(DIR);
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
  const out = {};
  await Promise.all(
    files
      .filter((f) => /^\d+\.json$/.test(f))
      .map(async (f) => {
        const id = Number(f.replace('.json', ''));
        const essay = await readRaw(id);
        if (essay) out[id] = summarize(essay);
      })
  );
  return out;
}

export function saveDraft(id, body) {
  return enqueue(id, async () => {
    const now = new Date().toISOString();
    let essay = await readRaw(id);
    if (!essay) {
      if (!body.trim()) return null;
      essay = { questionId: id, body: '', createdAt: now, updatedAt: now, gradings: [] };
    }
    essay.body = body;
    essay.updatedAt = now;
    if (!body.trim() && essay.gradings.length === 0) {
      await fs.rm(filePath(id), { force: true });
      return null;
    }
    await writeRaw(essay);
    return essay;
  });
}

export function appendGrading(id, body, result) {
  return enqueue(id, async () => {
    const now = new Date().toISOString();
    let essay = await readRaw(id);
    if (!essay) essay = { questionId: id, body, createdAt: now, updatedAt: now, gradings: [] };
    essay.body = body;
    essay.updatedAt = now;
    const grading = { id: crypto.randomUUID(), createdAt: now, body, words: countWords(body), result };
    essay.gradings.push(grading);
    await writeRaw(essay);
    return { essay, grading };
  });
}

export function deleteEssay(id) {
  return enqueue(id, async () => {
    await fs.rm(filePath(id), { force: true });
  });
}

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getQuestions } from './questionBank.js';
import { assemble } from './assembler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.join(__dirname, '..', '..', 'data', 'writing-task2', 'study');
const PROGRESS = path.join(DIR, 'progress.json');

let progressQueue = Promise.resolve();

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, 'utf-8'));
}

async function readProgress() {
  try {
    return await readJson(PROGRESS);
  } catch (err) {
    if (err.code === 'ENOENT') return {};
    throw err;
  }
}

// level: 0 = chua nho, 1 = mo ho, 2 = da thuoc. Ghi qua hang doi + rename de khong hong file.
export function setProgress(id, level) {
  progressQueue = progressQueue.catch(() => {}).then(async () => {
    const all = await readProgress();
    if (level === 0) delete all[id];
    else all[id] = { level, updatedAt: new Date().toISOString() };
    const tmp = `${PROGRESS}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(all, null, 2), 'utf-8');
    await fs.rename(tmp, PROGRESS);
    return all;
  });
  return progressQueue;
}

// Doc lai file moi lan goi de sua library.json / recipes la thay ngay, khong can restart server.
export async function getStudy(topicFile = 'education') {
  const [library, recipeFile, questions, progress] = await Promise.all([
    readJson(path.join(DIR, 'library.json')),
    readJson(path.join(DIR, `${topicFile}.recipes.json`)),
    getQuestions(),
    readProgress(),
  ]);
  const byId = new Map(questions.map((q) => [q.id, q]));
  const items = recipeFile.recipes.map((recipe) => {
    const q = byId.get(recipe.id);
    const essay = assemble(recipe, library, q.qtype);
    const { id, shape, cards, ...fills } = recipe;
    return {
      id: q.id, text: q.text, qtype: q.qtype, topic: q.topic, shape,
      cards: recipe.cards.map((c) => (typeof c === 'string' ? { id: c, act: recipe.act || '' } : { id: c[0], act: c[1] || recipe.act || '' })),
      fills,
      essay: { paragraphs: essay.paragraphs, segments: essay.segments, words: essay.words },
    };
  });
  return { topic: recipeFile.topic, library: { cards: library.cards, phraseBank: library.phraseBank }, items, progress };
}

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(__dirname, '..', '..', 'data', 'writing-task2', 'questions.json');

let cache = null;

export async function getQuestions() {
  if (!cache) {
    try {
      cache = JSON.parse(await fs.readFile(FILE, 'utf-8'));
    } catch (err) {
      if (err.code === 'ENOENT') {
        throw new Error('Chua co questions.json. Chay: node server/scripts/build-questions.js');
      }
      throw err;
    }
  }
  return cache;
}

export async function getQuestion(id) {
  const list = await getQuestions();
  return list.find((q) => q.id === id) || null;
}

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', '..', 'data', 'writing-fix', 'sessions');
const DEFAULT_TITLE = 'Cuoc tro chuyen moi';

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

function sessionFilePath(id) {
  return path.join(DATA_DIR, `${id}.json`);
}

function toSummary(session) {
  const lastMessage = session.messages[session.messages.length - 1];
  return {
    id: session.id,
    title: session.title,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    messageCount: session.messages.length,
    preview: lastMessage ? lastMessage.content.slice(0, 80) : '',
  };
}

function makeTitleFromText(text) {
  const clean = text.trim().replace(/\s+/g, ' ');
  return clean.length > 40 ? `${clean.slice(0, 40)}...` : clean || DEFAULT_TITLE;
}

export async function listSessions() {
  await ensureDataDir();
  const files = await fs.readdir(DATA_DIR);
  const jsonFiles = files.filter((f) => f.endsWith('.json'));

  const sessions = await Promise.all(
    jsonFiles.map(async (file) => {
      const raw = await fs.readFile(path.join(DATA_DIR, file), 'utf-8');
      return toSummary(JSON.parse(raw));
    })
  );

  return sessions.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

export async function getSession(id) {
  await ensureDataDir();
  try {
    const raw = await fs.readFile(sessionFilePath(id), 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

async function writeSession(session) {
  await ensureDataDir();
  await fs.writeFile(sessionFilePath(session.id), JSON.stringify(session, null, 2), 'utf-8');
}

export async function createSession() {
  const now = new Date().toISOString();
  const session = {
    id: crypto.randomUUID(),
    title: DEFAULT_TITLE,
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
  await writeSession(session);
  return session;
}

export async function renameSession(id, title) {
  const session = await getSession(id);
  if (!session) return null;
  session.title = title.trim().slice(0, 80) || DEFAULT_TITLE;
  session.updatedAt = new Date().toISOString();
  await writeSession(session);
  return session;
}

export async function deleteSession(id) {
  await ensureDataDir();
  try {
    await fs.unlink(sessionFilePath(id));
    return true;
  } catch (err) {
    if (err.code === 'ENOENT') return false;
    throw err;
  }
}

export async function appendExchange(id, userContent, assistantMessage) {
  const session = await getSession(id);
  if (!session) return null;

  const now = new Date().toISOString();
  const userMessage = {
    id: crypto.randomUUID(),
    role: 'user',
    content: userContent,
    createdAt: now,
  };

  session.messages.push(userMessage, assistantMessage);
  session.updatedAt = new Date().toISOString();
  if (session.messages.length === 2 && session.title === DEFAULT_TITLE) {
    session.title = makeTitleFromText(userContent);
  }

  await writeSession(session);
  return { session, userMessage };
}

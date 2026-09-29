import { Router } from 'express';
import crypto from 'node:crypto';
import {
  listSessions,
  getSession,
  createSession,
  renameSession,
  deleteSession,
  appendExchange,
} from './sessionStore.js';
import { generateReply } from './gemini.js';

const router = Router();

router.get('/sessions', async (_req, res, next) => {
  try {
    res.json(await listSessions());
  } catch (err) {
    next(err);
  }
});

router.post('/sessions', async (_req, res, next) => {
  try {
    res.status(201).json(await createSession());
  } catch (err) {
    next(err);
  }
});

router.get('/sessions/:id', async (req, res, next) => {
  try {
    const session = await getSession(req.params.id);
    if (!session) return res.status(404).json({ error: 'Khong tim thay session' });
    res.json(session);
  } catch (err) {
    next(err);
  }
});

router.patch('/sessions/:id', async (req, res, next) => {
  try {
    const { title } = req.body;
    if (typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'Thieu title hop le' });
    }
    const session = await renameSession(req.params.id, title);
    if (!session) return res.status(404).json({ error: 'Khong tim thay session' });
    res.json(session);
  } catch (err) {
    next(err);
  }
});

router.delete('/sessions/:id', async (req, res, next) => {
  try {
    const deleted = await deleteSession(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Khong tim thay session' });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

router.post('/sessions/:id/messages', async (req, res, next) => {
  try {
    const { content } = req.body;
    if (typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({ error: 'Noi dung tin nhan trong' });
    }

    const session = await getSession(req.params.id);
    if (!session) return res.status(404).json({ error: 'Khong tim thay session' });

    const historyForModel = [
      ...session.messages.slice(-20),
      { role: 'user', content: content.trim() },
    ];

    // Client bam "Dung" -> huy request: khong goi tiep Gemini, khong luu gi ca.
    const ctl = new AbortController();
    res.on('close', () => { if (!res.writableEnded) ctl.abort(); });
    const lang = req.body.lang === 'en' ? 'en' : 'vi';

    const replyText = await generateReply(historyForModel, { lang, signal: ctl.signal });
    if (ctl.signal.aborted) return;

    const assistantMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: replyText,
      createdAt: new Date().toISOString(),
    };

    const result = await appendExchange(req.params.id, content.trim(), assistantMessage);
    if (!result) return res.status(404).json({ error: 'Khong tim thay session' });

    res.json({
      userMessage: result.userMessage,
      assistantMessage,
      title: result.session.title,
    });
  } catch (err) {
    next(err);
  }
});

export default router;

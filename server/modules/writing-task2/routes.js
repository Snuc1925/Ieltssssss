import { Router } from 'express';
import { getQuestions, getQuestion } from './questionBank.js';
import { getEssay, listSummaries, saveDraft, appendGrading, deleteEssay, summarize, countWords } from './essayStore.js';
import { gradeEssay } from './grader.js';
import { getLibrary, setProgress, LIBRARY_TOPICS } from './library.js';

const router = Router();
const MAX_BODY_CHARS = 20000;

function parseId(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: 'Id de bai khong hop le' });
    return null;
  }
  return id;
}

async function requireQuestion(req, res) {
  const id = parseId(req, res);
  if (!id) return null;
  const question = await getQuestion(id);
  if (!question) {
    res.status(404).json({ error: 'Khong tim thay de bai' });
    return null;
  }
  return question;
}

router.get('/library/:topic(' + LIBRARY_TOPICS.join('|') + ')', async (req, res, next) => {
  try {
    res.json(await getLibrary(req.params.topic));
  } catch (err) {
    next(err);
  }
});

router.put('/library/progress/:id', async (req, res, next) => {
  try {
    const id = parseId(req, res);
    if (!id) return;
    const level = Number(req.body.level);
    if (![0, 1, 2].includes(level)) return res.status(400).json({ error: 'level phai la 0, 1 hoac 2' });
    await setProgress(id, level);
    res.json({ id, level });
  } catch (err) {
    next(err);
  }
});

router.get('/questions', async (_req, res, next) => {
  try {
    const [questions, summaries] = await Promise.all([getQuestions(), listSummaries()]);
    res.json(
      questions.map((q) => ({ ...q, ...(summaries[q.id] || summarize(null)) }))
    );
  } catch (err) {
    next(err);
  }
});

router.get('/questions/:id', async (req, res, next) => {
  try {
    const question = await requireQuestion(req, res);
    if (!question) return;
    const essay = await getEssay(question.id);
    res.json({
      question,
      essay: essay ? { body: essay.body, updatedAt: essay.updatedAt, gradings: essay.gradings } : null,
    });
  } catch (err) {
    next(err);
  }
});

router.put('/questions/:id/essay', async (req, res, next) => {
  try {
    const question = await requireQuestion(req, res);
    if (!question) return;
    const { body } = req.body;
    if (typeof body !== 'string' || body.length > MAX_BODY_CHARS) {
      return res.status(400).json({ error: 'Noi dung bai viet khong hop le hoac qua dai' });
    }
    const essay = await saveDraft(question.id, body);
    res.json({ savedAt: essay ? essay.updatedAt : null, summary: summarize(essay) });
  } catch (err) {
    next(err);
  }
});

router.post('/questions/:id/grade', async (req, res, next) => {
  try {
    const question = await requireQuestion(req, res);
    if (!question) return;
    const { body } = req.body;
    if (typeof body !== 'string' || body.length > MAX_BODY_CHARS) {
      return res.status(400).json({ error: 'Noi dung bai viet khong hop le hoac qua dai' });
    }
    if (countWords(body) < 20) {
      return res.status(400).json({ error: 'Bai viet qua ngan de cham (can it nhat 20 tu).' });
    }

    // Luu ban nhap truoc: neu goi AI loi thi bai viet van khong mat.
    await saveDraft(question.id, body);

    let result;
    try {
      result = await gradeEssay(question, body);
    } catch (err) {
      return res.status(502).json({ error: err.message || 'Khong cham duoc bai luc nay.' });
    }

    const { essay, grading } = await appendGrading(question.id, body, result);
    res.json({ grading, summary: summarize(essay) });
  } catch (err) {
    next(err);
  }
});

router.delete('/questions/:id/essay', async (req, res, next) => {
  try {
    const question = await requireQuestion(req, res);
    if (!question) return;
    await deleteEssay(question.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;

import { getClient, MODEL } from '../writing-fix/gemini.js';
import { countWords } from './essayStore.js';

const SYSTEM_INSTRUCTION = `Bạn là giám khảo IELTS Writing Task 2 giàu kinh nghiệm, chấm bài cho người Việt đang tự học.
Chấm theo đúng 4 tiêu chí chính thức của IELTS (thang 0-9, bước 0.5):
- taskResponse: Task Response (trả lời đúng đề, có lập trường rõ ràng, phát triển ý đầy đủ)
- coherenceCohesion: Coherence and Cohesion (bố cục, phân đoạn, liên kết)
- lexicalResource: Lexical Resource (từ vựng, collocation, chính tả)
- grammar: Grammatical Range and Accuracy (đa dạng cấu trúc câu, độ chính xác)

Nguyên tắc:
- Chấm nghiêm túc, sát chuẩn thật, KHÔNG "cho điểm cho vui". Bài dưới 250 từ bị trừ điểm Task Response và phải nói rõ điều này.
- Bài lạc đề hoặc không trả lời hết các phần của đề phải bị chấm thấp Task Response.
- Mọi nhận xét, giải thích viết bằng TIẾNG VIỆT CÓ DẤU đầy đủ (không viết không dấu). Trích dẫn, câu sửa lỗi và bài viết lại viết bằng TIẾNG ANH.
- Trường "original" phải là đoạn CÓ THẬT trong bài của người viết (giữ nguyên chính tả).

Chỉ trả về DUY NHẤT một JSON hợp lệ (không markdown, không giải thích ngoài JSON) đúng cấu trúc:
{
  "bands": { "taskResponse": number, "coherenceCohesion": number, "lexicalResource": number, "grammar": number },
  "feedback": { "taskResponse": string, "coherenceCohesion": string, "lexicalResource": string, "grammar": string },
  "summary": string,
  "strengths": [string],
  "weaknesses": [string],
  "corrections": [ { "original": string, "corrected": string, "explanation": string } ],
  "improvedVersion": string,
  "nextSteps": [string]
}
Trong đó:
- feedback.*: 2-3 câu nhận xét cho từng tiêu chí.
- summary: 2-3 câu tổng quan.
- strengths: 2-4 ý; weaknesses: 2-4 ý (cụ thể, không chung chung).
- corrections: 4-8 lỗi quan trọng nhất (ngữ pháp, từ vựng, collocation), mỗi lỗi 1 mục; explanation viết bằng tiếng Việt.
- improvedVersion: viết lại toàn bộ bài ở mức khoảng band 8, giữ ý tưởng của người viết, độ dài xấp xỉ bài gốc.
- nextSteps: 2-3 việc cụ thể nên làm để tăng band ở bài sau.`;

function roundHalf(n) {
  return Math.round(n * 2) / 2;
}

function clampBand(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return roundHalf(Math.min(9, Math.max(0, n)));
}

function str(v) {
  return typeof v === 'string' ? v.trim() : '';
}

function strList(v, max) {
  return Array.isArray(v) ? v.map(str).filter(Boolean).slice(0, max) : [];
}

function extractJson(text) {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
    throw new Error('Không đọc được kết quả chấm (JSON không hợp lệ). Hãy thử chấm lại.');
  }
}

// ---- Engine: Gemini mặc định, tự chuyển sang DeepSeek khi hết quota / quá tải ----
const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions';
const GEMINI_FALLBACK_RE = /429|quota|RESOURCE_EXHAUSTED|UNAVAILABLE|503|overloaded|GEMINI_API_KEY/i;
let geminiCooldownUntil = 0;

async function callGemini(prompt) {
  const ai = getClient();
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: { systemInstruction: SYSTEM_INSTRUCTION, responseMimeType: 'application/json', temperature: 0.3 },
  });
  if (!response.text) throw new Error('Gemini không trả về kết quả chấm. Vui lòng thử lại.');
  return response.text;
}

async function callDeepSeek(prompt) {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) throw new Error('Thiếu DEEPSEEK_API_KEY để dùng bộ chấm dự phòng.');
  const res = await fetch(DEEPSEEK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: process.env.DEEPSEEK_MODEL || 'deepseek-v4-pro',
      messages: [
        { role: 'system', content: SYSTEM_INSTRUCTION },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      stream: false,
    }),
  });
  if (!res.ok) throw new Error(`DeepSeek lỗi ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const text = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  if (!text) throw new Error('DeepSeek không trả về kết quả chấm. Vui lòng thử lại.');
  return text;
}

// GRADER_ENGINE = gemini | deepseek | auto (mặc định)
async function generate(prompt) {
  const mode = (process.env.GRADER_ENGINE || 'auto').toLowerCase();
  if (mode === 'deepseek') return { engine: 'deepseek', text: await callDeepSeek(prompt) };
  if (mode === 'gemini') return { engine: 'gemini', text: await callGemini(prompt) };
  if (Date.now() >= geminiCooldownUntil) {
    try {
      return { engine: 'gemini', text: await callGemini(prompt) };
    } catch (err) {
      if (!GEMINI_FALLBACK_RE.test(err.message)) throw err;
      geminiCooldownUntil = Date.now() + 10 * 60 * 1000;
    }
  }
  return { engine: 'deepseek', text: await callDeepSeek(prompt) };
}

async function gradeOnce(question, body) {
  const words = countWords(body);
  const prompt = `ĐỀ BÀI (${question.qtype}):\n${question.text}\n\nBÀI VIẾT CỦA HỌC VIÊN (${words} từ):\n${body}`;
  const { engine, text } = await generate(prompt);

  const raw = extractJson(text);
  const b = raw.bands || {};
  const bands = {
    taskResponse: clampBand(b.taskResponse),
    coherenceCohesion: clampBand(b.coherenceCohesion),
    lexicalResource: clampBand(b.lexicalResource),
    grammar: clampBand(b.grammar),
  };
  const values = Object.values(bands);
  if (values.some((v) => v === null)) throw new Error('Kết quả chấm thiếu điểm tiêu chí. Hãy thử chấm lại.');

  const f = raw.feedback || {};
  return {
    engine,
    overall: roundHalf(values.reduce((a, c) => a + c, 0) / values.length),
    bands,
    feedback: {
      taskResponse: str(f.taskResponse),
      coherenceCohesion: str(f.coherenceCohesion),
      lexicalResource: str(f.lexicalResource),
      grammar: str(f.grammar),
    },
    summary: str(raw.summary),
    strengths: strList(raw.strengths, 6),
    weaknesses: strList(raw.weaknesses, 6),
    corrections: (Array.isArray(raw.corrections) ? raw.corrections : [])
      .map((c) => ({ original: str(c && c.original), corrected: str(c && c.corrected), explanation: str(c && c.explanation) }))
      .filter((c) => c.original && c.corrected)
      .slice(0, 10),
    improvedVersion: str(raw.improvedVersion),
    nextSteps: strList(raw.nextSteps, 5),
  };
}

// Model đôi khi trả JSON hỏng -> thử lại tối đa 3 lần trước khi báo lỗi.
export async function gradeEssay(question, body) {
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await gradeOnce(question, body);
    } catch (err) {
      lastErr = err;
      if (!/JSON|json|thiếu điểm|không trả về/.test(err.message)) throw err;
    }
  }
  throw lastErr;
}

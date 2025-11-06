import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: '1mb' }));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const KB_PATH = path.join(__dirname, 'data', 'faq.json');

let knowledgeBase = [];

function loadKnowledgeBase() {
  try {
    const raw = fs.readFileSync(KB_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error('knowledge base must be an array');
    knowledgeBase = parsed.map((entry, idx) => ({
      id: idx,
      category: entry.category || '',
      question: entry.question || '',
      answer: entry.answer || '',
      url: entry.url || ''
    }));
    console.log(`Loaded ${knowledgeBase.length} FAQ items.`);
  } catch (error) {
    console.error('Failed to load FAQ knowledge base:', error.message);
    knowledgeBase = [];
  }
}

function tokenize(text) {
  return Array.from(new Set(String(text || '')
    .toLowerCase()
    .replace(/([。、，・！？・\-])/g, ' ')
    .split(/[^ぁ-んァ-ン一-龥a-z0-9]+/)
    .filter(Boolean)));
}

function rankByQuery(query, limit = 3) {
  const queryTokens = tokenize(query);
  if (!queryTokens.length) return [];
  const scored = knowledgeBase.map((item) => {
    const questionTokens = tokenize(item.question);
    const answerTokens = tokenize(item.answer);
    const tokens = new Set([...questionTokens, ...answerTokens]);
    const overlap = queryTokens.filter((token) => tokens.has(token));
    const score = overlap.length / Math.max(tokens.size, 1);
    return { ...item, score };
  });
  return scored
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.min(limit, scored.length));
}

async function generateWithGemini(message, matches, history = []) {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) return null;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;

  const contextBlock = matches.map((item, idx) => `# FAQソース${idx + 1}\nカテゴリ: ${item.category}\n質問: ${item.question}\n回答: ${item.answer}\nURL: ${item.url || '（未設定）'}`).join('\n\n');

  const systemInstruction = `あなたは早稲田アカデミーシンガポール校のFAQサポート担当です。` +
    ` 以下のFAQデータのみを根拠に日本語で丁寧に回答してください。` +
    ` 個人情報の入力を求めず、必要な場合は公式サイトやお問い合わせフォームの利用を促してください。`;

  const parts = [
    {
      role: 'user',
      parts: [
        {
          text: `${systemInstruction}\n\n` +
            `## 利用者からの質問\n${message}\n\n` +
            `## FAQデータ\n${contextBlock || '（該当データなし）'}\n\n` +
            `出力フォーマット:\n- 簡潔な回答\n- 必要に応じて参照URLを箇条書き\n- 個人情報入力が不要である旨を再確認`
        }
      ]
    }
  ];

  const payload = {
    contents: [
      ...history.map((turn) => ({
        role: turn.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: String(turn.content || '') }]
      })),
      ...parts
    ],
    generationConfig: {
      temperature: 0.4,
      topP: 0.95,
      maxOutputTokens: 512
    }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gemini API error: ${response.status} ${text}`);
  }
  const data = await response.json();
  const candidate = data?.candidates?.[0]?.content?.parts || [];
  const answer = candidate.map((part) => part.text || '').join('').trim();
  return answer || null;
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok', items: knowledgeBase.length });
});

app.post('/api/search', (req, res) => {
  const { query, limit } = req.body || {};
  if (!query || !String(query).trim()) {
    return res.status(400).json({ error: 'query is required' });
  }
  const matches = rankByQuery(String(query), Math.min(Number(limit) || 5, 10));
  res.json({ matches });
});

app.post('/api/chat', async (req, res) => {
  const { message, history } = req.body || {};
  if (!message || !String(message).trim()) {
    return res.status(400).json({ error: 'message is required' });
  }
  const sanitizedMessage = String(message).trim();
  const matches = rankByQuery(sanitizedMessage, 3);
  let answer = null;
  let usedModel = false;

  try {
    const generated = await generateWithGemini(sanitizedMessage, matches, Array.isArray(history) ? history : []);
    if (generated) {
      answer = generated;
      usedModel = true;
    }
  } catch (error) {
    console.error(error.message);
  }

  if (!answer) {
    if (matches.length) {
      const top = matches[0];
      answer = `AI連携は準備中です。参考になりそうなFAQをお知らせします。\n\n` +
        `質問: ${top.question}\n回答: ${top.answer}\n\n詳しくは公式サイトをご確認ください。`;
    } else {
      answer = 'FAQデータベースに該当する回答が見つかりませんでした。キーワードを変えてお試しください。';
    }
  }

  res.json({
    answer,
    references: matches.map(({ id, score, ...rest }) => rest),
    usedModel,
    reminder: '個人情報は入力しないでください。必要な場合は公式フォームをご利用ください。'
  });
});

loadKnowledgeBase();

fs.watch(KB_PATH, (event) => {
  if (event === 'change') {
    loadKnowledgeBase();
  }
});

const port = Number(process.env.PORT) || 8788;
app.listen(port, () => {
  console.log(`AI backend listening on http://localhost:${port}`);
});

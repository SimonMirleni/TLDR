import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { env } from '../env.js';

const openai = createOpenAI({ apiKey: env.OPENAI_API_KEY });
const MODEL = 'gpt-5.5';

// Rough char→token estimator. OpenAI's average is ~4 chars/token for English.
// We aim to stay under ~100K input tokens to leave headroom below the 128K context.
const MAX_INPUT_TOKENS = 100_000;
const CHARS_PER_TOKEN = 4;
const MAX_INPUT_CHARS = MAX_INPUT_TOKENS * CHARS_PER_TOKEN;

const BASE_SYSTEM = `Generate a single combined newsletter summarizing the following articles. Each article is delimited by '--- ARTICLE N (url: ...) ---'. Output an HTML body fragment using h2, h3, p, ul/li, a. Do NOT wrap in <html> or <body>. Use the article URL as the href for a heading link per article.`;

export type ArticleInput = { id: string; url: string; content: string };

export function buildPrompt(
  tonePrompt: string,
  articles: ArticleInput[],
): {
  system: string;
  user: string;
  truncated: boolean;
} {
  const system = `${BASE_SYSTEM}\n\nTone: ${tonePrompt.trim() || 'neutral, concise'}`;

  const headers = articles.map((a, i) => `--- ARTICLE ${i + 1} (url: ${a.url}) ---\n`);
  const overheadChars = system.length + headers.reduce((sum, h) => sum + h.length, 0);
  const budgetForContent = Math.max(0, MAX_INPUT_CHARS - overheadChars);

  const totalContentChars = articles.reduce((sum, a) => sum + a.content.length, 0);
  let truncated = false;

  let contents: string[];
  if (totalContentChars <= budgetForContent) {
    contents = articles.map((a) => a.content);
  } else {
    truncated = true;
    const ratio = budgetForContent / totalContentChars;
    contents = articles.map((a) => a.content.slice(0, Math.floor(a.content.length * ratio)));
  }

  const user = articles.map((_, i) => `${headers[i]}${contents[i]}`).join('\n\n');

  return { system, user, truncated };
}

export async function summarizeArticles(
  tonePrompt: string,
  articles: ArticleInput[],
  signal: AbortSignal,
): Promise<{ html: string; truncated: boolean }> {
  const { system, user, truncated } = buildPrompt(tonePrompt, articles);
  if (truncated) {
    console.warn(`[llm] truncated content (articles=${articles.length}) to fit context window`);
  }

  const { text } = await generateText({
    model: openai(MODEL),
    system,
    messages: [{ role: 'user', content: user }],
    abortSignal: signal,
  });

  return { html: text, truncated };
}

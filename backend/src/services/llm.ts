import { createOpenAI } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';
import { env } from '../env.js';

const openai = createOpenAI({ apiKey: env.OPENAI_API_KEY });
const MODEL = 'gpt-4o';

const MAX_INPUT_TOKENS = 100_000;
const CHARS_PER_TOKEN = 4;
const MAX_INPUT_CHARS = MAX_INPUT_TOKENS * CHARS_PER_TOKEN;

const BASE_SYSTEM = `You are a newsletter writer. Summarize the provided articles into a digest. For each article return:
- title: a clear, engaging title
- url: the original article URL (copy it exactly)
- summary: 2-3 sentences capturing the core idea
- keyPoints: 2-4 concise bullet points (no markdown, plain text)

Each article is delimited by '--- ARTICLE N (url: ...) ---'.`;

const DigestSchema = z.object({
  articles: z
    .array(
      z.object({
        title: z.string(),
        url: z.string(),
        summary: z.string(),
        keyPoints: z.array(z.string()).min(1).max(4),
      }),
    )
    .min(1),
});

export type DigestOutput = z.infer<typeof DigestSchema>;

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
): Promise<{ digest: DigestOutput; truncated: boolean }> {
  const { system, user, truncated } = buildPrompt(tonePrompt, articles);
  if (truncated) {
    console.warn(`[llm] truncated content (articles=${articles.length}) to fit context window`);
  }

  const { object } = await generateObject({
    model: openai(MODEL),
    schema: DigestSchema,
    system,
    messages: [{ role: 'user', content: user }],
    abortSignal: signal,
  });

  return { digest: object, truncated };
}

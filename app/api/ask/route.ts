import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { readCache } from "@/lib/cache/store";
import { truncateWords } from "@/lib/utils/text";
import type { EditorialArticle, PredictionMarket } from "@/types";

const SOURCE_LABELS: Record<string, string> = {
  guardian: "The Guardian",
  lemonde: "Le Monde",
  aljazeera: "Al Jazeera",
};

async function askLLM(
  question: string,
  articles: EditorialArticle[],
  markets: PredictionMarket[]
): Promise<{ answer: string; sources: string[] }> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return askFallback(question, articles, markets);

  const client = new Anthropic({ apiKey: key });

  // Build numbered article context (up to 80 articles)
  const articleContext = articles
    .slice(0, 80)
    .map((a, i) => {
      const src = SOURCE_LABELS[a.source] ?? a.source;
      const summary = a.summary ? ` — ${truncateWords(a.summary, 45)}` : "";
      return `[${i + 1}] ${src}: ${a.title}${summary}`;
    })
    .join("\n");

  // Top markets by volume
  const marketContext = [...markets]
    .sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0))
    .slice(0, 25)
    .map((m) => `• ${m.title} — ${m.probabilityYes ?? "?"}% yes ($${((m.volume ?? 0) / 1_000).toFixed(0)}k vol)`)
    .join("\n");

  const system = `\
You are an executive intelligence assistant for The Execs Brief™ — a premium morning briefing for C-suite leaders. \
You have full access to today's news articles and prediction market data. \
Answer questions directly, analytically, and concisely. \
Reference specific sources where helpful. No padding, no preamble. \
End every response with a line formatted exactly as: SOURCES:[n,n,n] listing up to 3 article numbers you drew from most directly (omit if none apply).`;

  const userMessage = `TODAY'S ARTICLES:\n${articleContext}\n\nPREDICTION MARKETS:\n${marketContext}\n\nQUESTION: ${question}`;

  try {
    const resp = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      system,
      messages: [{ role: "user", content: userMessage }],
    });

    const raw = resp.content[0].type === "text" ? resp.content[0].text.trim() : "";

    // Parse out SOURCES:[n,n,n] line
    const sourceMatch = raw.match(/SOURCES:\[([^\]]*)\]\s*$/m);
    const answerText = raw.replace(/\nSOURCES:\[[^\]]*\]\s*$/m, "").trim();

    const sourceUrls: string[] = [];
    if (sourceMatch) {
      const indices = sourceMatch[1]
        .split(",")
        .map((s) => parseInt(s.trim(), 10) - 1)
        .filter((i) => i >= 0 && i < articles.length);
      for (const idx of indices) {
        sourceUrls.push(articles[idx].url);
      }
    }

    return { answer: answerText, sources: sourceUrls };
  } catch (err) {
    console.error("[ask] LLM error:", err);
    return askFallback(question, articles, markets);
  }
}

// Deterministic fallback when no API key
function askFallback(
  question: string,
  articles: EditorialArticle[],
  markets: PredictionMarket[]
): { answer: string; sources: string[] } {
  const q = question.toLowerCase();
  const words = q.split(/\s+/).filter((w) => w.length > 3);

  if (q.includes("market") || q.includes("polymarket") || q.includes("predict")) {
    const top = [...markets].sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0)).slice(0, 5);
    const lines = top.map((m) => `• ${truncateWords(m.title, 14)} — ${m.probabilityYes ?? "?"}% yes ($${((m.volume ?? 0) / 1_000).toFixed(0)}k vol)`);
    return { answer: `Top prediction markets by volume:\n\n${lines.join("\n")}`, sources: top.map((m) => m.url) };
  }

  const relevant = articles
    .filter((a) => words.some((w) => a.title.toLowerCase().includes(w) || (a.summary ?? "").toLowerCase().includes(w)))
    .slice(0, 5);

  if (relevant.length === 0) {
    return { answer: "I couldn't find specific articles matching your question. Try refreshing the brief first.", sources: [] };
  }

  const lines = relevant.map((a) => `• ${SOURCE_LABELS[a.source] ?? a.source}: ${truncateWords(a.title, 18)}`);
  return { answer: `Here's what I found:\n\n${lines.join("\n")}`, sources: relevant.map((a) => a.url) };
}

export async function POST(req: NextRequest) {
  try {
    const { question } = await req.json();
    if (!question || typeof question !== "string") {
      return NextResponse.json({ error: "question required" }, { status: 400 });
    }

    const cache = readCache();
    const articles = cache?.articles ?? [];
    const markets = cache?.markets ?? [];

    const { answer, sources } = await askLLM(question, articles, markets);
    return NextResponse.json({ answer, sources });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

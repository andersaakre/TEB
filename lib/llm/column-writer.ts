// ============================================================
// LLM Brief Writer
// Generates narrative news anchor-style synthesis
// using the Anthropic API.
//
// Requires ANTHROPIC_API_KEY in .env.local
// Falls back gracefully if key is missing.
// ============================================================

import Anthropic from "@anthropic-ai/sdk";
import type { PredictionMarket, Topic } from "@/types";
import type { HotTopicCandidate } from "@/lib/topics/hot-topics";
import { truncateWords } from "@/lib/utils/text";

function getClient(): Anthropic | null {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  return new Anthropic({ apiKey: key });
}

async function callClaude(
  client: Anthropic,
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number
): Promise<string> {
  const resp = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });
  const block = resp.content[0];
  const text = block.type === "text" ? block.text.trim() : "";
  // If truncated mid-sentence, trim to last complete sentence
  if (resp.stop_reason === "max_tokens") {
    const lastPeriod = Math.max(text.lastIndexOf("."), text.lastIndexOf("?"), text.lastIndexOf("!"));
    return lastPeriod > 0 ? text.slice(0, lastPeriod + 1) : text;
  }
  return text;
}

const ANCHOR_SYSTEM = `\
You are a senior broadcast journalist writing the script for a premium morning news programme — \
think BBC World Service meets Bloomberg Surveillance. Your voice is authoritative but warm, \
confident without being alarmist. You write in flowing, connected prose: each sentence builds \
on the last, guiding the reader through the story with momentum and clarity. You never use \
bullet points or lists. You treat the reader as intelligent and time-pressed. Your tone is \
engaged and direct — you care about the story, and it shows. You connect dots across events, \
name the stakes clearly, and end each section with a forward-looking observation that tells \
the reader what to watch next. \
IMPORTANT: Always write in English only, regardless of the language of the source material provided.`;

// ── Per-topic synthesis paragraph ─────────────────────────────

export interface StoryInput {
  headline: string;
  summary?: string;
  sources: string[];
}

export async function generateTopicSynthesis(
  topic: Topic,
  stories: StoryInput[]
): Promise<string> {
  if (stories.length === 0) return "";
  const client = getClient();
  if (!client) return "";

  const storiesText = stories
    .slice(0, 6)
    .map(
      (s) =>
        `• ${s.headline}${s.summary ? ` — ${truncateWords(s.summary, 30)}` : ""} [${s.sources.join(", ")}]`
    )
    .join("\n");

  const prompt = `\
Write 2–3 sentences (70–100 words) synthesising today's ${topic.displayName} developments \
into a single coherent narrative for a C-suite executive morning briefing.

Source material (${stories.length} stories):
${storiesText}

Rules:
— Weave the stories together: show how they connect, reinforce, or tension each other — \
don't summarise them one by one.
— Name at least two distinct developments and the thread linking them.
— Close with what to watch next that cuts across the stories.
— Write only the paragraph. No headline, no label, no sign-off.`;

  try {
    return await callClaude(client, ANCHOR_SYSTEM, prompt, 180);
  } catch (err) {
    console.error("[brief-writer] synthesis error:", err);
    return "";
  }
}

// ── Why It Matters — concise analytical statement ─────────────

export async function generateWhyItMatters(
  topic: Topic,
  stories: StoryInput[],
  markets: PredictionMarket[],
  industry = "business"
): Promise<string | null> {
  if (stories.length === 0 && markets.length === 0) return null;
  const client = getClient();
  if (!client) return null;

  const storiesText = stories
    .slice(0, 4)
    .map((s) => `• ${s.headline}`)
    .join("\n");

  const marketsText = markets
    .slice(0, 2)
    .map(
      (m) =>
        `• ${m.title}${m.probabilityYes !== undefined ? ` (${m.probabilityYes}% yes)` : ""}`
    )
    .join("\n");

  const prompt = `\
In exactly one sentence, state why today's ${topic.displayName} developments matter \
specifically to a C-level executive at a ${industry} company. \
Focus on the concrete downstream effects on ${industry}: think pricing power, input costs, \
consumer demand, regulatory exposure, competitive dynamics, or supply chain — \
whichever is most directly implicated by these stories.

Format: "${topic.displayName}: [${industry}-specific consequence 1], [consequence 2] and [consequence 3]."

Today's stories:
${storiesText}
${marketsText ? `\nMarket signals:\n${marketsText}` : ""}

Write only the single sentence in English. No preamble, no quotation marks around it.`;

  try {
    return await callClaude(client, "", prompt, 130);
  } catch (err) {
    console.error("[brief-writer] whyItMatters error:", err);
    return null;
  }
}

// ── Executive summary — broadcast opener ──────────────────────

export async function generateExecutiveSummary(
  activeTopics: string[],
  topHeadlines: string[]
): Promise<string> {
  const client = getClient();
  if (!client) return "";

  const prompt = `\
Write a 2–3 sentence opening for a C-suite morning news briefing — the kind a \
seasoned anchor delivers at the top of the programme to set the agenda.

Topics in today's brief: ${activeTopics.join(", ")}.
Leading stories: ${topHeadlines.slice(0, 4).join("; ")}.

Rules:
— Lead with the single most consequential story and its stakes.
— Connect it briefly to the broader picture across today's topics.
— End with a line that signals momentum — something is moving, and the reader needs to know.
— Authoritative, warm, and direct. No fluff, no clichés, no "Good morning".
— Write only the paragraph. No headline, no sign-off.`;

  try {
    return await callClaude(client, ANCHOR_SYSTEM, prompt, 200);
  } catch (err) {
    console.error("[brief-writer] executiveSummary error:", err);
    return "";
  }
}

// ── Hot topic reason generator ────────────────────────────────

/**
 * Given a list of deduplicated hot topic candidates, returns a map of
 * label → engaging one-liner reason for each.
 *
 * The LLM writes a sharp executive-facing sentence for each topic that
 * explains *why* it is trending today — not just that it is.
 */
export async function generateHotTopicReasons(
  candidates: HotTopicCandidate[]
): Promise<Map<string, string> | null> {
  if (candidates.length === 0) return null;
  const client = getClient();
  if (!client) return null;

  const candidateText = candidates
    .slice(0, 12)
    .map((c, i) => {
      const headlines = c.sampleHeadlines.slice(0, 2).join(" / ");
      return `${i + 1}. ${c.label} (${c.articleCount} articles, ${c.sources.join(" + ")}) — ${headlines}`;
    })
    .join("\n");

  const prompt = `\
You are an editorial intelligence analyst writing for a C-suite morning briefing.

Here are today's trending topics not yet in the user's watchlist:
${candidateText}

For each topic, write ONE sharp sentence (max 18 words) that tells a busy executive WHY this is moving today — name the concrete development, not just that it's being covered.

Rules:
— Be specific: name what happened, not that coverage exists.
— No "is trending", "is being covered", "multiple sources" phrases.
— Start with the topic name followed by a colon, e.g. "France: ..."
— Write only the sentences in English, one per line, in the same numbered order.`;

  try {
    const raw = await callClaude(client, "", prompt, 400);
    const result = new Map<string, string>();
    const lines = raw.split("\n").map(l => l.trim()).filter(Boolean);
    for (let i = 0; i < candidates.length && i < lines.length; i++) {
      // Strip leading "1. " numbering if present
      const line = lines[i].replace(/^\d+\.\s*/, "");
      // Strip the "Label: " prefix to get just the reason
      const colonIdx = line.indexOf(":");
      const reason = colonIdx > 0 ? line.slice(colonIdx + 1).trim() : line;
      if (reason) result.set(candidates[i].label, reason);
    }
    return result.size > 0 ? result : null;
  } catch (err) {
    console.error("[brief-writer] hotTopicReasons error:", err);
    return null;
  }
}

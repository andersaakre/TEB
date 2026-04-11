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
    model: "claude-sonnet-4-5-20250929",
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

function anchorSystem(language = "English") {
  return `You are a senior broadcast journalist writing the script for a premium morning news programme — \
think BBC World Service meets Bloomberg Surveillance. Your voice is authoritative but warm, \
confident without being alarmist. You write in flowing, connected prose: each sentence builds \
on the last, guiding the reader through the story with momentum and clarity. You never use \
bullet points or lists. You treat the reader as intelligent and time-pressed. Your tone is \
engaged and direct — you care about the story, and it shows. You connect dots across events, \
name the stakes clearly, and end each section with a forward-looking observation that tells \
the reader what to watch next. \
IMPORTANT: Always write in ${language} only, regardless of the language of the source material provided.`;
}

// ── Per-topic synthesis paragraph ─────────────────────────────

export interface StoryInput {
  headline: string;
  summary?: string;
  sources: string[];
}

export async function generateTopicSynthesis(
  topic: Topic,
  stories: StoryInput[],
  language = "English"
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
    return await callClaude(client, anchorSystem(language), prompt, 280);
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
  industry = "business",
  language = "English"
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

Write only the single sentence in ${language}. No preamble, no quotation marks around it.`;

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
  topHeadlines: string[],
  language = "English"
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
    return await callClaude(client, anchorSystem(language), prompt, 300);
  } catch (err) {
    console.error("[brief-writer] executiveSummary error:", err);
    return "";
  }
}

// ── Outside focus synthesis ───────────────────────────────────

/**
 * Writes a synthesis paragraph + why-it-matters for the "Outside your usual
 * focus" section, weaving the selected hot topics into a single narrative.
 */
export async function generateOutsideFocusSynthesis(
  topics: Array<{ label: string; reason: string }>,
  industry = "business",
  language = "English"
): Promise<{ synthesis: string; whyItMatters: string | null }> {
  const client = getClient();
  if (!client || topics.length === 0) return { synthesis: "", whyItMatters: null };

  const topicLines = topics
    .slice(0, 5)
    .map((t) => `• ${t.label}: ${t.reason}`)
    .join("\n");

  const synthesisPrompt = `\
Write 2–3 sentences (70–100 words) synthesising the following emerging stories into a single coherent narrative for a C-suite executive morning briefing.

Stories:
${topicLines}

Rules:
— Weave the stories together: show how they connect, reinforce, or tension each other — don't summarise them one by one.
— Name at least two distinct developments and the thread linking them.
— Close with what to watch next that cuts across the stories.
— Write only the paragraph. No headline, no label, no sign-off. Write in ${language} only.`;

  const whyPrompt = `\
In exactly one sentence, state the collective significance of these emerging stories for a C-level executive at a ${industry} company.

Stories:
${topicLines}

Format: "Outside your usual focus: [${industry}-specific consequence or risk]."
Write only the single sentence in ${language}. No preamble.`;

  try {
    const [synthesis, whyItMatters] = await Promise.all([
      callClaude(client, anchorSystem(language), synthesisPrompt, 280),
      callClaude(client, "", whyPrompt, 80),
    ]);
    return { synthesis, whyItMatters: whyItMatters || null };
  } catch (err) {
    console.error("[brief-writer] outsideFocusSynthesis error:", err);
    return { synthesis: "", whyItMatters: null };
  }
}

// ── Hot topic reason generator ────────────────────────────────

/**
 * Given a list of hot topic candidates, filters to those relevant to the
 * user's industry, enforces MECE (drops overlapping topics), and returns
 * an ordered array of { label, reason } pairs — ordered by industry relevance.
 *
 * Returns null on failure (caller should fall back to deterministic reasons).
 */
export async function generateHotTopicReasons(
  candidates: HotTopicCandidate[],
  industry = "business",
  language = "English"
): Promise<Array<{ label: string; reason: string }> | null> {
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
You are an editorial intelligence analyst curating a morning briefing for a C-suite executive at a ${industry} company.

Here are today's trending topics not yet in the executive's watchlist:
${candidateText}

Your job:
1. Select ONLY the topics with meaningful downstream relevance to ${industry} — skip anything with no clear connection to the industry (pricing, costs, demand, regulation, competition, supply chain, consumer behaviour, or talent).
2. Ensure the selected set is MECE: if two topics clearly overlap or describe the same underlying story, keep only the more specific or higher-coverage one.
3. For each selected topic, write ONE sharp sentence (max 18 words) explaining why it matters specifically to a ${industry} executive — name the concrete development and its business consequence.

Output format — one line per selected topic, in descending order of relevance to ${industry}:
N. Label: [reason]

Where N is the original number from the list above, and Label is the topic name written in ${language} using its standard official name in that language (e.g. if the language is English and the topic is "Etats Unis", write "United States"). Output ONLY selected topics. Write everything in ${language} only. No preamble.`;

  try {
    const raw = await callClaude(client, "", prompt, 450);
    const result: Array<{ label: string; reason: string }> = [];
    for (const line of raw.split("\n").map(l => l.trim()).filter(Boolean)) {
      const numMatch = line.match(/^(\d+)\.\s*/);
      if (!numMatch) continue;
      const idx = parseInt(numMatch[1], 10) - 1;
      if (idx < 0 || idx >= candidates.length) continue;
      const rest = line.slice(numMatch[0].length);
      const colonIdx = rest.indexOf(":");
      // Use the LLM's label (translated to user language) if present, else fall back to raw candidate label
      const llmLabel = colonIdx > 0 ? rest.slice(0, colonIdx).trim() : "";
      const reason = colonIdx > 0 ? rest.slice(colonIdx + 1).trim() : rest.trim();
      if (reason) result.push({ label: llmLabel || candidates[idx].label, reason });
    }
    return result.length > 0 ? result : null;
  } catch (err) {
    console.error("[brief-writer] hotTopicReasons error:", err);
    return null;
  }
}

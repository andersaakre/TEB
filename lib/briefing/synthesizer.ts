// ============================================================
// Morning Brief synthesizer
//
// TODO: synthesis functions are marked for LLM upgrade.
// Hook points:
//   buildSynthesisParagraph()  → llm.summarize(stories, topic)
//   buildWhyItMatters()        → llm.analyze(stories, markets, topic)
// ============================================================

import type {
  ClusteredStory,
  PredictionMarket,
  Topic,
  MorningBrief,
  BriefSection,
  BriefStory,
} from "@/types";
import { matchTopics } from "@/lib/topics/matcher";
import { truncateWords } from "@/lib/utils/text";
import {
  generateTopicSynthesis,
  generateWhyItMatters,
  generateExecutiveSummary,
  type StoryInput,
} from "@/lib/llm/column-writer";

const SOURCE_LABELS: Record<string, string> = {
  guardian: "The Guardian",
  lemonde: "Le Monde",
  aljazeera: "Al Jazeera",
  polymarket: "Polymarket",
};

// ── Minimum relevance thresholds ──────────────────────────────
// A cluster or market must score above these to appear in a topic section.
// Prevents weak keyword matches from polluting sections.
const MIN_CLUSTER_SCORE = 0.15; // requires ~2+ matching keywords for a typical topic
const MIN_MARKET_SCORE  = 0.25; // requires ~2 genuine keyword matches to pass

// ── Per-topic relevance scorer ────────────────────────────────

/**
 * Re-score a cluster against a specific topic using its headline + article summaries.
 * More accurate than the pre-computed average score because it checks the full
 * representative headline directly against the topic.
 */
function scoreClusterForTopic(cluster: ClusteredStory, topic: Topic): number {
  const primary = cluster.articles[0];
  const matches = matchTopics(
    {
      title: cluster.representativeHeadline,
      summary: primary?.summary,
      section: primary?.section,
      extractedKeywords: cluster.articles.flatMap((a) => a.extractedKeywords).slice(0, 20),
    },
    [{ ...topic, active: true }]
  );
  return matches[0]?.score ?? 0;
}

/**
 * Re-score a market against a specific topic.
 */
function scoreMarketForTopic(market: PredictionMarket, topic: Topic): number {
  const matches = matchTopics(
    {
      title: market.title,
      summary: market.eventTitle,
      section: market.category,
      extractedKeywords: market.extractedKeywords,
    },
    [{ ...topic, active: true }]
  );
  return matches[0]?.score ?? 0;
}

// ── Synthesis paragraph builder ───────────────────────────────

/**
 * Build a single readable narrative paragraph from the top clusters for a topic.
 *
 * TODO: Replace this deterministic combiner with an LLM call for production quality.
 * Example:
 *   const paragraph = await llm.synthesize({
 *     topic: topic.displayName,
 *     stories: clusters.map(c => ({ headline: c.representativeHeadline, summary: c.articles[0]?.summary }))
 *   });
 */
function buildSynthesisParagraph(
  clusters: ClusteredStory[],
  topic: Topic
): string {
  if (clusters.length === 0) return "";

  const sentences: string[] = [];
  const usedSources = new Set<string>();

  for (const cluster of clusters.slice(0, 4)) {
    const primary = cluster.articles[0];
    const text = primary?.summary
      ? truncateWords(primary.summary, 40)
      : truncateWords(cluster.representativeHeadline, 30);

    // Note multi-source agreement
    if (cluster.sources.length > 1 && !usedSources.has("multi")) {
      const srcNames = cluster.sources.map((s) => SOURCE_LABELS[s] ?? s);
      sentences.push(
        `${srcNames.slice(0, 2).join(" and ")} both report: ${text}`
      );
      usedSources.add("multi");
    } else {
      const srcLabel = SOURCE_LABELS[primary?.source ?? ""] ?? "";
      sentences.push(`${srcLabel ? `${srcLabel}: ` : ""}${text}`);
    }
    primary?.source && usedSources.add(primary.source);
  }

  // Add a divergence note if framing differs
  const divergentCluster = clusters.find(
    (c) => c.sources.length > 1 && c.framing?.differences
  );
  if (divergentCluster?.framing?.differences) {
    sentences.push(divergentCluster.framing.differences);
  }

  return sentences.join(" ");
}

// ── Why It Matters builder ────────────────────────────────────

/**
 * Build a "Why it matters" sentence with meaningful executive-level context.
 *
 * TODO: Replace with an LLM call that generates true contextual insight.
 * Example:
 *   const why = await llm.explain({
 *     topic: topic.displayName,
 *     stories,
 *     markets,
 *     audience: "C-level executive"
 *   });
 */
function buildWhyItMatters(
  topic: Topic,
  clusters: ClusteredStory[],
  markets: PredictionMarket[]
): string | null {
  if (clusters.length === 0 && markets.length === 0) return null;

  const parts: string[] = [];

  // Cross-source coverage is a signal of importance
  const sourceSet = new Set(clusters.flatMap((c) => c.sources));
  if (sourceSet.size >= 3) {
    parts.push(`All three tracked sources are covering this`);
  } else if (sourceSet.size === 2) {
    const names = [...sourceSet].map((s) => SOURCE_LABELS[s] ?? s);
    parts.push(`${names.join(" and ")} are both tracking this`);
  }

  // High-volume markets signal collective attention
  const highVolMarkets = markets.filter((m) => (m.volume ?? 0) > 500_000);
  if (highVolMarkets.length > 0) {
    const totalVol = highVolMarkets.reduce((s, m) => s + (m.volume ?? 0), 0);
    const volLabel =
      totalVol >= 1_000_000
        ? `$${(totalVol / 1_000_000).toFixed(1)}M`
        : `$${(totalVol / 1_000).toFixed(0)}k`;
    parts.push(`${volLabel} in prediction market volume signals significant collective attention`);
  } else if (markets.length > 0) {
    parts.push(`${markets.length} prediction market${markets.length > 1 ? "s" : ""} active`);
  }

  // Breaking / very recent stories
  const breakingCount = clusters.filter((c) => {
    const age = Date.now() - new Date(c.publishedAt).getTime();
    return age < 3 * 60 * 60 * 1000; // within 3 hours
  }).length;
  if (breakingCount > 0) {
    parts.push(`${breakingCount} development${breakingCount > 1 ? "s" : ""} published in the last 3 hours`);
  }

  // Volume of coverage signals pace of events
  if (clusters.length >= 5) {
    parts.push(`${clusters.length} stories suggest a rapidly developing situation`);
  }

  if (parts.length === 0) return null;

  return parts.join(". ") + ".";
}

// ── Section builders ──────────────────────────────────────────

function buildStories(clusters: ClusteredStory[]): BriefStory[] {
  return clusters.map((c) => {
    const primary = c.articles[0];
    return {
      title: c.representativeHeadline,
      summary: primary?.summary ?? undefined,
      url: primary?.url ?? "#",
      source: primary?.source ?? "guardian",
      publishedAt: c.publishedAt,
      multiSource: c.sources.length > 1,
      sourceCount: c.sources.length,
    };
  });
}

async function buildTopicSection(
  topic: Topic,
  clusters: ClusteredStory[],
  markets: PredictionMarket[],
  industry = "business"
): Promise<BriefSection> {
  // Re-score every cluster against this specific topic and apply a hard threshold.
  const topicClusters = clusters
    .map((c) => ({ cluster: c, score: scoreClusterForTopic(c, topic) }))
    .filter(({ score }) => score >= MIN_CLUSTER_SCORE)
    .sort((a, b) => b.score - a.score || new Date(b.cluster.publishedAt).getTime() - new Date(a.cluster.publishedAt).getTime())
    .slice(0, 6)
    .map(({ cluster }) => cluster);

  // Re-score markets against this specific topic with a stricter threshold.
  // Then deduplicate by eventTitle so similar markets (e.g. multiple "AI model ranking"
  // questions from the same event) don't all appear — only highest volume per event.
  const scoredMarkets = markets
    .map((m) => ({ market: m, score: scoreMarketForTopic(m, topic) }))
    .filter(({ score }) => score >= MIN_MARKET_SCORE)
    .sort((a, b) => (b.market.volume ?? 0) - (a.market.volume ?? 0));

  // Deduplicate: no two markets with >50% word overlap in their titles
  const STOP = new Set([
    // articles, conjunctions, prepositions
    "will","the","a","an","at","by","of","in","on","to","for","end","be","have","has","or","and","is","its","per",
    // ordinals / superlatives
    "best","worst","first","second","third","fourth","fifth","top","most","least","higher","lower","above","below",
    // months / years
    "january","february","march","april","may","june","july","august","september","october","november","december",
    "2023","2024","2025","2026","2027","2028",
    // common market verbs/nouns that appear everywhere and carry no discriminating value
    "win","winner","wins","out","get","make","become","reach","hit","lose","cut","raise","drop","increase","decrease",
    "announces","announce","conduct","conducts","support","supports","action","conflict","ends","end","against",
    "before","after","more","than","over","under","between","within",
  ]);
  function titleWords(t: string) {
    return new Set(t.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(w => w.length > 2 && !STOP.has(w)));
  }
  function tooSimilar(a: string, b: string) {
    const wa = titleWords(a), wb = titleWords(b);
    const intersection = [...wa].filter(w => wb.has(w)).length;
    const union = new Set([...wa, ...wb]).size;
    return union > 0 && intersection / union > 0.18;
  }

  const seenEvents = new Set<string>();
  const selectedTitles: string[] = [];
  const topicMarkets = scoredMarkets
    .filter(({ market }) => {
      const eventKey = market.eventTitle?.trim().toLowerCase() || market.id;
      if (seenEvents.has(eventKey)) return false;
      if (selectedTitles.some(t => tooSimilar(t, market.title))) return false;
      seenEvents.add(eventKey);
      selectedTitles.push(market.title);
      return true;
    })
    .slice(0, 3)
    .map(({ market }) => market);

  const stories = buildStories(topicClusters);

  // Plain-text bullets for TTS
  const bullets = topicClusters.map((c) => {
    const primary = c.articles[0];
    const text = primary?.summary
      ? truncateWords(primary.summary, 30)
      : truncateWords(c.representativeHeadline, 25);
    const srcLabel = c.sources.length > 1
      ? c.sources.map((s) => SOURCE_LABELS[s] ?? s).join(", ")
      : SOURCE_LABELS[primary?.source ?? ""] ?? primary?.source ?? "";
    return `${text} [${srcLabel}]`;
  });

  // Build story inputs for LLM
  const storyInputs: StoryInput[] = topicClusters.map((c) => ({
    headline: c.representativeHeadline,
    summary: c.articles[0]?.summary,
    sources: c.sources.map((s) => SOURCE_LABELS[s] ?? s),
  }));

  // LLM synthesis — falls back to deterministic if key missing / API error
  const [llmSynthesis, llmWhyItMatters] = await Promise.all([
    generateTopicSynthesis(topic, storyInputs),
    generateWhyItMatters(topic, storyInputs, topicMarkets, industry),
  ]);

  const synthesis = llmSynthesis || buildSynthesisParagraph(topicClusters, topic);
  const whyItMatters = llmWhyItMatters ?? buildWhyItMatters(topic, topicClusters, topicMarkets);

  const content =
    topicClusters.length === 0
      ? `No major ${topic.displayName} developments in the current briefing cycle.`
      : "";

  return {
    id: `topic-${topic.id}`,
    title: topic.displayName,
    content,
    synthesis: synthesis || undefined,
    bullets,
    stories,
    whyItMatters: whyItMatters ?? undefined,
    topicId: topic.id,
    sources: [...new Set(topicClusters.flatMap((c) => c.sources))],
    markets: topicMarkets,
  };
}

// ── Brief-level helpers ───────────────────────────────────────

async function buildExecutiveSummary(clusters: ClusteredStory[], topics: Topic[]): Promise<string> {
  const activeTopics = topics.filter((t) => t.active).map((t) => t.displayName);
  const topHeadlines = clusters.slice(0, 5).map((c) => c.representativeHeadline);

  const llm = await generateExecutiveSummary(activeTopics, topHeadlines);
  if (llm) return llm;

  // Deterministic fallback
  const storyLines = clusters.slice(0, 3).map((c) => truncateWords(c.representativeHeadline, 15)).join("; ");
  const topicLine = activeTopics.length > 0
    ? ` Monitoring ${activeTopics.length} topics: ${activeTopics.join(", ")}.`
    : "";
  return `Good morning. Here are the most significant developments across your tracked topics. ${storyLines}.${topicLine}`;
}

function buildDivergenceSection(clusters: ClusteredStory[], markets: PredictionMarket[]): string[] {
  const signals: string[] = [];
  for (const c of clusters) {
    if (c.sources.length > 1 && c.framing?.differences) {
      signals.push(`"${truncateWords(c.representativeHeadline, 10)}": ${c.framing.differences}`);
    }
  }
  for (const m of markets) {
    if ((m.probabilityYes ?? 0) > 75 || (m.probabilityNo ?? 0) > 75) {
      const covered = clusters.filter((c) =>
        c.matchedTopics.some((t) => m.matchedTopics.includes(t))
      );
      if (covered.length < 2) {
        signals.push(
          `Polymarket prices ${m.probabilityYes ?? 100 - (m.probabilityNo ?? 0)}% on "${truncateWords(m.title, 10)}" — limited editorial corroboration.`
        );
      }
    }
  }
  return signals.slice(0, 5);
}

function buildWatchlist(clusters: ClusteredStory[], markets: PredictionMarket[], topics: Topic[]): string[] {
  const items: string[] = [];
  for (const c of clusters.filter((c) => c.articles.length >= 3).slice(0, 3)) {
    items.push(`${c.sources.length} sources on: "${truncateWords(c.representativeHeadline, 12)}"`);
  }
  for (const m of markets.filter((m) => (m.volume ?? 0) > 100_000).sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0)).slice(0, 3)) {
    const vol = m.volume ? `$${(m.volume / 1_000).toFixed(0)}k vol` : "";
    items.push(`Market: "${truncateWords(m.title, 10)}" — ${vol}`);
  }
  for (const t of topics.filter((t) => t.active && !clusters.some((c) => c.matchedTopics.includes(t.id))).slice(0, 2)) {
    items.push(`No coverage found for: ${t.displayName}`);
  }
  return items.slice(0, 6);
}

// ── Main synthesizer ──────────────────────────────────────────

export async function synthesizeBrief(
  clusters: ClusteredStory[],
  markets: PredictionMarket[],
  topics: Topic[],
  sourceErrors: string[],
  industry = "business"
): Promise<MorningBrief> {
  const activeTopics = topics.filter((t) => t.active);

  const sortedClusters = [...clusters].sort(
    (a, b) =>
      b.relevanceScore - a.relevanceScore ||
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
  const sortedMarkets = [...markets].sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0));

  // Run all LLM calls in parallel across topics + executive summary
  const [executiveSummary, ...topicSections] = await Promise.all([
    buildExecutiveSummary(sortedClusters, activeTopics),
    ...activeTopics.map((topic) =>
      buildTopicSection(topic, sortedClusters, sortedMarkets, industry)
    ),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    executiveSummary,
    sections: topicSections,
    divergenceSignals: buildDivergenceSection(sortedClusters, sortedMarkets),
    watchlist: buildWatchlist(sortedClusters, sortedMarkets, activeTopics),
    articleCount: clusters.flatMap((c) => c.articles).length,
    marketCount: markets.length,
    sourceErrors,
  };
}

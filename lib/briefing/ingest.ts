// ============================================================
// Ingestion orchestrator
// Fetches all sources, normalizes, matches topics, clusters
// ============================================================

import { fetchGuardianTopics } from "@/lib/sources/guardian/client";
import { mapGuardianResults } from "@/lib/sources/guardian/mapper";
import { fetchAllRssFeeds } from "@/lib/sources/rss/client";
import { mapRssItems } from "@/lib/sources/rss/mapper";
import { fetchTopMarkets } from "@/lib/sources/polymarket/client";
import { mapGammaMarkets } from "@/lib/sources/polymarket/mapper";
import { RSS_FEEDS } from "@/lib/sources/rss/feeds.config";
import { isMockMode, MOCK_ARTICLES, MOCK_MARKETS } from "@/lib/briefing/mock-data";
import { matchArticleTopics, matchMarketTopics } from "@/lib/topics/matcher";
import { clusterArticles } from "@/lib/topics/clusterer";
import { suggestHotTopics, suggestHotTopicCandidates } from "@/lib/topics/hot-topics";
import { generateHotTopicReasons, generateOutsideFocusSynthesis } from "@/lib/llm/column-writer";
import { synthesizeBrief } from "@/lib/briefing/synthesizer";
import { readCache, writeCache, readSettings } from "@/lib/cache/store";
import type {
  Topic,
  EditorialArticle,
  PredictionMarket,
  ClusteredStory,
  MorningBrief,
  HotTopic,
} from "@/types";

export interface IngestResult {
  articles: EditorialArticle[];
  markets: PredictionMarket[];
  clusters: ClusteredStory[];
  brief: MorningBrief;
  hotTopics: HotTopic[];
  errors: string[];
  fromCache: boolean;
}

/**
 * Full ingestion pipeline. Uses cache if fresh, otherwise re-fetches.
 */
export async function ingest(
  topics: Topic[],
  forceRefresh = false
): Promise<IngestResult> {
  // Try cache first
  if (!forceRefresh) {
    const cached = readCache();
    if (cached) {
      return await buildResult(
        cached.articles,
        cached.markets,
        topics,
        cached.sourceErrors,
        true
      );
    }
  }

  // ── Mock mode ───────────────────────────────────────────────
  if (isMockMode()) {
    console.log("[ingest] Running in mock data mode");
    writeCache(MOCK_ARTICLES, MOCK_MARKETS, []);
    return await buildResult(MOCK_ARTICLES, MOCK_MARKETS, topics, [], false);
  }

  const errors: string[] = [];
  const allArticles: EditorialArticle[] = [];
  const allMarkets: PredictionMarket[] = [];

  // ── Guardian ────────────────────────────────────────────────
  try {
    const activeKeywords = topics
      .filter((t) => t.active)
      .flatMap((t) => t.keywords.slice(0, 3)); // top 3 kws per topic

    const guardianResults = await fetchGuardianTopics(
      [...new Set(activeKeywords)],
      40
    );
    allArticles.push(...mapGuardianResults(guardianResults));
  } catch (err) {
    const msg = `Guardian: ${err instanceof Error ? err.message : String(err)}`;
    errors.push(msg);
    console.error("[ingest] Guardian error:", msg);
  }

  // ── RSS (Le Monde + Al Jazeera) ─────────────────────────────
  try {
    const { items, errors: rssErrors } = await fetchAllRssFeeds(RSS_FEEDS);
    allArticles.push(...mapRssItems(items));
    errors.push(...rssErrors);
  } catch (err) {
    const msg = `RSS: ${err instanceof Error ? err.message : String(err)}`;
    errors.push(msg);
    console.error("[ingest] RSS error:", msg);
  }

  // ── Polymarket ───────────────────────────────────────────────
  try {
    const rawMarkets = await fetchTopMarkets(100, 5); // 5 pages × 100 = up to 500 markets
    allMarkets.push(...mapGammaMarkets(rawMarkets));
  } catch (err) {
    const msg = `Polymarket: ${err instanceof Error ? err.message : String(err)}`;
    errors.push(msg);
    console.error("[ingest] Polymarket error:", msg);
  }

  // Deduplicate articles by URL
  const seenUrls = new Set<string>();
  const dedupedArticles = allArticles.filter((a) => {
    if (seenUrls.has(a.url)) return false;
    seenUrls.add(a.url);
    return true;
  });

  // Persist to cache
  writeCache(dedupedArticles, allMarkets, errors);

  return await buildResult(dedupedArticles, allMarkets, topics, errors, false);
}

async function buildResult(
  rawArticles: EditorialArticle[],
  rawMarkets: PredictionMarket[],
  topics: Topic[],
  errors: string[],
  fromCache: boolean
): Promise<IngestResult> {
  // Apply topic matching
  const articles = matchArticleTopics(rawArticles, topics);
  const markets = matchMarketTopics(rawMarkets, topics);

  // Cluster articles
  const clusters = clusterArticles(articles);

  // Attach related markets to clusters
  for (const cluster of clusters) {
    cluster.relatedMarkets = markets.filter((m) =>
      m.matchedTopics.some((mt) => cluster.matchedTopics.includes(mt))
    );
  }

  // Synthesize brief (async — calls LLM if ANTHROPIC_API_KEY is set)
  const { industry } = readSettings();
  const brief = await synthesizeBrief(clusters, markets, topics, errors, industry);

  // Hot topics — LLM filters to industry-relevant MECE set, deterministic fallback otherwise
  const hotTopicCandidates = suggestHotTopicCandidates(articles, markets, topics, 12);
  const llmSelected = await generateHotTopicReasons(hotTopicCandidates, industry);
  const hotTopics: HotTopic[] = llmSelected
    ? // LLM returned a filtered, ordered, industry-relevant set
      llmSelected.map(({ label, reason }) => {
        const c = hotTopicCandidates.find((x) => x.label === label) ?? hotTopicCandidates[0];
        return {
          label,
          reason,
          articleCount: c.articleCount,
          marketCount: c.marketCount,
          keywords: c.keywords,
          score: c.score,
        };
      })
    : // Fallback: all candidates with deterministic reasons
      hotTopicCandidates.map((c) => ({
        label: c.label,
        reason:
          c.sources.length > 1
            ? `Covered by ${c.sources.join(", ")} — ${c.articleCount} articles`
            : `${c.articleCount} articles from ${c.sources[0] ?? "multiple sources"}`,
        articleCount: c.articleCount,
        marketCount: c.marketCount,
        keywords: c.keywords,
        score: c.score,
      }));

  // Generate synthesis paragraph + why-it-matters for the outside focus section
  if (hotTopics.length > 0) {
    const { synthesis, whyItMatters } = await generateOutsideFocusSynthesis(
      hotTopics.map(({ label, reason }) => ({ label, reason })),
      industry
    );
    if (synthesis) brief.outsideFocusSynthesis = synthesis;
    if (whyItMatters) brief.outsideFocusWhyItMatters = whyItMatters;
  }

  return { articles, markets, clusters, brief, hotTopics, errors, fromCache };
}

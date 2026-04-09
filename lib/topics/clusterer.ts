// ============================================================
// Story clusterer
// Groups editorial articles about the same underlying event
// ============================================================

import type { EditorialArticle, ClusteredStory, EditorialSource } from "@/types";
import { headlineSimilarity, jaccardSimilarity } from "@/lib/utils/text";
import { v4 as uuidv4 } from "uuid";

const SIMILARITY_THRESHOLD = 0.25; // Jaccard similarity to consider same story

/**
 * Cluster articles that appear to cover the same story.
 * Uses headline similarity + keyword overlap as heuristics.
 */
export function clusterArticles(
  articles: EditorialArticle[]
): ClusteredStory[] {
  if (articles.length === 0) return [];

  // Sort newest first
  const sorted = [...articles].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );

  const clusters: ClusteredStory[] = [];
  const assigned = new Set<string>();

  for (const article of sorted) {
    if (assigned.has(article.id)) continue;

    // Find articles similar enough to cluster together
    const clusterMembers: EditorialArticle[] = [article];
    assigned.add(article.id);

    for (const other of sorted) {
      if (assigned.has(other.id)) continue;
      const headlineSim = headlineSimilarity(article.title, other.title);
      const keywordSim = jaccardSimilarity(
        article.extractedKeywords,
        other.extractedKeywords
      );
      const combined = headlineSim * 0.6 + keywordSim * 0.4;

      if (combined >= SIMILARITY_THRESHOLD) {
        clusterMembers.push(other);
        assigned.add(other.id);
      }
    }

    const sources = [
      ...new Set(clusterMembers.map((a) => a.source)),
    ] as EditorialSource[];

    const matchedTopics = [
      ...new Set(clusterMembers.flatMap((a) => a.matchedTopics)),
    ];

    const relevanceScore =
      clusterMembers.reduce((sum, a) => sum + a.relevanceScore, 0) /
      clusterMembers.length;

    const framing =
      clusterMembers.length > 1
        ? buildFramingNote(clusterMembers)
        : undefined;

    clusters.push({
      id: uuidv4(),
      representativeHeadline: clusterMembers[0].title,
      articles: clusterMembers,
      sources,
      publishedAt: clusterMembers[0].publishedAt,
      matchedTopics,
      relevanceScore,
      framing,
      relatedMarkets: [],
    });
  }

  return clusters.sort(
    (a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
}

/**
 * Build a brief framing note when multiple sources cover the same story.
 * Highlights differences in emphasis or approach.
 */
function buildFramingNote(
  articles: EditorialArticle[]
): ClusteredStory["framing"] {
  const emphasis: Record<string, string> = {};
  for (const a of articles) {
    emphasis[a.source] = a.summary ?? a.title;
  }

  // Find sources with meaningfully different summaries
  const sourceList = Object.keys(emphasis);
  if (sourceList.length <= 1) return { emphasis };

  const differences = buildDifferencesNote(articles);
  return { emphasis, differences };
}

/**
 * Heuristically note differences between sources covering the same story.
 * This is the hook point where an LLM-powered comparison can be injected.
 *
 * TODO: Replace this deterministic heuristic with an LLM call for richer analysis.
 * Example: await llm.compare(articles.map(a => ({ source: a.source, angle: a.summary ?? a.title })))
 */
function buildDifferencesNote(articles: EditorialArticle[]): string {
  const sourceLabels: Record<string, string> = {
    guardian: "The Guardian",
    lemonde: "Le Monde",
    aljazeera: "Al Jazeera",
  };

  const covered = articles.map((a) => sourceLabels[a.source] ?? a.source);

  if (covered.length === 1) return "";

  // Simple note: list sources that have differing summaries
  const withSummary = articles.filter((a) => a.summary);
  if (withSummary.length > 1) {
    return `Covered by ${covered.join(", ")}. Each source may emphasize different aspects — compare angles above.`;
  }

  return `Covered by ${covered.join(", ")}.`;
}

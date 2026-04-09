// ============================================================
// Topic matcher
// Scores articles and markets against user topics
// ============================================================

import type {
  Topic,
  EditorialArticle,
  PredictionMarket,
  TopicMatch,
} from "@/types";
import { normalizeText, stem } from "@/lib/utils/text";

/**
 * Score a piece of text against a topic's keywords.
 * Returns a score 0-1 and the matched keywords.
 */
function scoreTextAgainstTopic(
  text: string,
  topic: Topic
): { score: number; matchedKeywords: string[] } {
  if (!text || topic.keywords.length === 0) return { score: 0, matchedKeywords: [] };

  const normalizedText = normalizeText(text);
  const matched: string[] = [];

  const textWords = normalizedText.split(" ");

  for (const keyword of topic.keywords) {
    const normalizedKeyword = normalizeText(keyword);
    const kWords = normalizedKeyword.split(" ");

    if (kWords.length > 1) {
      // Multi-word phrase: require word-boundary-anchored match
      // (prevents "s p" from matching inside "flyers philadelphia")
      const escaped = normalizedKeyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (new RegExp(`(?<![\\w])${escaped}(?![\\w])`).test(normalizedText)) {
        matched.push(keyword);
      }
    } else {
      // Single word: require a whole-word match (not substring)
      const kStem = stem(kWords[0]);
      if (textWords.some((w) => w === normalizedKeyword || stem(w) === kStem)) {
        matched.push(keyword);
      }
    }
  }

  const score = matched.length === 0 ? 0 : Math.min(1, matched.length / Math.max(1, topic.keywords.length * 0.3));
  return { score, matchedKeywords: matched };
}

/**
 * Match a set of text fields (title, summary, section, keywords) against all active topics.
 * Returns the best matches with scores.
 */
export function matchTopics(
  fields: {
    title?: string;
    summary?: string;
    section?: string;
    extractedKeywords?: string[];
  },
  topics: Topic[]
): TopicMatch[] {
  const combinedText = [
    fields.title,
    fields.summary,
    fields.section,
    fields.extractedKeywords?.join(" "),
  ]
    .filter(Boolean)
    .join(" ");

  const matches: TopicMatch[] = [];

  for (const topic of topics) {
    if (!topic.active) continue;
    const { score, matchedKeywords } = scoreTextAgainstTopic(
      combinedText,
      topic
    );
    if (score > 0) {
      matches.push({
        topicId: topic.id,
        topicName: topic.displayName,
        score,
        matchedKeywords,
      });
    }
  }

  return matches.sort((a, b) => b.score - a.score);
}

/**
 * Apply topic matching to a batch of editorial articles.
 */
export function matchArticleTopics(
  articles: EditorialArticle[],
  topics: Topic[]
): EditorialArticle[] {
  return articles.map((article) => {
    const matches = matchTopics(
      {
        title: article.title,
        summary: article.summary,
        section: article.section,
        extractedKeywords: article.extractedKeywords,
      },
      topics
    );

    return {
      ...article,
      matchedTopics: matches.map((m) => m.topicId),
      relevanceScore: matches[0]?.score ?? 0,
    };
  });
}

/**
 * Apply topic matching to a batch of prediction markets.
 */
export function matchMarketTopics(
  markets: PredictionMarket[],
  topics: Topic[]
): PredictionMarket[] {
  return markets.map((market) => {
    const matches = matchTopics(
      {
        title: market.title,
        summary: market.eventTitle,
        section: market.category,
        extractedKeywords: market.extractedKeywords,
      },
      topics
    );

    return {
      ...market,
      matchedTopics: matches.map((m) => m.topicId),
      relevanceScore: matches[0]?.score ?? 0,
    };
  });
}

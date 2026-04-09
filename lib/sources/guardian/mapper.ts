// Maps Guardian API results to the normalized EditorialArticle schema

import type { GuardianResult } from "./client";
import type { EditorialArticle } from "@/types";
import { extractKeywords } from "@/lib/utils/text";
import { safeParseDate } from "@/lib/utils/date";
import { stripHtml } from "@/lib/utils/text";

export function mapGuardianResult(result: GuardianResult): EditorialArticle {
  const summary = result.fields?.trailText
    ? stripHtml(result.fields.trailText)
    : undefined;

  const textForKeywords = [result.webTitle, summary].filter(Boolean).join(" ");

  return {
    id: `guardian-${result.id}`,
    source: "guardian",
    title: result.webTitle,
    summary,
    url: result.webUrl,
    publishedAt: safeParseDate(result.webPublicationDate),
    section: result.sectionName,
    extractedKeywords: extractKeywords(textForKeywords),
    matchedTopics: [],
    relevanceScore: 0,
    rawSourceMetadata: {
      id: result.id,
      webPublicationDate: result.webPublicationDate,
    },
  };
}

export function mapGuardianResults(
  results: GuardianResult[]
): EditorialArticle[] {
  return results.map(mapGuardianResult);
}

// Maps raw RSS items to normalized EditorialArticle schema

import type { RawRssItem } from "./client";
import type { EditorialArticle, EditorialSource } from "@/types";
import { extractKeywords, stripHtml } from "@/lib/utils/text";
import { safeParseDate } from "@/lib/utils/date";
import { createHash } from "crypto";

function generateId(item: RawRssItem): string {
  const key = item.guid ?? item.link ?? item.title;
  return `${item.source}-${createHash("md5").update(key).digest("hex").slice(0, 12)}`;
}

export function mapRssItem(item: RawRssItem): EditorialArticle {
  const summary = item.contentSnippet
    ? stripHtml(item.contentSnippet)
    : undefined;
  const textForKeywords = [item.title, summary, ...item.categories]
    .filter(Boolean)
    .join(" ");

  return {
    id: generateId(item),
    source: item.source as EditorialSource,
    title: stripHtml(item.title),
    summary,
    url: item.link,
    publishedAt: safeParseDate(item.pubDate),
    section: item.categories[0] ?? undefined,
    extractedKeywords: extractKeywords(textForKeywords),
    matchedTopics: [],
    relevanceScore: 0,
    rawSourceMetadata: {
      guid: item.guid,
      feedUrl: item.feedUrl,
      categories: item.categories,
    },
  };
}

export function mapRssItems(items: RawRssItem[]): EditorialArticle[] {
  return items
    .filter((item) => item.link) // skip items without URLs
    .map(mapRssItem);
}

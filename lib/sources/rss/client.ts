// ============================================================
// Generic RSS ingestion client
// Parses any RSS/Atom feed into a normalized internal format
// ============================================================

import Parser from "rss-parser";
import type { RssFeedConfig } from "./feeds.config";

export interface RawRssItem {
  source: string;
  feedUrl: string;
  title: string;
  link: string;
  pubDate: string | undefined;
  contentSnippet: string | undefined;
  categories: string[];
  guid: string | undefined;
}

const parser = new Parser({
  timeout: 10_000,
  customFields: {
    item: ["media:content", "dc:creator"],
  },
});

export async function fetchRssFeed(
  config: RssFeedConfig,
  feedUrl: string
): Promise<RawRssItem[]> {
  const feed = await parser.parseURL(feedUrl);

  return (feed.items ?? []).map((item) => ({
    source: config.source,
    feedUrl,
    title: item.title ?? "Untitled",
    link: item.link ?? item.guid ?? "",
    pubDate: item.pubDate ?? item.isoDate,
    contentSnippet: item.contentSnippet,
    categories: item.categories ?? [],
    guid: item.guid,
  }));
}

export async function fetchAllRssFeeds(
  configs: RssFeedConfig[]
): Promise<{ items: RawRssItem[]; errors: string[] }> {
  const allItems: RawRssItem[] = [];
  const errors: string[] = [];

  await Promise.allSettled(
    configs.flatMap((config) =>
      config.urls.map(async (url) => {
        try {
          const items = await fetchRssFeed(config, url);
          allItems.push(...items);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          errors.push(`RSS ${config.displayName} (${url}): ${msg}`);
        }
      })
    )
  );

  return { items: allItems, errors };
}

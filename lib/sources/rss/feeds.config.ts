// ============================================================
// RSS feed configuration
// Add or swap feed URLs here — the ingestion pipeline is generic
// ============================================================

import type { EditorialSource } from "@/types";

export interface RssFeedConfig {
  source: EditorialSource;
  displayName: string;
  urls: string[]; // multiple feeds per source
}

export const RSS_FEEDS: RssFeedConfig[] = [
  {
    source: "lemonde",
    displayName: "Le Monde",
    urls: [
      "https://www.lemonde.fr/rss/une.xml",
      "https://www.lemonde.fr/international/rss_full.xml",
    ],
  },
  {
    source: "aljazeera",
    displayName: "Al Jazeera",
    urls: [
      "https://www.aljazeera.com/xml/rss/all.xml",
    ],
  },
];

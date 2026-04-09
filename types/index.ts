// ============================================================
// Core normalized schemas for Morning Brief
// ============================================================

import { z } from "zod";

// ── Source identifiers ───────────────────────────────────────

export const EditorialSourceSchema = z.enum([
  "guardian",
  "lemonde",
  "aljazeera",
] as const);
export type EditorialSource = z.infer<typeof EditorialSourceSchema>;

// ── Editorial Article ────────────────────────────────────────

export const EditorialArticleSchema = z.object({
  id: z.string(),
  source: EditorialSourceSchema,
  title: z.string(),
  summary: z.string().optional(),
  url: z.string().url(),
  publishedAt: z.string(),
  section: z.string().optional(),
  extractedKeywords: z.array(z.string()).default([]),
  matchedTopics: z.array(z.string()).default([]),
  relevanceScore: z.number().min(0).max(1).default(0),
  rawSourceMetadata: z.record(z.string(), z.unknown()).optional(),
});
export type EditorialArticle = z.infer<typeof EditorialArticleSchema>;

// ── Prediction Market ────────────────────────────────────────

export const PredictionMarketSchema = z.object({
  id: z.string(),
  source: z.literal("polymarket"),
  title: z.string(),
  eventTitle: z.string().optional(),
  url: z.string().url(),
  category: z.string().optional(),
  yesPrice: z.number().min(0).max(1).optional(),
  noPrice: z.number().min(0).max(1).optional(),
  probabilityYes: z.number().min(0).max(100).optional(),
  probabilityNo: z.number().min(0).max(100).optional(),
  volume: z.number().optional(),
  openInterest: z.number().optional(),
  endDate: z.string().optional(),
  active: z.boolean(),
  extractedKeywords: z.array(z.string()).default([]),
  matchedTopics: z.array(z.string()).default([]),
  relevanceScore: z.number().min(0).max(1).default(0),
  rawSourceMetadata: z.record(z.string(), z.unknown()).optional(),
});
export type PredictionMarket = z.infer<typeof PredictionMarketSchema>;

// ── Topic ────────────────────────────────────────────────────

export const TopicSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  keywords: z.array(z.string()),
  active: z.boolean().default(true),
  color: z.string().optional(), // hex or Tailwind class
});
export type Topic = z.infer<typeof TopicSchema>;

// ── Topic Match ──────────────────────────────────────────────

export const TopicMatchSchema = z.object({
  topicId: z.string(),
  topicName: z.string(),
  score: z.number(),
  matchedKeywords: z.array(z.string()),
});
export type TopicMatch = z.infer<typeof TopicMatchSchema>;

// ── Clustered Story ──────────────────────────────────────────

export const ClusteredStorySchema = z.object({
  id: z.string(),
  representativeHeadline: z.string(),
  articles: z.array(EditorialArticleSchema),
  sources: z.array(EditorialSourceSchema),
  publishedAt: z.string(),
  matchedTopics: z.array(z.string()),
  relevanceScore: z.number().min(0).max(1).default(0),
  framing: z
    .object({
      differences: z.string().optional(),
      emphasis: z.record(z.string(), z.string()).optional(), // source -> angle
    })
    .optional(),
  relatedMarkets: z.array(PredictionMarketSchema).default([]),
});
export type ClusteredStory = z.infer<typeof ClusteredStorySchema>;

// ── Story item inside a brief section ───────────────────────

export const BriefStorySchema = z.object({
  title: z.string(),
  summary: z.string().optional(),
  url: z.string(),
  source: EditorialSourceSchema,
  publishedAt: z.string(),
  multiSource: z.boolean().default(false), // true if multiple sources covered this story
  sourceCount: z.number().default(1),
});
export type BriefStory = z.infer<typeof BriefStorySchema>;

// ── Morning Brief Section ────────────────────────────────────

export const BriefSectionSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  synthesis: z.string().optional(),              // one narrative paragraph combining key stories
  bullets: z.array(z.string()).default([]),       // plain-text version (used by TTS)
  stories: z.array(BriefStorySchema).default([]), // structured stories for UI rendering
  whyItMatters: z.string().optional(),
  topicId: z.string().optional(),
  sources: z.array(EditorialSourceSchema).default([]),
  markets: z.array(PredictionMarketSchema).default([]),
});
export type BriefSection = z.infer<typeof BriefSectionSchema>;

// ── Morning Brief ────────────────────────────────────────────

export const MorningBriefSchema = z.object({
  generatedAt: z.string(),
  executiveSummary: z.string(),
  sections: z.array(BriefSectionSchema),
  divergenceSignals: z.array(z.string()).default([]),
  watchlist: z.array(z.string()).default([]),
  articleCount: z.number(),
  marketCount: z.number(),
  sourceErrors: z.array(z.string()).default([]),
});
export type MorningBrief = z.infer<typeof MorningBriefSchema>;

// ── Hot Topic Suggestion ─────────────────────────────────────

export const HotTopicSchema = z.object({
  label: z.string(),
  reason: z.string(),
  articleCount: z.number(),
  marketCount: z.number(),
  keywords: z.array(z.string()),
  score: z.number(),
});
export type HotTopic = z.infer<typeof HotTopicSchema>;

// ── Ingestion Cache Entry ────────────────────────────────────

export const CacheEntrySchema = z.object({
  fetchedAt: z.string().datetime({ offset: true }),
  articles: z.array(EditorialArticleSchema),
  markets: z.array(PredictionMarketSchema),
  sourceErrors: z.array(z.string()),
});
export type CacheEntry = z.infer<typeof CacheEntrySchema>;

// ── API Response Shapes ──────────────────────────────────────

export interface RefreshResponse {
  success: boolean;
  articleCount: number;
  marketCount: number;
  errors: string[];
  brief: MorningBrief;
  hotTopics: HotTopic[];
  clusters: ClusteredStory[];
}

export interface AskResponse {
  answer: string;
  sources: string[];
}

export interface TopicsResponse {
  topics: Topic[];
}

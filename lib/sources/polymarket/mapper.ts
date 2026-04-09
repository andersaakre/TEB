// Maps Gamma API market objects to normalized PredictionMarket schema

import type { GammaMarket } from "./client";
import type { PredictionMarket } from "@/types";
import { extractKeywords } from "@/lib/utils/text";

const POLYMARKET_BASE = "https://polymarket.com";

function parseOutcomePrices(
  market: GammaMarket
): { yesPrice?: number; noPrice?: number; probabilityYes?: number; probabilityNo?: number } {
  try {
    if (!market.outcomePrices) return {};
    const prices: number[] = JSON.parse(market.outcomePrices).map(Number);
    const outcomes: string[] = market.outcomes
      ? JSON.parse(market.outcomes).map((s: string) => s.toLowerCase())
      : ["yes", "no"];

    const yesIdx = outcomes.findIndex((o) => o === "yes");
    const noIdx = outcomes.findIndex((o) => o === "no");

    const yesPrice = yesIdx >= 0 ? prices[yesIdx] : prices[0];
    const noPrice = noIdx >= 0 ? prices[noIdx] : prices[1];

    return {
      yesPrice: yesPrice ?? undefined,
      noPrice: noPrice ?? undefined,
      probabilityYes: yesPrice !== undefined ? Math.round(yesPrice * 100) : undefined,
      probabilityNo: noPrice !== undefined ? Math.round(noPrice * 100) : undefined,
    };
  } catch {
    return {};
  }
}

export function mapGammaMarket(market: GammaMarket): PredictionMarket {
  const { yesPrice, noPrice, probabilityYes, probabilityNo } = parseOutcomePrices(market);

  const slug = market.slug ?? market.id;
  const url = `${POLYMARKET_BASE}/event/${slug}`;

  const textForKeywords = [
    market.question,
    market.description,
    market.category,
    ...(market.tags?.map((t) => t.label) ?? []),
  ]
    .filter(Boolean)
    .join(" ");

  return {
    id: `polymarket-${market.id}`,
    source: "polymarket",
    title: market.question,
    eventTitle: market.groupItemTitle ?? market.question,
    url,
    category: market.category ?? market.tags?.[0]?.label,
    yesPrice,
    noPrice,
    probabilityYes,
    probabilityNo,
    volume: market.volume,
    openInterest: market.liquidity,
    endDate: market.endDate,
    active: market.active ?? true,
    extractedKeywords: extractKeywords(textForKeywords),
    matchedTopics: [],
    relevanceScore: 0,
    rawSourceMetadata: {
      id: market.id,
      conditionId: market.conditionId,
      tags: market.tags,
    },
  };
}

export function mapGammaMarkets(markets: GammaMarket[]): PredictionMarket[] {
  return markets
    .filter((m) => m.question)
    .map(mapGammaMarket);
}

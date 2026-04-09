// ============================================================
// Polymarket API client
// Uses Gamma API (public) for market discovery
// Docs: https://docs.polymarket.com/api-reference/introduction
// ============================================================

import { z } from "zod";

const GAMMA_BASE = "https://gamma-api.polymarket.com";

// ── Gamma API schemas ────────────────────────────────────────

const GammaMarketSchema = z.object({
  id: z.string(),
  question: z.string(),
  description: z.string().optional(),
  conditionId: z.string().optional(),
  slug: z.string().optional(),
  endDate: z.string().optional(),
  active: z.boolean().optional(),
  closed: z.boolean().optional(),
  category: z.string().optional(),
  tags: z.array(z.object({ id: z.string(), label: z.string() })).optional(),
  volume: z.union([z.number(), z.string()]).optional().transform((v) => (v !== undefined ? Number(v) : undefined)),
  liquidity: z.union([z.number(), z.string()]).optional().transform((v) => (v !== undefined ? Number(v) : undefined)),
  startDate: z.string().optional(),
  // outcome prices come as JSON string arrays
  outcomePrices: z.string().optional(),
  outcomes: z.string().optional(),
  groupItemTitle: z.string().optional(),
  // clob token IDs
  clobTokenIds: z.string().optional(),
});

export type GammaMarket = z.infer<typeof GammaMarketSchema>;

const GammaEventSchema = z.object({
  id: z.string(),
  title: z.string(),
  slug: z.string().optional(),
  description: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  active: z.boolean().optional(),
  closed: z.boolean().optional(),
  tags: z.array(z.object({ id: z.string(), label: z.string() })).optional(),
  markets: z.array(GammaMarketSchema).optional(),
  volume: z.union([z.number(), z.string()]).optional().transform((v) => (v !== undefined ? Number(v) : undefined)),
  liquidity: z.union([z.number(), z.string()]).optional().transform((v) => (v !== undefined ? Number(v) : undefined)),
});

export type GammaEvent = z.infer<typeof GammaEventSchema>;

// ── Fetch functions ──────────────────────────────────────────

export async function fetchMarkets(params: {
  limit?: number;
  offset?: number;
  active?: boolean;
  closed?: boolean;
  tag_slug?: string;
  tag_id?: number;
  related_tags?: string;
  order?: string;
  ascending?: boolean;
} = {}): Promise<GammaMarket[]> {
  const searchParams = new URLSearchParams({
    limit: String(params.limit ?? 50),
    offset: String(params.offset ?? 0),
    ...(params.active !== undefined ? { active: String(params.active) } : {}),
    ...(params.closed !== undefined ? { closed: String(params.closed) } : {}),
    ...(params.tag_slug ? { tag_slug: params.tag_slug } : {}),
    ...(params.tag_id ? { tag_id: String(params.tag_id) } : {}),
    ...(params.related_tags ? { related_tags: params.related_tags } : {}),
    order: params.order ?? "volume",
    ascending: String(params.ascending ?? false),
  });

  const url = `${GAMMA_BASE}/markets?${searchParams}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Polymarket Gamma API error: ${res.status} ${res.statusText}`);
  }

  const json = await res.json();
  if (!Array.isArray(json)) return [];

  return json
    .map((item: unknown) => GammaMarketSchema.safeParse(item))
    .filter((r) => r.success)
    .map((r) => (r as { success: true; data: GammaMarket }).data);
}

export async function fetchEvents(params: {
  limit?: number;
  offset?: number;
  active?: boolean;
  order?: string;
} = {}): Promise<GammaEvent[]> {
  const searchParams = new URLSearchParams({
    limit: String(params.limit ?? 30),
    offset: String(params.offset ?? 0),
    ...(params.active !== undefined ? { active: String(params.active) } : {}),
    order: params.order ?? "volume",
    ascending: "false",
  });

  const url = `${GAMMA_BASE}/events?${searchParams}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Polymarket Events API error: ${res.status} ${res.statusText}`);
  }

  const json = await res.json();
  if (!Array.isArray(json)) return [];

  return json
    .map((item: unknown) => GammaEventSchema.safeParse(item))
    .filter((r) => r.success)
    .map((r) => (r as { success: true; data: GammaEvent }).data);
}

/**
 * Fetch a broad pool of active markets across multiple pages in parallel.
 * The Gamma API sorts by volume and ignores tag/search filters, so pagination
 * is the only way to surface diverse topic coverage (AI, economy, geopolitics,
 * climate all appear deeper than the sports-heavy top-100).
 */
export async function fetchTopMarkets(
  perPage = 100,
  pages = 5
): Promise<GammaMarket[]> {
  const offsets = Array.from({ length: pages }, (_, i) => i * perPage);

  const batches = await Promise.all(
    offsets.map((offset) =>
      fetchMarkets({ limit: perPage, offset, active: true, closed: false, order: "volume" }).catch(() => [] as GammaMarket[])
    )
  );

  // Deduplicate by market ID across pages
  const seen = new Set<string>();
  const results: GammaMarket[] = [];
  for (const batch of batches) {
    for (const market of batch) {
      if (!seen.has(market.id)) {
        seen.add(market.id);
        results.push(market);
      }
    }
  }
  return results;
}

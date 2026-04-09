// ============================================================
// The Guardian API client
// Docs: https://open-platform.theguardian.com/documentation/
// ============================================================

import { z } from "zod";

const GUARDIAN_BASE = "https://content.guardianapis.com";

// Guardian API response shapes (partial)
const GuardianFieldsSchema = z.object({
  trailText: z.string().optional(),
  thumbnail: z.string().optional(),
});

const GuardianResultSchema = z.object({
  id: z.string(),
  webTitle: z.string(),
  webUrl: z.string(),
  sectionName: z.string().optional(),
  webPublicationDate: z.string(),
  fields: GuardianFieldsSchema.optional(),
});

const GuardianResponseSchema = z.object({
  response: z.object({
    status: z.string(),
    results: z.array(GuardianResultSchema),
    total: z.number().optional(),
    pages: z.number().optional(),
  }),
});

export type GuardianResult = z.infer<typeof GuardianResultSchema>;

interface SearchParams {
  q?: string;
  section?: string;
  pageSize?: number;
  orderBy?: "newest" | "oldest" | "relevance";
  showFields?: string;
  fromDate?: string;
}

export async function searchGuardian(
  params: SearchParams = {}
): Promise<GuardianResult[]> {
  const apiKey = process.env.GUARDIAN_API_KEY;
  if (!apiKey) throw new Error("GUARDIAN_API_KEY not set");

  const searchParams = new URLSearchParams({
    "api-key": apiKey,
    "page-size": String(params.pageSize ?? 20),
    "order-by": params.orderBy ?? "newest",
    "show-fields": params.showFields ?? "trailText,thumbnail",
    ...(params.q ? { q: params.q } : {}),
    ...(params.section ? { section: params.section } : {}),
    ...(params.fromDate ? { "from-date": params.fromDate } : {}),
  });

  const url = `${GUARDIAN_BASE}/search?${searchParams}`;
  const res = await fetch(url, { cache: "no-store" });

  if (!res.ok) {
    throw new Error(`Guardian API error: ${res.status} ${res.statusText}`);
  }

  const json = await res.json();
  const parsed = GuardianResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error(`Guardian response parse error: ${parsed.error.message}`);
  }

  return parsed.data.response.results;
}

/**
 * Fetch top news across multiple topic keywords in a single query batch.
 * Returns deduplicated results.
 */
export async function fetchGuardianTopics(
  keywords: string[],
  pageSize = 30
): Promise<GuardianResult[]> {
  if (keywords.length === 0) {
    // Fetch general top news if no keywords
    return searchGuardian({ pageSize });
  }

  // Batch into a single OR query (Guardian supports this)
  const query = keywords.slice(0, 10).join(" OR ");
  return searchGuardian({ q: query, pageSize, orderBy: "newest" });
}

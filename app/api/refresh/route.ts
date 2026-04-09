import { NextRequest, NextResponse } from "next/server";
import { ingest } from "@/lib/briefing/ingest";
import { readTopics } from "@/lib/cache/store";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const forceRefresh = body?.force === true;

    const topics = readTopics();
    const result = await ingest(topics, forceRefresh);

    return NextResponse.json({
      success: true,
      articleCount: result.articles.length,
      marketCount: result.markets.length,
      errors: result.errors,
      brief: result.brief,
      hotTopics: result.hotTopics,
      clusters: result.clusters,
      fromCache: result.fromCache,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[api/refresh]", message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

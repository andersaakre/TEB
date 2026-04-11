import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { ingest } from "@/lib/briefing/ingest";
import { SEED_TOPICS } from "@/data/seed-topics";
import type { Topic } from "@/types";
import type { UserSettings } from "@/lib/cache/store";

const DEFAULT_SETTINGS: UserSettings = { industry: "FMCG", language: "English" };

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const forceRefresh = body?.force === true;

    // Load per-user topics and settings from Clerk metadata
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const meta = user.privateMetadata ?? {};
    const rawTopics = meta.topics as Topic[] | undefined;
    const topics: Topic[] = rawTopics && rawTopics.length > 0 ? rawTopics : SEED_TOPICS;
    const settings: UserSettings = { ...DEFAULT_SETTINGS, ...(meta.settings as Partial<UserSettings> | undefined) };

    const result = await ingest(topics, forceRefresh, settings.industry, settings.language);

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
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

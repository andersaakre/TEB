import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { SEED_TOPICS } from "@/data/seed-topics";
import { z } from "zod";
import type { Topic } from "@/types";

const TopicPayloadSchema = z.object({
  id: z.string(),
  displayName: z.string().min(1),
  keywords: z.array(z.string()),
  active: z.boolean(),
  color: z.string().optional(),
});

async function getUserTopics(userId: string): Promise<Topic[]> {
  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const stored = user.privateMetadata?.topics as Topic[] | undefined;
  return stored && stored.length > 0 ? stored : SEED_TOPICS;
}

async function saveUserTopics(userId: string, topics: Topic[]): Promise<void> {
  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  await client.users.updateUserMetadata(userId, {
    privateMetadata: { ...(user.privateMetadata ?? {}), topics },
  });
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const topics = await getUserTopics(userId);
  return NextResponse.json({ topics });
}

export async function PUT(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await req.json();
    const topics = z.array(TopicPayloadSchema).parse(body) as Topic[];
    await saveUserTopics(userId, topics);
    return NextResponse.json({ success: true, topics });
  } catch (err) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : "Invalid payload" }, { status: 400 });
  }
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await req.json();
    const newTopic = TopicPayloadSchema.parse(body) as Topic;
    const existing = await getUserTopics(userId);
    const idx = existing.findIndex((t) => t.id === newTopic.id);
    if (idx >= 0) existing[idx] = newTopic;
    else existing.push(newTopic);
    await saveUserTopics(userId, existing);
    return NextResponse.json({ success: true, topics: existing });
  } catch (err) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : "Invalid payload" }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ success: false, error: "id required" }, { status: 400 });
    const existing = (await getUserTopics(userId)).filter((t) => t.id !== id);
    await saveUserTopics(userId, existing);
    return NextResponse.json({ success: true, topics: existing });
  } catch (err) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : "Unknown error" }, { status: 400 });
  }
}

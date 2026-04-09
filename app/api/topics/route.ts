import { NextRequest, NextResponse } from "next/server";
import { readTopics, writeTopics } from "@/lib/cache/store";
import { z } from "zod";
import type { Topic } from "@/types";

const TopicPayloadSchema = z.object({
  id: z.string(),
  displayName: z.string().min(1),
  keywords: z.array(z.string()),
  active: z.boolean(),
  color: z.string().optional(),
});

export async function GET() {
  const topics = readTopics();
  return NextResponse.json({ topics });
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const topics = z.array(TopicPayloadSchema).parse(body);
    writeTopics(topics as Topic[]);
    return NextResponse.json({ success: true, topics });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid payload";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const newTopic = TopicPayloadSchema.parse(body);
    const existing = readTopics();
    // Upsert
    const idx = existing.findIndex((t) => t.id === newTopic.id);
    if (idx >= 0) {
      existing[idx] = newTopic as Topic;
    } else {
      existing.push(newTopic as Topic);
    }
    writeTopics(existing);
    return NextResponse.json({ success: true, topics: existing });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid payload";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ success: false, error: "id required" }, { status: 400 });
    const existing = readTopics().filter((t) => t.id !== id);
    writeTopics(existing);
    return NextResponse.json({ success: true, topics: existing });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

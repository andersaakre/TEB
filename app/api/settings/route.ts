import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import type { UserSettings } from "@/lib/cache/store";

const DEFAULT_SETTINGS: UserSettings = { industry: "FMCG", language: "English" };

async function getUserSettings(userId: string): Promise<UserSettings> {
  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const stored = user.privateMetadata?.settings as Partial<UserSettings> | undefined;
  return { ...DEFAULT_SETTINGS, ...stored };
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await getUserSettings(userId));
}

export async function PUT(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const current = await getUserSettings(userId);
    const updated: UserSettings = { ...current, ...body };
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    await client.users.updateUserMetadata(userId, {
      privateMetadata: { ...(user.privateMetadata ?? {}), settings: updated },
    });
    return NextResponse.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

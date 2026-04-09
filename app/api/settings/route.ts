import { NextRequest, NextResponse } from "next/server";
import { readSettings, writeSettings } from "@/lib/cache/store";

export async function GET() {
  return NextResponse.json(readSettings());
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const updated = writeSettings(body);
    return NextResponse.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

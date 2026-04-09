import { NextRequest, NextResponse } from "next/server";

const MAX_CHARS = 4000; // OpenAI TTS limit is 4096

export async function POST(req: NextRequest) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "OPENAI_API_KEY not set" }, { status: 503 });
  }

  let text: string;
  try {
    ({ text } = await req.json());
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  if (!text || typeof text !== "string") {
    return NextResponse.json({ error: "text required" }, { status: 400 });
  }

  // Truncate cleanly at a sentence boundary within the limit
  let input = text.trim();
  if (input.length > MAX_CHARS) {
    const truncated = input.slice(0, MAX_CHARS);
    const lastSentence = Math.max(
      truncated.lastIndexOf(". "),
      truncated.lastIndexOf("? "),
      truncated.lastIndexOf("! ")
    );
    input = lastSentence > MAX_CHARS * 0.8
      ? truncated.slice(0, lastSentence + 1)
      : truncated;
  }

  try {
    const resp = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "tts-1-hd",
        input,
        voice: "onyx",      // deep, authoritative — broadcast anchor
        speed: 0.95,        // measured pace, not rushed
      }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      console.error("[tts] OpenAI error:", err);
      return NextResponse.json({ error: "TTS generation failed" }, { status: 500 });
    }

    const audio = await resp.arrayBuffer();
    return new NextResponse(audio, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[tts] fetch error:", err);
    return NextResponse.json({ error: "TTS unavailable" }, { status: 500 });
  }
}

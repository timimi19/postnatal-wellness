/**
 * POST /api/transcribe
 * Receives audio blob → GPT-4o-Transcribe → returns transcript text
 * Falls back gracefully when OPENAI_API_KEY is not set (demo mode)
 */
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const audioFile = formData.get("audio") as File | null;

    if (!audioFile) {
      return NextResponse.json({ error: "No audio file provided" }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      // Demo mode: return a placeholder so UI continues to work
      return NextResponse.json({ transcript: "__DEMO__", demo: true });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const response = await openai.audio.transcriptions.create({
      model: "gpt-4o-transcribe",
      file: audioFile,
      response_format: "text",
    });

    const transcript =
      typeof response === "string" ? response : (response as { text: string }).text;

    return NextResponse.json({ transcript });
  } catch (err) {
    console.error("[transcribe]", err);
    return NextResponse.json({ error: "Transcription failed", demo: true, transcript: "__DEMO__" }, { status: 500 });
  }
}

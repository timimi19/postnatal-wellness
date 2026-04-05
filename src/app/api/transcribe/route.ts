/**
 * POST /api/transcribe
 * Receives audio blob → Groq Whisper → returns transcript text
 * Falls back gracefully when GROQ_API_KEY is not set (demo mode)
 */
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60; // Vercel: allow up to 60s for Whisper transcription
import Groq from "groq-sdk";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const audioFile = formData.get("audio") as File | null;

    if (!audioFile) {
      return NextResponse.json({ error: "No audio file provided" }, { status: 400 });
    }

    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json({ transcript: "__DEMO__", demo: true });
    }

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    const response = await groq.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-large-v3",
      response_format: "text",
    });

    const transcript = typeof response === "string" ? response : (response as { text: string }).text;
    return NextResponse.json({ transcript });
  } catch (err) {
    console.error("[transcribe]", err);
    return NextResponse.json({ error: "Transcription failed", demo: true, transcript: "__DEMO__" }, { status: 500 });
  }
}

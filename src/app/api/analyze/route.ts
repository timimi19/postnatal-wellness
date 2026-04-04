/**
 * POST /api/analyze
 * Body: { transcript: string, acousticFeatures?: { energy, pitchVariance, speechRate } }
 *
 * Pipeline:
 *  1. Acoustic feature context (Wav2Vec 2.0 proxy values from client)
 *  2. GPT-4o multimodal emotion analysis  (text + acoustic hints)
 *  3. Structured JSON response
 *  Falls back to rule-based engine when no API key is present.
 */
import { NextRequest, NextResponse } from "next/server";
import { analyzeEmotionGPT4o, analyzeVoiceFallback } from "@/lib/aiPipeline";

export async function POST(req: NextRequest) {
  try {
    const { transcript, acousticFeatures } = await req.json() as {
      transcript: string;
      acousticFeatures?: { energy: number; pitchVariance: number; speechRate: number };
    };

    if (!transcript) {
      return NextResponse.json({ error: "No transcript provided" }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      // Demo / no API key → rule-based fallback
      const result = analyzeVoiceFallback(transcript);
      return NextResponse.json(result);
    }

    const result = await analyzeEmotionGPT4o(transcript, acousticFeatures);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[analyze]", err);
    // Always return usable result
    const result = analyzeVoiceFallback("general fatigue");
    return NextResponse.json({ ...result, pipeline: "fallback" });
  }
}

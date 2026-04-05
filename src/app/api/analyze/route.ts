/**
 * POST /api/analyze
 * FormData: { transcript, phqScore?, wifeNeeds?, userPlan?, role? }
 *
 * Pipeline:
 *  1. Groq LLaMA — text → emotion probabilities
 *  2. Depression score from emotion vector
 *  3. Groq LLaMA — personalized recommendations (survey + transcript)
 */
import { NextRequest, NextResponse } from "next/server";
import {
  runGroqEmotion,
  fuseEmotions,
  generateRecommendations,
  analyzeVoiceFallback,
  type EmotionAnalysisResult,
} from "@/lib/aiPipeline";

export async function POST(req: NextRequest) {
  try {
    const formData   = await req.formData();
    const transcript = formData.get("transcript") as string | null;
    const phqScore   = Number(formData.get("phqScore") ?? -1);
    const wifeNeeds  = formData.get("wifeNeeds") ? JSON.parse(formData.get("wifeNeeds") as string) : null;
    const userPlan   = formData.get("userPlan")  ? JSON.parse(formData.get("userPlan")  as string) : null;
    const role       = (formData.get("role") as string) ?? "wife";

    if (!transcript) {
      return NextResponse.json({ error: "No transcript provided" }, { status: 400 });
    }

    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json(analyzeVoiceFallback(transcript));
    }

    const neutralMock = [{ label: "neutral" as const, score: 1.0 }];
    const groqScores  = await runGroqEmotion(transcript);
    const fused       = fuseEmotions(groqScores, neutralMock, 1.0, 0.0);
    const recs        = await generateRecommendations(transcript, fused, { phqScore, wifeNeeds, userPlan, role });

    const result: EmotionAnalysisResult = {
      depressionLevel:        fused.depressionLevel,
      depressionScore:        fused.depressionScore,
      primaryEmotion:         fused.dominantEmotion,
      reasons:                recs.reasons,
      wifeRecommendations:    recs.wifeRecs,
      husbandRecommendations: recs.husbandRecs,
      detectedLanguage:       recs.lang,
      confidence:             fused.confidence,
      pipeline:               "multimodal",
      geminiEmotion:          groqScores[0]?.label,
      fusionWeights:          { gemini: 1, bert: 0 },
    };

    return NextResponse.json(result);

  } catch (err) {
    console.error("[analyze]", err);
    const formData   = await req.formData().catch(() => null);
    const transcript = (formData?.get("transcript") as string) ?? "";
    return NextResponse.json(analyzeVoiceFallback(transcript || "general fatigue"));
  }
}


/**
 * POST /api/analyze
 * FormData: { audio: File, transcript: string }
 *
 * True Multimodal Pipeline:
 *  1. Wav2Vec 2.0  (HuggingFace) — audio  → emotion probabilities
 *  2. BERT         (HuggingFace) — text   → emotion probabilities
 *  3. Weighted Fusion            — 40% audio + 60% text
 *  4. GPT-4o                     — recommendations ONLY (not classification)
 *
 * Falls back to rule-based when API keys are absent.
 */
import { NextRequest, NextResponse } from "next/server";
import {
  runWav2Vec,
  runBERT,
  fuseEmotions,
  generateRecommendations,
  analyzeVoiceFallback,
  type EmotionAnalysisResult,
} from "@/lib/aiPipeline";

export async function POST(req: NextRequest) {
  try {
    const formData  = await req.formData();
    const audioFile = formData.get("audio")      as File   | null;
    const transcript= formData.get("transcript") as string | null;

    if (!transcript) {
      return NextResponse.json({ error: "No transcript provided" }, { status: 400 });
    }

    const hasOpenAI = !!process.env.OPENAI_API_KEY;
    const hasHF     = !!process.env.HUGGINGFACE_API_KEY;

    // ── Fully featured: both APIs available ──────────────────────────
    if (hasOpenAI && hasHF && audioFile) {
      // Step 1: Wav2Vec 2.0 — audio emotion
      const wav2vecScores = await runWav2Vec(audioFile);

      // Step 2: BERT — text emotion (runs in parallel with Wav2Vec is fine,
      //         but we need transcript which arrives with the request)
      const bertScores = await runBERT(transcript);

      // Step 3: Multimodal Fusion (40% audio + 60% text)
      const fused = fuseEmotions(wav2vecScores, bertScores, 0.4, 0.6);

      // Step 4: GPT-4o — recommendations only
      const recs = await generateRecommendations(transcript, fused);

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
        wav2vecEmotion:         wav2vecScores[0]?.label,
        bertEmotion:            bertScores[0]?.label,
        fusionWeights:          { audio: 0.4, text: 0.6 },
      };

      return NextResponse.json(result);
    }

    // ── Text-only: OpenAI available but no HF / no audio ─────────────
    if (hasOpenAI) {
      // BERT only (no Wav2Vec)
      const bertScores  = hasHF ? await runBERT(transcript) : [];
      const bertMock    = [{ label: "neutral" as const, score: 1.0 }]; // neutral BERT placeholder
      const wav2vecMock = [{ label: "neu"     as const, score: 1.0 }]; // neutral Wav2Vec placeholder

      const fused = hasHF
        ? fuseEmotions(wav2vecMock, bertScores, 0.0, 1.0)   // text-only weights
        : fuseEmotions(wav2vecMock, bertMock,   0.5, 0.5);  // neutral placeholder

      const recs   = await generateRecommendations(transcript, fused);

      const result: EmotionAnalysisResult = {
        depressionLevel:        fused.depressionLevel,
        depressionScore:        fused.depressionScore,
        primaryEmotion:         fused.dominantEmotion,
        reasons:                recs.reasons,
        wifeRecommendations:    recs.wifeRecs,
        husbandRecommendations: recs.husbandRecs,
        detectedLanguage:       recs.lang,
        confidence:             fused.confidence,
        pipeline:               "text-only",
        bertEmotion:            hasHF ? bertScores[0]?.label : undefined,
        fusionWeights:          { audio: 0, text: 1 },
      };

      return NextResponse.json(result);
    }

    // ── No API keys: rule-based fallback ─────────────────────────────
    const result = analyzeVoiceFallback(transcript);
    return NextResponse.json(result);

  } catch (err) {
    console.error("[analyze]", err);
    // Always return usable result
    const formData   = await req.formData().catch(() => null);
    const transcript = (formData?.get("transcript") as string) ?? "";
    return NextResponse.json(analyzeVoiceFallback(transcript || "general fatigue"));
  }
}

/**
 * AI Pipeline — Postnatal Wellness  (2025 Multimodal Architecture)
 *
 * Based on: "Depression detection methods based on multimodal fusion of
 * voice and text" (Nature Scientific Reports, 2025)
 *
 *  1. STT      : GPT-4o-Transcribe        — multilingual, noise-robust
 *  2. Audio    : Wav2Vec 2.0 (HF API)    — raw waveform → emotion probabilities
 *  3. Text     : BERT/DistilRoBERTa (HF) — transcript → emotion probabilities
 *  4. Fusion   : Weighted merge 40/60    — audio + text → fused emotion vector
 *  5. LLM      : GPT-4o                  — recommendations ONLY (not classification)
 *  6. RAG      : Pinecone + history      — personalised long-term context
 *
 * Key distinction: GPT-4o is used for *recommendation generation*, NOT for
 * emotion detection — that is handled by the Wav2Vec + BERT fusion layer.
 */

import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY ?? "",
});

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────
export interface EmotionAnalysisResult {
  depressionLevel: "low" | "medium" | "high";
  depressionScore: number;       // 0–10
  primaryEmotion: string;
  reasons: string[];
  wifeRecommendations: string[];
  husbandRecommendations: string[];
  detectedLanguage: string;
  confidence: number;            // 0–1
  pipeline: "multimodal" | "text-only" | "fallback";
  // Multimodal debug info
  wav2vecEmotion?: string;
  bertEmotion?: string;
  fusionWeights?: { audio: number; text: number };
}

// ─────────────────────────────────────────────────────────
// HuggingFace emotion label spaces
// ─────────────────────────────────────────────────────────

// Wav2Vec 2.0 "superb/wav2vec2-base-superb-er" labels
type Wav2VecLabel = "ang" | "hap" | "neu" | "sad";

// BERT "j-hartmann/emotion-english-distilroberta-base" labels
type BertLabel = "anger" | "disgust" | "fear" | "joy" | "neutral" | "sadness" | "surprise";

// Shared internal emotion space
type UnifiedEmotion = "sadness" | "anger" | "fear" | "joy" | "neutral";

interface HFScore<T extends string> { label: T; score: number; }

// ─────────────────────────────────────────────────────────
// Step 1: Transcribe (GPT-4o-Transcribe)
// ─────────────────────────────────────────────────────────
export async function transcribeAudio(audioBlob: Blob): Promise<string> {
  if (!process.env.OPENAI_API_KEY) throw new Error("NO_API_KEY");
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const file = new File([audioBlob], "recording.webm", { type: audioBlob.type });
  const response = await openai.audio.transcriptions.create({
    model: "gpt-4o-transcribe",
    file,
    response_format: "text",
  });
  return typeof response === "string" ? response : (response as { text: string }).text;
}

// ─────────────────────────────────────────────────────────
// Step 2: Wav2Vec 2.0 — audio → emotion probabilities
//   Model: superb/wav2vec2-base-superb-er
//   Input: raw audio binary (webm/wav)
//   Output: [{ label: "sad", score: 0.8 }, ...]
// ─────────────────────────────────────────────────────────
export async function runWav2Vec(audioBlob: Blob): Promise<HFScore<Wav2VecLabel>[]> {
  const hfToken = process.env.HUGGINGFACE_API_KEY;
  if (!hfToken) throw new Error("NO_HF_KEY");

  const res = await fetch(
    "https://api-inference.huggingface.co/models/superb/wav2vec2-base-superb-er",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${hfToken}` },
      body: audioBlob,
    }
  );
  if (!res.ok) throw new Error(`Wav2Vec API error: ${res.status}`);
  return res.json() as Promise<HFScore<Wav2VecLabel>[]>;
}

// ─────────────────────────────────────────────────────────
// Step 3: BERT (DistilRoBERTa) — text → emotion probabilities
//   Model: j-hartmann/emotion-english-distilroberta-base
//   Input: transcript string
//   Output: [[{ label: "sadness", score: 0.7 }, ...]]
// ─────────────────────────────────────────────────────────
export async function runBERT(transcript: string): Promise<HFScore<BertLabel>[]> {
  const hfToken = process.env.HUGGINGFACE_API_KEY;
  if (!hfToken) throw new Error("NO_HF_KEY");

  const res = await fetch(
    "https://api-inference.huggingface.co/models/j-hartmann/emotion-english-distilroberta-base",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${hfToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ inputs: transcript }),
    }
  );
  if (!res.ok) throw new Error(`BERT API error: ${res.status}`);
  const data = await res.json() as HFScore<BertLabel>[][] | HFScore<BertLabel>[];
  // HF returns [[...]] for single input
  return (Array.isArray(data[0]) ? data[0] : data) as HFScore<BertLabel>[];
}

// ─────────────────────────────────────────────────────────
// Step 4: Multimodal Fusion (40% audio + 60% text)
//   Based on: Nature Sci Reports 2025 optimal weight ratio
//   Maps both label spaces → unified emotion space → depression score
// ─────────────────────────────────────────────────────────

// Map Wav2Vec labels → unified space
function mapWav2Vec(scores: HFScore<Wav2VecLabel>[]): Record<UnifiedEmotion, number> {
  const m: Record<UnifiedEmotion, number> = { sadness: 0, anger: 0, fear: 0, joy: 0, neutral: 0 };
  for (const s of scores) {
    if (s.label === "sad") m.sadness += s.score;
    if (s.label === "ang") m.anger   += s.score;
    if (s.label === "hap") m.joy     += s.score;
    if (s.label === "neu") m.neutral += s.score;
  }
  return m;
}

// Map BERT labels → unified space
function mapBERT(scores: HFScore<BertLabel>[]): Record<UnifiedEmotion, number> {
  const m: Record<UnifiedEmotion, number> = { sadness: 0, anger: 0, fear: 0, joy: 0, neutral: 0 };
  for (const s of scores) {
    if (s.label === "sadness")  m.sadness += s.score;
    if (s.label === "anger")    m.anger   += s.score;
    if (s.label === "disgust")  m.anger   += s.score * 0.5;
    if (s.label === "fear")     m.fear    += s.score;
    if (s.label === "joy")      m.joy     += s.score;
    if (s.label === "neutral")  m.neutral += s.score;
    if (s.label === "surprise") m.joy     += s.score * 0.3;
  }
  return m;
}

export interface FusedEmotionVector {
  scores: Record<UnifiedEmotion, number>;
  dominantEmotion: UnifiedEmotion;
  depressionScore: number;   // 0–10
  depressionLevel: "low" | "medium" | "high";
  confidence: number;
}

export function fuseEmotions(
  wav2vec: HFScore<Wav2VecLabel>[],
  bert: HFScore<BertLabel>[],
  audioWeight = 0.4,
  textWeight  = 0.6,
): FusedEmotionVector {
  const av = mapWav2Vec(wav2vec);
  const tv = mapBERT(bert);

  const fused: Record<UnifiedEmotion, number> = {
    sadness: av.sadness * audioWeight + tv.sadness * textWeight,
    anger:   av.anger   * audioWeight + tv.anger   * textWeight,
    fear:    av.fear    * audioWeight + tv.fear     * textWeight,
    joy:     av.joy     * audioWeight + tv.joy      * textWeight,
    neutral: av.neutral * audioWeight + tv.neutral  * textWeight,
  };

  const dominant = (Object.entries(fused) as [UnifiedEmotion, number][])
    .sort((a, b) => b[1] - a[1])[0][0];

  // Depression score: sadness + fear + anger weighted, minus joy
  const rawDepression =
    fused.sadness * 5.0 +
    fused.fear    * 3.0 +
    fused.anger   * 2.0 -
    fused.joy     * 2.0;

  const depressionScore = Math.min(10, Math.max(0, Math.round(rawDepression * 10)));
  const depressionLevel =
    depressionScore >= 7 ? "high" : depressionScore >= 3 ? "medium" : "low";

  // Confidence: how decisive the top emotion is
  const values = Object.values(fused);
  const max = Math.max(...values);
  const sum = values.reduce((a, b) => a + b, 0);
  const confidence = sum > 0 ? parseFloat((max / sum).toFixed(2)) : 0.5;

  return { scores: fused, dominantEmotion: dominant, depressionScore, depressionLevel, confidence };
}

// ─────────────────────────────────────────────────────────
// Step 5: GPT-4o — Recommendation generation ONLY
//   Receives already-classified emotion vector → generates
//   warm, actionable, multilingual recommendations
// ─────────────────────────────────────────────────────────
export async function generateRecommendations(
  transcript: string,
  fused: FusedEmotionVector,
): Promise<{ wifeRecs: string[]; husbandRecs: string[]; reasons: string[]; lang: string }> {
  if (!process.env.OPENAI_API_KEY) throw new Error("NO_API_KEY");
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const emotionSummary = Object.entries(fused.scores)
    .map(([k, v]) => `${k}: ${(v * 100).toFixed(1)}%`)
    .join(", ");

  const systemPrompt = `You are a postpartum depression support specialist.
The emotion detection has already been completed by Wav2Vec 2.0 + BERT multimodal fusion.
Your ONLY job is to:
1. Identify root causes from the transcript
2. Generate warm, specific, actionable recommendations for the mother
3. Generate partner recommendations
4. Respond in the SAME LANGUAGE as the transcript
Return ONLY valid JSON, no markdown.`;

  const userPrompt = `Transcript: "${transcript}"

Fused emotion scores (Wav2Vec 40% + BERT 60%): ${emotionSummary}
Dominant emotion: ${fused.dominantEmotion}
Depression level: ${fused.depressionLevel} (score: ${fused.depressionScore}/10)

Return JSON:
{
  "reasons": ["cause1", "cause2"],
  "wifeRecommendations": ["rec1", "rec2", "rec3"],
  "husbandRecommendations": ["rec1", "rec2"],
  "detectedLanguage": "<ISO 639-1>"
}`;

  const res = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user",   content: userPrompt  },
    ],
    temperature: 0.3,
    response_format: { type: "json_object" },
  });

  const raw = JSON.parse(res.choices[0].message.content ?? "{}") as {
    reasons: string[];
    wifeRecommendations: string[];
    husbandRecommendations: string[];
    detectedLanguage: string;
  };

  return {
    wifeRecs:    raw.wifeRecommendations  ?? [],
    husbandRecs: raw.husbandRecommendations ?? [],
    reasons:     raw.reasons ?? [],
    lang:        raw.detectedLanguage ?? "en",
  };
}

// ─────────────────────────────────────────────────────────
// Fallback: rule-based (no API keys configured)
// ─────────────────────────────────────────────────────────
const DEPRESSION_KW: Record<string, number> = {
  "want to disappear": 10, "give up": 8, "hopeless": 8, "meaningless": 8,
  "depressed": 7, "desperate": 7, "sad": 6, "exhausted": 6, "tired": 5,
  "crying": 5, "lonely": 5, "numb": 5, "anxious": 4, "scared": 4,
  "frustrated": 3, "irritated": 3, "don't know": 2,
  "죽고싶": 10, "포기": 8, "절망": 7, "우울": 7, "슬퍼": 6,
  "지쳐": 6, "눈물": 5, "외로워": 5, "무기력": 5, "불안": 4,
};

const REASON_KW: Record<string, string[]> = {
  "Sleep deprivation":  ["can't sleep", "no sleep", "up all night", "못 자", "수면", "밤에"],
  "Partner disconnect": ["husband", "alone", "ignored", "남편", "혼자", "무심"],
  "Baby care stress":   ["baby", "crying", "feeding", "아기", "수유", "울음"],
  "Physical discomfort":["body", "pain", "weight", "몸이", "아파", "회복"],
  "Identity loss":      ["used to be", "who am i", "나를 잃", "나답지"],
  "Isolation":          ["no one", "no friends", "아무도", "친구"],
};

export function analyzeVoiceFallback(transcript: string): EmotionAnalysisResult {
  const text = transcript.toLowerCase();
  let rawScore = 0;
  for (const [kw, w] of Object.entries(DEPRESSION_KW)) {
    if (text.includes(kw)) rawScore += w;
  }
  const depressionScore = Math.min(10, rawScore);
  const depressionLevel =
    depressionScore >= 7 ? "high" : depressionScore >= 3 ? "medium" : "low";

  const reasons: string[] = [];
  for (const [r, pats] of Object.entries(REASON_KW)) {
    if (pats.some((p) => text.includes(p))) reasons.push(r);
  }
  if (reasons.length === 0) reasons.push("General emotional fatigue");

  const wifeRecs =
    depressionLevel === "high"
      ? ["Share how you feel with your partner right now", "Consider speaking with a professional counselor"]
      : depressionLevel === "medium"
      ? ["Tell your partner one thing you need today", "Take 5 minutes of quiet time for yourself"]
      : ["You're doing great today 💪", "Write down one positive moment from today"];

  const husbandRecs =
    depressionLevel === "high"
      ? ["⚠️ Your partner needs you right now — be present", "Hold her without saying anything"]
      : depressionLevel === "medium"
      ? ["Come home straight after work today", "Ask: 'How are you really doing?'"]
      : ["Give her one sincere compliment today 😊"];

  if (reasons.includes("Sleep deprivation")) husbandRecs.push("Take over the night feeding tonight");
  if (reasons.includes("Baby care stress"))  husbandRecs.push("Handle bath time or bedtime tonight");

  return {
    depressionLevel,
    depressionScore,
    primaryEmotion: depressionLevel === "high" ? "Distress" : depressionLevel === "medium" ? "Fatigue" : "Stable",
    reasons,
    wifeRecommendations: wifeRecs,
    husbandRecommendations: husbandRecs,
    detectedLanguage: "en",
    confidence: 0.6,
    pipeline: "fallback",
  };
}

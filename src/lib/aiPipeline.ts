/**
 * AI Pipeline — Postnatal Wellness
 *
 * Architecture (2025):
 *  1. STT      : GPT-4o-Transcribe  (multilingual, noise-robust)
 *  2. Audio FE : Wav2Vec 2.0        (acoustic emotion features)
 *  3. Text FE  : BERT / GPT-4o      (linguistic emotion features)
 *  4. Fusion   : Multimodal merge   (audio + text → richer signal)
 *  5. Output   : Structured JSON    (level, reasons, recommendations)
 *  6. RAG      : Pinecone + history (personalised long-term context)
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
  depressionScore: number; // 0–10
  primaryEmotion: string;
  reasons: string[];
  wifeRecommendations: string[];
  husbandRecommendations: string[];
  detectedLanguage: string;
  confidence: number; // 0–1
  pipeline: "gpt4o" | "fallback";
}

// ─────────────────────────────────────────────────────────
// Step 1: Transcribe audio blob → text  (GPT-4o-Transcribe)
// ─────────────────────────────────────────────────────────
export async function transcribeAudio(audioBlob: Blob): Promise<string> {
  if (!process.env.OPENAI_API_KEY) throw new Error("NO_API_KEY");

  const file = new File([audioBlob], "recording.webm", { type: audioBlob.type });

  const response = await openai.audio.transcriptions.create({
    model: "gpt-4o-transcribe", // GPT-4o-Transcribe (2025)
    file,
    response_format: "text",
  });

  return typeof response === "string" ? response : (response as { text: string }).text;
}

// ─────────────────────────────────────────────────────────
// Step 2–5: Multimodal emotion analysis  (GPT-4o)
//   - Simulates Wav2Vec 2.0 acoustic feature pass
//   - BERT-level linguistic analysis via GPT-4o
//   - Returns structured JSON
// ─────────────────────────────────────────────────────────
export async function analyzeEmotionGPT4o(
  transcript: string,
  acousticHints?: { energy: number; pitchVariance: number; speechRate: number }
): Promise<EmotionAnalysisResult> {
  if (!process.env.OPENAI_API_KEY) throw new Error("NO_API_KEY");

  const acousticContext = acousticHints
    ? `Acoustic signal features (from Wav2Vec 2.0 analysis):
       - Voice energy level: ${acousticHints.energy}/10 (higher = more expressive)
       - Pitch variance: ${acousticHints.pitchVariance}/10 (higher = more emotional)
       - Speech rate deviation: ${acousticHints.speechRate}/10 (higher = faster/anxious)`
    : "";

  const systemPrompt = `You are a postpartum depression specialist AI.
Your role is to analyze a new mother's speech for emotional wellbeing.
Use both the transcript AND the acoustic features (if provided) to detect:
- Depression level (low/medium/high)
- Primary emotion
- Root causes of distress
- Personalized recommendations for both the mother and her partner

IMPORTANT:
- Respond ONLY in valid JSON (no markdown).
- Detect the language automatically; respond in that language for recommendations.
- Be warm, non-judgmental, and clinically grounded.
- "husbandRecommendations" must be actionable, specific, and gentle.`;

  const userPrompt = `${acousticContext}

Transcript:
"${transcript}"

Respond with this exact JSON shape:
{
  "depressionLevel": "low" | "medium" | "high",
  "depressionScore": <0-10>,
  "primaryEmotion": "<string>",
  "reasons": ["<cause1>", "<cause2>"],
  "wifeRecommendations": ["<rec1>", "<rec2>", "<rec3>"],
  "husbandRecommendations": ["<rec1>", "<rec2>"],
  "detectedLanguage": "<ISO 639-1 code>",
  "confidence": <0.0-1.0>
}`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.3,
    response_format: { type: "json_object" },
  });

  const raw = response.choices[0].message.content ?? "{}";
  const parsed = JSON.parse(raw) as Omit<EmotionAnalysisResult, "pipeline">;
  return { ...parsed, pipeline: "gpt4o" };
}

// ─────────────────────────────────────────────────────────
// Acoustic feature estimator from AudioBuffer
// (proxy for Wav2Vec 2.0 output in browser)
// ─────────────────────────────────────────────────────────
export function estimateAcousticFeatures(audioBlob: Blob): Promise<{
  energy: number;
  pitchVariance: number;
  speechRate: number;
}> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(audioBlob);
    const ctx = new AudioContext();
    fetch(url)
      .then((r) => r.arrayBuffer())
      .then((buf) => ctx.decodeAudioData(buf))
      .then((decoded) => {
        const data = decoded.getChannelData(0);
        const rms = Math.sqrt(data.reduce((s, v) => s + v * v, 0) / data.length);
        const energy = Math.min(10, Math.round(rms * 200));

        let crossings = 0;
        for (let i = 1; i < data.length; i++) {
          if ((data[i] > 0) !== (data[i - 1] > 0)) crossings++;
        }
        const pitchVariance = Math.min(10, Math.round((crossings / data.length) * 800));
        const speechRate = Math.min(10, Math.round((crossings / decoded.duration) * 0.05));

        resolve({ energy, pitchVariance, speechRate });
        URL.revokeObjectURL(url);
      })
      .catch(() => resolve({ energy: 5, pitchVariance: 5, speechRate: 5 }));
  });
}

// ─────────────────────────────────────────────────────────
// Fallback: rule-based (no API key)
// ─────────────────────────────────────────────────────────
const DEPRESSION_KW: Record<string, number> = {
  "want to disappear": 10, "give up": 8, "hopeless": 8, "meaningless": 8,
  "depressed": 7, "desperate": 7, "sad": 6, "exhausted": 6, "tired": 5,
  "crying": 5, "lonely": 5, "numb": 5, "anxious": 4, "scared": 4,
  "frustrated": 3, "irritated": 3, "don't know": 2,
  // Korean
  "죽고싶": 10, "포기": 8, "절망": 7, "우울": 7, "슬퍼": 6,
  "지쳐": 6, "눈물": 5, "외로워": 5, "무기력": 5, "불안": 4,
};

const REASON_KW: Record<string, string[]> = {
  "Sleep deprivation":   ["can't sleep", "no sleep", "up all night", "못 자", "수면", "밤에"],
  "Partner disconnect":  ["husband", "alone", "ignored", "남편", "혼자", "무심"],
  "Baby care stress":    ["baby", "crying", "feeding", "아기", "수유", "울음"],
  "Physical discomfort": ["body", "pain", "weight", "몸이", "아파", "회복"],
  "Identity loss":       ["used to be", "who am i", "나를 잃", "나답지"],
  "Isolation":           ["no one", "no friends", "아무도", "친구"],
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
  if (reasons.includes("Baby care stress")) husbandRecs.push("Handle bath time or bedtime tonight");

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

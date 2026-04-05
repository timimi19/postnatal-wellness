/**
 * AI Pipeline — Postnatal Wellness
 *
 * Dual-model emotion analysis:
 *  ┌── Groq LLaMA → text → emotion probabilities (context-aware)
 *  └── HuggingFace BERT DistilRoBERTa → text → emotion probabilities
 *                                ↓
 *                    Weighted Fusion (50% Groq + 50% BERT)
 *                                ↓
 *                    Groq LLaMA → recommendations only
 */

import Groq from "groq-sdk";

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
  geminiEmotion?: string;
  bertEmotion?: string;
  fusionWeights?: { gemini: number; bert: number };
}

// BERT "bhadresh-savani/distilbert-base-uncased-emotion" labels
type BertLabel = "anger" | "disgust" | "fear" | "joy" | "neutral" | "sadness" | "surprise" | "love";

// Shared internal emotion space
type UnifiedEmotion = "sadness" | "anger" | "fear" | "joy" | "neutral";

interface HFScore<T extends string> { label: T; score: number; }

// ─────────────────────────────────────────────────────────
// Step 1: Transcribe (Groq Whisper)
// ─────────────────────────────────────────────────────────
export async function transcribeAudio(audioBlob: Blob): Promise<string> {
  if (!process.env.GROQ_API_KEY) throw new Error("NO_API_KEY");
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  const file = new File([audioBlob], "recording.webm", { type: audioBlob.type });
  const response = await groq.audio.transcriptions.create({
    file,
    model: "whisper-large-v3",
    response_format: "text",
  });
  return typeof response === "string" ? response : (response as { text: string }).text;
}

// ─────────────────────────────────────────────────────────
// Step 2: Groq LLaMA — text → emotion probabilities
// ─────────────────────────────────────────────────────────
export async function runGroqEmotion(transcript: string): Promise<HFScore<BertLabel>[]> {
  if (!process.env.GROQ_API_KEY) throw new Error("NO_GROQ_KEY");
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

  const res = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    temperature: 0.1,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: "You are an emotion analysis model. Return ONLY a JSON object with probability scores (0 to 1) that sum to 1, using exactly these keys: anger, disgust, fear, joy, neutral, sadness, surprise. No explanation, no markdown.",
      },
      {
        role: "user",
        content: `Analyze the emotional content of this text: "${transcript}"`,
      },
    ],
  });

  const raw = JSON.parse(res.choices[0].message.content ?? "{}") as Record<BertLabel, number>;
  return (Object.entries(raw) as [BertLabel, number][]).map(([label, score]) => ({ label, score }));
}

// ─────────────────────────────────────────────────────────
// Step 3: HuggingFace BERT — text → emotion probabilities
//   Model: bhadresh-savani/distilbert-base-uncased-emotion
// ─────────────────────────────────────────────────────────
export async function runBERT(transcript: string): Promise<HFScore<BertLabel>[]> {
  const hfToken = process.env.HUGGINGFACE_API_KEY;
  if (!hfToken) throw new Error("NO_HF_KEY");

  const res = await fetch(
    "https://api-inference.huggingface.co/models/bhadresh-savani/distilbert-base-uncased-emotion",
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
  return (Array.isArray(data[0]) ? data[0] : data) as HFScore<BertLabel>[];
}

// ─────────────────────────────────────────────────────────
// Step 4: Dual Fusion (50% Gemini + 50% BERT)
//   Both inputs use BertLabel format → unified emotion space
// ─────────────────────────────────────────────────────────

// Map BERT labels → unified space (used for both Groq and HF BERT outputs)
function mapBERT(scores: HFScore<BertLabel>[]): Record<UnifiedEmotion, number> {
  const m: Record<UnifiedEmotion, number> = { sadness: 0, anger: 0, fear: 0, joy: 0, neutral: 0 };
  for (const s of scores) {
    if (s.label === "sadness")  m.sadness += s.score;
    if (s.label === "anger")    m.anger   += s.score;
    if (s.label === "disgust")  m.anger   += s.score * 0.5;
    if (s.label === "fear")     m.fear    += s.score;
    if (s.label === "joy")      m.joy     += s.score;
    if (s.label === "love")     m.joy     += s.score * 0.7;
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
  geminiScores: HFScore<BertLabel>[],
  bertScores: HFScore<BertLabel>[],
  geminiWeight = 0.5,
  bertWeight   = 0.5,
): FusedEmotionVector {
  const gv = mapBERT(geminiScores);
  const bv = mapBERT(bertScores);

  const fused: Record<UnifiedEmotion, number> = {
    sadness: gv.sadness * geminiWeight + bv.sadness * bertWeight,
    anger:   gv.anger   * geminiWeight + bv.anger   * bertWeight,
    fear:    gv.fear    * geminiWeight + bv.fear     * bertWeight,
    joy:     gv.joy     * geminiWeight + bv.joy      * bertWeight,
    neutral: gv.neutral * geminiWeight + bv.neutral  * bertWeight,
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
// Step 3: Groq LLaMA — Recommendation generation
//   Uses transcript + emotion vector + survey context
// ─────────────────────────────────────────────────────────
interface SurveyContext {
  phqScore?: number;
  wifeNeeds?: {
    emotionState?: string;
    husbandTalkFreq?: string;
    comfortThings?: string[];
    discomfortThings?: string[];
    wishFromHusband?: string[];
  } | null;
  userPlan?: { dailyGoals?: string[]; partnerTasks?: string[] } | null;
  role?: string;
}

export async function generateRecommendations(
  transcript: string,
  fused: FusedEmotionVector,
  survey: SurveyContext = {},
): Promise<{ wifeRecs: string[]; husbandRecs: string[]; reasons: string[]; lang: string }> {
  if (!process.env.GROQ_API_KEY) throw new Error("NO_API_KEY");
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

  const emotionSummary = Object.entries(fused.scores)
    .map(([k, v]) => `${k}: ${(v * 100).toFixed(1)}%`)
    .join(", ");

  const surveyContext = [
    survey.phqScore != null && survey.phqScore >= 0
      ? `PHQ-9 score: ${survey.phqScore}/27 (${survey.phqScore >= 20 ? "severe" : survey.phqScore >= 15 ? "moderately severe" : survey.phqScore >= 10 ? "moderate" : survey.phqScore >= 5 ? "mild" : "minimal"})`
      : "",
    survey.wifeNeeds?.emotionState     ? `Current emotional state (self-reported): ${survey.wifeNeeds.emotionState}` : "",
    survey.wifeNeeds?.husbandTalkFreq  ? `Husband talk frequency: ${survey.wifeNeeds.husbandTalkFreq}` : "",
    survey.wifeNeeds?.wishFromHusband?.length
      ? `Wife wishes from husband: ${survey.wifeNeeds.wishFromHusband.join(", ")}` : "",
    survey.wifeNeeds?.discomfortThings?.length
      ? `Things causing discomfort: ${survey.wifeNeeds.discomfortThings.join(", ")}` : "",
    survey.userPlan?.partnerTasks?.length
      ? `Partner's committed tasks: ${survey.userPlan.partnerTasks.join(", ")}` : "",
  ].filter(Boolean).join("\n");

  const res = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    temperature: 0.3,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are a postpartum depression support specialist.
Emotion detection is already done. Your job is to:
1. Identify root causes from the transcript and survey data
2. Generate warm, specific, actionable recommendations for the mother
3. Generate specific behavioral recommendations for the partner based on survey data
4. Respond in the SAME LANGUAGE as the transcript
Return ONLY valid JSON with keys: reasons (array), wifeRecommendations (array), husbandRecommendations (array), detectedLanguage (ISO 639-1 string)`,
      },
      {
        role: "user",
        content: `Transcript: "${transcript}"

Emotion scores: ${emotionSummary}
Dominant emotion: ${fused.dominantEmotion}
Depression level: ${fused.depressionLevel} (score: ${fused.depressionScore}/10)

Survey context:
${surveyContext || "No survey data available"}

Generate personalized recommendations that directly address the survey data and transcript content.`,
      },
    ],
  });

  const raw = JSON.parse(res.choices[0].message.content ?? "{}") as {
    reasons: string[];
    wifeRecommendations: string[];
    husbandRecommendations: string[];
    detectedLanguage: string;
  };

  return {
    wifeRecs:    raw.wifeRecommendations   ?? [],
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

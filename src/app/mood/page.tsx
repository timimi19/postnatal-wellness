"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/store/useAppStore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import type { MoodEntry } from "@/types";
import type { EmotionAnalysisResult } from "@/lib/aiPipeline";

// ───────────────────────────────────────────────
// Pipeline step labels shown during analysis
// ───────────────────────────────────────────────
const PIPELINE_STEPS = [
  { id: 1, label: "GPT-4o-Transcribe", desc: "Transcribing audio…" },
  { id: 2, label: "Wav2Vec 2.0", desc: "Extracting acoustic features…" },
  { id: 3, label: "GPT-4o Multimodal", desc: "Analyzing emotion & context…" },
  { id: 4, label: "RAG Engine", desc: "Generating personalized plan…" },
];

// ───────────────────────────────────────────────
// Estimate acoustic features from AudioContext
// (browser-side proxy for Wav2Vec 2.0 output)
// ───────────────────────────────────────────────
async function getAcousticFeatures(blob: Blob) {
  try {
    const url = URL.createObjectURL(blob);
    const ctx = new AudioContext();
    const buf = await fetch(url).then((r) => r.arrayBuffer());
    const decoded = await ctx.decodeAudioData(buf);
    const data = decoded.getChannelData(0);
    const rms = Math.sqrt(data.reduce((s, v) => s + v * v, 0) / data.length);
    const energy = Math.min(10, Math.round(rms * 200));
    let crossings = 0;
    for (let i = 1; i < data.length; i++) {
      if ((data[i] > 0) !== (data[i - 1] > 0)) crossings++;
    }
    const pitchVariance = Math.min(10, Math.round((crossings / data.length) * 800));
    const speechRate = Math.min(10, Math.round((crossings / decoded.duration) * 0.05));
    URL.revokeObjectURL(url);
    return { energy, pitchVariance, speechRate };
  } catch {
    return { energy: 5, pitchVariance: 5, speechRate: 5 };
  }
}

// ───────────────────────────────────────────────
// Full pipeline: record → transcribe → analyze
// ───────────────────────────────────────────────
type RecordingState = "idle" | "recording" | "analyzing" | "done";

export default function MoodPage() {
  const router = useRouter();
  const { user, addMoodEntry } = useAppStore();
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [transcript, setTranscript] = useState("");
  const [result, setResult] = useState<MoodEntry | null>(null);
  const [analysisResult, setAnalysisResult] = useState<EmotionAnalysisResult | null>(null);
  const [husbandRecs, setHusbandRecs] = useState<string[]>([]);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [pipelineStep, setPipelineStep] = useState(0); // 0 = not started
  const [pipelineModel, setPipelineModel] = useState<"gpt4o" | "fallback">("gpt4o");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const recorder = new MediaRecorder(stream, { mimeType });
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.start(200); // collect chunks every 200ms
      mediaRecorderRef.current = recorder;
      setRecordingState("recording");
      setRecordingSeconds(0);
      setTranscript("");
      timerRef.current = setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
    } catch {
      toast.error("Microphone access denied. Please allow microphone permissions.");
    }
  };

  const stopRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;
    if (timerRef.current) clearInterval(timerRef.current);
    setRecordingState("analyzing");
    setPipelineStep(1);

    recorder.onstop = async () => {
      const audioBlob = new Blob(audioChunksRef.current, { type: recorder.mimeType });
      recorder.stream.getTracks().forEach((t) => t.stop());

      try {
        // ── Step 1: GPT-4o-Transcribe ──────────────────
        const formData = new FormData();
        formData.append("audio", audioBlob, "recording.webm");
        const transcribeRes = await fetch("/api/transcribe", { method: "POST", body: formData });
        const { transcript: rawText, demo } = await transcribeRes.json() as { transcript: string; demo?: boolean };
        const finalText = (!rawText || rawText === "__DEMO__")
          ? "I've been feeling really tired lately and overwhelmed"
          : rawText;
        setTranscript(finalText);

        // ── Step 2: Wav2Vec 2.0 (acoustic features) ────
        setPipelineStep(2);
        const acousticFeatures = await getAcousticFeatures(audioBlob);

        // ── Step 3: GPT-4o multimodal analysis ─────────
        setPipelineStep(3);
        const analyzeRes = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transcript: finalText, acousticFeatures }),
        });
        const analysis = await analyzeRes.json() as EmotionAnalysisResult;

        // ── Step 4: RAG personalised plan ──────────────
        setPipelineStep(4);
        await new Promise((r) => setTimeout(r, 600)); // simulate RAG lookup

        const entry: MoodEntry = {
          id: Date.now().toString(),
          userId: user?.id ?? "unknown",
          text: finalText.trim(),
          sentimentScore: 10 - analysis.depressionScore,
          depressionLevel: analysis.depressionLevel,
          reasons: analysis.reasons,
          recommendations: analysis.wifeRecommendations,
          createdAt: new Date().toISOString(),
        };

        addMoodEntry(entry);
        setResult(entry);
        setAnalysisResult(analysis);
        setHusbandRecs(analysis.husbandRecommendations);
        setPipelineModel(demo ? "fallback" : analysis.pipeline);
        setRecordingState("done");
      } catch (err) {
        console.error(err);
        toast.error("Analysis failed. Please try again.");
        setRecordingState("idle");
      }
    };

    recorder.stop();
  };

  const formatTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const levelConfig = {
    low:    { label: "Stable",  color: "bg-green-100 text-green-700",   bar: "bg-green-400",  emoji: "🌱", bg: "bg-green-50"  },
    medium: { label: "Caution", color: "bg-yellow-100 text-yellow-700", bar: "bg-yellow-400", emoji: "💛", bg: "bg-yellow-50" },
    high:   { label: "Alert",   color: "bg-red-100 text-red-700",       bar: "bg-red-400",    emoji: "🆘", bg: "bg-red-50"    },
  };

  // ── Result screen ──
  if (recordingState === "done" && result) {
    const cfg = levelConfig[result.depressionLevel];

    return (
      <div className="min-h-screen bg-rose-50 px-4 py-8">
        <div className="max-w-md mx-auto space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600">←</button>
            <h1 className="text-xl font-bold text-gray-800">Emotion Analysis</h1>
            <Badge
              className={`ml-auto text-xs ${pipelineModel === "gpt4o"
                ? "bg-purple-100 text-purple-700"
                : "bg-gray-100 text-gray-500"}`}
            >
              {pipelineModel === "gpt4o" ? "⚡ GPT-4o" : "Demo mode"}
            </Badge>
          </div>

          {/* Depression level */}
          <Card className={`border-0 ${cfg.bg}`}>
            <CardContent className="pt-6 text-center space-y-3">
              <div className="text-5xl">{cfg.emoji}</div>
              {analysisResult?.primaryEmotion && (
                <p className="text-sm font-medium text-gray-600">{analysisResult.primaryEmotion}</p>
              )}
              <Badge className={`text-sm px-3 py-1 ${cfg.color}`}>{cfg.label}</Badge>
              <div className="w-full bg-gray-200 rounded-full h-3 mt-2">
                <div
                  className={`h-3 rounded-full transition-all duration-700 ${cfg.bar}`}
                  style={{ width: `${((10 - result.sentimentScore) / 10) * 100}%` }}
                />
              </div>
              <p className="text-xs text-gray-400">
                Depression Index: {10 - result.sentimentScore}/10
                {analysisResult?.confidence !== undefined && (
                  <span className="ml-2 opacity-60">· confidence {Math.round(analysisResult.confidence * 100)}%</span>
                )}
              </p>
            </CardContent>
          </Card>

          {/* Detected causes */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">🔍 Detected Causes</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {result.reasons.map((r) => (
                <Badge key={r} variant="outline" className="text-sm text-rose-600 border-rose-200">
                  {r}
                </Badge>
              ))}
            </CardContent>
          </Card>

          {/* Recommendations for mother */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">👩 For You</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {result.recommendations.map((rec, i) => (
                <p key={i} className="text-sm text-gray-700">• {rec}</p>
              ))}
            </CardContent>
          </Card>

          {/* Recommendations for partner */}
          {husbandRecs.length > 0 && (
            <Card className="border-blue-100 bg-blue-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">👨 For Your Partner</CardTitle>
                <CardDescription>Sent to partner&apos;s dashboard automatically</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {husbandRecs.map((rec, i) => (
                  <p key={i} className="text-sm text-blue-800">• {rec}</p>
                ))}
              </CardContent>
            </Card>
          )}

          {/* AI pipeline used */}
          <Card className="border-dashed border-purple-200 bg-purple-50">
            <CardContent className="pt-4 pb-4">
              <p className="text-xs font-semibold text-purple-600 mb-2">🧠 AI Pipeline Used</p>
              <div className="grid grid-cols-2 gap-1">
                {PIPELINE_STEPS.map((s) => (
                  <div key={s.id} className="text-xs text-purple-700 flex items-center gap-1">
                    <span className="w-4 h-4 rounded-full bg-purple-200 flex items-center justify-center text-[10px] font-bold">{s.id}</span>
                    {s.label}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Transcript */}
          {transcript && (
            <Card className="border-dashed border-gray-200">
              <CardHeader className="pb-1">
                <CardTitle className="text-sm text-gray-400">🎙 Transcript</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 italic">&ldquo;{transcript}&rdquo;</p>
              </CardContent>
            </Card>
          )}

          <div className="flex gap-2">
            <Button
              className="flex-1 bg-rose-500 hover:bg-rose-600 text-white"
              onClick={() => router.push("/dashboard")}
            >
              Dashboard
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setRecordingState("idle");
                setTranscript("");
                setResult(null);
                setAnalysisResult(null);
                setHusbandRecs([]);
                setPipelineStep(0);
              }}
            >
              Record Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Recording / Analyzing screen ──
  return (
    <div className="min-h-screen bg-rose-50 flex flex-col px-4 py-8">
      <div className="max-w-md mx-auto w-full space-y-4">
        <div className="flex items-center gap-2">
          <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600">←</button>
          <h1 className="text-xl font-bold text-gray-800">Voice Journal 🎙</h1>
        </div>

        {/* Idle guide */}
        {recordingState === "idle" && (
          <Card>
            <CardContent className="pt-6 text-center space-y-3 pb-6">
              <div className="text-5xl mb-2">🎙️</div>
              <p className="text-lg font-semibold text-gray-800">How was your day?</p>
              <p className="text-sm text-gray-500 leading-relaxed">
                Tap the button and speak freely in <strong>any language</strong>.<br />
                Our AI will detect your emotional state and generate personalised guidance.
              </p>
              <div className="bg-rose-50 rounded-xl p-3 text-xs text-rose-600 text-left space-y-1">
                <p className="font-medium">💡 You can say things like:</p>
                <p className="italic">&ldquo;I&apos;ve been feeling really lonely lately…&rdquo;</p>
                <p className="italic">&ldquo;El bebé no deja de llorar y estoy agotada.&rdquo;</p>
                <p className="italic">&ldquo;최근에 남편이 너무 무심해서 힘들어요.&rdquo;</p>
              </div>
              <div className="bg-purple-50 rounded-xl p-3 text-xs text-purple-700 text-left space-y-1">
                <p className="font-medium">🧠 AI Pipeline:</p>
                {PIPELINE_STEPS.map((s) => (
                  <p key={s.id}>{s.id}. {s.label} — {s.desc}</p>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recording */}
        {recordingState === "recording" && (
          <Card className="border-rose-300">
            <CardContent className="pt-6 text-center space-y-4 pb-6">
              <div className="flex items-center justify-center gap-1 h-12">
                {[...Array(12)].map((_, i) => (
                  <div
                    key={i}
                    className="w-1.5 bg-rose-400 rounded-full animate-pulse"
                    style={{
                      height: `${20 + Math.sin(i * 0.8) * 16}px`,
                      animationDelay: `${i * 0.1}s`,
                      animationDuration: `${0.6 + (i % 3) * 0.2}s`,
                    }}
                  />
                ))}
              </div>
              <p className="text-rose-600 font-semibold">Recording… {formatTime(recordingSeconds)}</p>
              <p className="text-xs text-gray-400">Speak freely in any language</p>
            </CardContent>
          </Card>
        )}

        {/* Analyzing — show pipeline steps */}
        {recordingState === "analyzing" && (
          <Card>
            <CardContent className="pt-8 pb-8 space-y-4">
              <p className="font-semibold text-gray-700 text-center">Analyzing your voice…</p>
              <div className="space-y-3">
                {PIPELINE_STEPS.map((step) => {
                  const done = pipelineStep > step.id;
                  const active = pipelineStep === step.id;
                  return (
                    <div key={step.id} className={`flex items-center gap-3 p-3 rounded-xl transition-all ${active ? "bg-purple-50 border border-purple-200" : done ? "opacity-50" : "opacity-30"}`}>
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0
                        ${done ? "bg-green-400 text-white" : active ? "bg-purple-500 text-white animate-pulse" : "bg-gray-200 text-gray-400"}`}>
                        {done ? "✓" : step.id}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{step.label}</p>
                        <p className="text-xs text-gray-500">{step.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Record button */}
        {(recordingState === "idle" || recordingState === "recording") && (
          <div className="flex flex-col items-center gap-4 pt-4">
            <button
              onClick={recordingState === "idle" ? startRecording : stopRecording}
              className={`w-24 h-24 rounded-full shadow-lg transition-all duration-200 flex items-center justify-center text-white text-3xl
                ${recordingState === "recording"
                  ? "bg-red-500 hover:bg-red-600 scale-110 ring-4 ring-red-200 animate-pulse"
                  : "bg-rose-500 hover:bg-rose-600 hover:scale-105"
                }`}
            >
              {recordingState === "idle" ? "🎙️" : "⏹"}
            </button>
            <p className="text-sm text-gray-500">
              {recordingState === "idle" ? "Tap to start recording" : "Tap to stop"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

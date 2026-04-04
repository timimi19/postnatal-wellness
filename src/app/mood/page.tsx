"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/store/useAppStore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import type { MoodEntry } from "@/types";

// ───────────────────────────────────────────────
// 감정 분석 로직
// ───────────────────────────────────────────────
const DEPRESSION_KEYWORDS: Record<string, number> = {
  "죽고싶": 10, "사라지고": 9, "포기": 8, "무의미": 8,
  "우울": 7, "절망": 7, "슬퍼": 6, "힘들어": 6, "지쳐": 6,
  "눈물": 5, "외로워": 5, "무기력": 5, "불안": 4, "두려워": 4,
  "피곤": 3, "짜증": 3, "답답": 3, "모르겠어": 2,
};

const REASON_PATTERNS: Record<string, string[]> = {
  "수면 부족": ["못 잠", "못 자", "잠 못", "수면", "밤에", "새벽에", "밤중", "피곤"],
  "남편과의 갈등": ["남편이", "남편은", "남편한테", "혼자", "무심", "신경 안"],
  "아기 돌봄 스트레스": ["아기가", "아기는", "아기한테", "울음", "수유", "기저귀", "달래"],
  "신체적 불편": ["몸이", "아파", "아프다", "몸무게", "몸매", "회복", "상처"],
  "정체성 혼란": ["나는", "내가 뭔지", "잃어버린", "나답지", "예전 같지"],
  "고립감": ["외로워", "아무도", "이해 못", "혼자서", "연락", "친구"],
  "경제적 걱정": ["돈", "경제", "육아비", "생활비", "일"],
};

function analyzeVoice(transcript: string): {
  depressionScore: number;
  depressionLevel: MoodEntry["depressionLevel"];
  reasons: string[];
  wifeRecommendations: string[];
  husbandRecommendations: string[];
} {
  const text = transcript.toLowerCase();

  // 우울감 점수 계산 (0~10, 높을수록 우울)
  let rawScore = 0;
  for (const [keyword, weight] of Object.entries(DEPRESSION_KEYWORDS)) {
    if (text.includes(keyword)) rawScore += weight;
  }
  const depressionScore = Math.min(10, rawScore);

  const depressionLevel: MoodEntry["depressionLevel"] =
    depressionScore >= 7 ? "high" : depressionScore >= 3 ? "medium" : "low";

  // 이유 감지
  const reasons: string[] = [];
  for (const [reason, patterns] of Object.entries(REASON_PATTERNS)) {
    if (patterns.some((p) => text.includes(p))) reasons.push(reason);
  }
  if (reasons.length === 0) reasons.push("전반적인 감정 피로");

  // 아내 행동 추천
  const wifeRecs: string[] = [];
  if (depressionLevel === "high") {
    wifeRecs.push("지금 느끼는 감정을 남편에게 솔직히 말해주세요");
    wifeRecs.push("전문 상담사와 대화를 권장합니다 ☎ 1577-0199");
  } else if (depressionLevel === "medium") {
    wifeRecs.push("지금 가장 필요한 것 한 가지를 남편에게 말해보세요");
    wifeRecs.push("5분이라도 혼자만의 조용한 시간을 가져보세요");
  } else {
    wifeRecs.push("오늘도 잘 해내고 있어요 💪");
    wifeRecs.push("기분 좋았던 순간을 떠올려 적어보세요");
  }
  if (reasons.includes("수면 부족")) wifeRecs.push("낮잠 15~20분을 시도해보세요");
  if (reasons.includes("고립감")) wifeRecs.push("친한 사람에게 연락해보세요");

  // 남편 행동 추천
  const husbandRecs: string[] = [];
  if (depressionLevel === "high") {
    husbandRecs.push("⚠️ 아내가 많이 힘든 상태예요. 지금 바로 곁에 있어주세요");
    husbandRecs.push("아무 말 없이 꼭 안아주세요");
    husbandRecs.push("필요하다면 전문 상담을 함께 알아봐주세요");
  } else if (depressionLevel === "medium") {
    husbandRecs.push("퇴근 후 바로 집으로 와주세요");
    husbandRecs.push("\"요즘 어때? 많이 힘들지?\"라고 먼저 물어봐주세요");
  } else {
    husbandRecs.push("오늘 아내에게 칭찬 한 마디 건네주세요 😊");
  }
  if (reasons.includes("수면 부족")) husbandRecs.push("오늘 밤 아기 달래기를 담당해주세요");
  if (reasons.includes("남편과의 갈등")) husbandRecs.push("아내 말을 끊지 말고 끝까지 들어주세요");
  if (reasons.includes("아기 돌봄 스트레스")) husbandRecs.push("아기 목욕 또는 재우기를 오늘 담당해주세요");
  if (reasons.includes("신체적 불편")) husbandRecs.push("\"몸은 좀 어때?\"라고 구체적으로 물어봐주세요");

  return {
    depressionScore,
    depressionLevel,
    reasons,
    wifeRecommendations: wifeRecs,
    husbandRecommendations: husbandRecs,
  };
}

// ───────────────────────────────────────────────
// 컴포넌트
// ───────────────────────────────────────────────
type RecordingState = "idle" | "recording" | "analyzing" | "done";

export default function MoodPage() {
  const router = useRouter();
  const { user, addMoodEntry } = useAppStore();
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [transcript, setTranscript] = useState("");
  const [interimText, setInterimText] = useState("");
  const [result, setResult] = useState<MoodEntry | null>(null);
  const [husbandRecs, setHusbandRecs] = useState<string[]>([]);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startRecording = () => {
    const SpeechRecognitionAPI =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      toast.error("이 브라우저는 음성 인식을 지원하지 않아요. Chrome을 사용해주세요.");
      return;
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.lang = "ko-KR";
    recognition.continuous = true;
    recognition.interimResults = true;

    let finalTranscript = "";

    recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += t + " ";
          setTranscript(finalTranscript);
        } else {
          interim += t;
        }
      }
      setInterimText(interim);
    };

    recognition.onerror = (e) => {
      if (e.error !== "no-speech") {
        toast.error("음성 인식 오류가 발생했어요. 다시 시도해주세요.");
      }
    };

    recognition.start();
    recognitionRef.current = recognition;
    setRecordingState("recording");
    setRecordingSeconds(0);
    setTranscript("");
    setInterimText("");

    timerRef.current = setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
  };

  const stopRecording = () => {
    recognitionRef.current?.stop();
    if (timerRef.current) clearInterval(timerRef.current);
    setInterimText("");
    setRecordingState("analyzing");

    // 분석 딜레이 (UX용)
    setTimeout(() => {
      const fullText = transcript || "기록 없음";
      const analysis = analyzeVoice(fullText);

      const entry: MoodEntry = {
        id: Date.now().toString(),
        userId: user?.id ?? "unknown",
        text: fullText.trim(),
        sentimentScore: 10 - analysis.depressionScore,
        depressionLevel: analysis.depressionLevel,
        reasons: analysis.reasons,
        recommendations: analysis.wifeRecommendations,
        createdAt: new Date().toISOString(),
      };

      addMoodEntry(entry);
      setResult(entry);
      setHusbandRecs(analysis.husbandRecommendations);
      setRecordingState("done");
    }, 1800);
  };

  const formatTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const levelConfig = {
    low:    { label: "안정",   color: "bg-green-100 text-green-700",  bar: "bg-green-400",  emoji: "🌱", bg: "bg-green-50"  },
    medium: { label: "주의",   color: "bg-yellow-100 text-yellow-700", bar: "bg-yellow-400", emoji: "💛", bg: "bg-yellow-50" },
    high:   { label: "위험",   color: "bg-red-100 text-red-700",      bar: "bg-red-400",    emoji: "🆘", bg: "bg-red-50"    },
  };

  // ── 결과 화면 ──
  if (recordingState === "done" && result) {
    const cfg = levelConfig[result.depressionLevel];

    return (
      <div className="min-h-screen bg-rose-50 px-4 py-8">
        <div className="max-w-md mx-auto space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600">←</button>
            <h1 className="text-xl font-bold text-gray-800">감정 분석 결과</h1>
          </div>

          {/* 우울감 수준 */}
          <Card className={`border-0 ${cfg.bg}`}>
            <CardContent className="pt-6 text-center space-y-3">
              <div className="text-5xl">{cfg.emoji}</div>
              <Badge className={`text-sm px-3 py-1 ${cfg.color}`}>{cfg.label}</Badge>
              <div className="w-full bg-gray-200 rounded-full h-3 mt-2">
                <div
                  className={`h-3 rounded-full transition-all duration-700 ${cfg.bar}`}
                  style={{ width: `${((10 - result.sentimentScore) / 10) * 100}%` }}
                />
              </div>
              <p className="text-xs text-gray-400">우울감 지수: {10 - result.sentimentScore}/10</p>
            </CardContent>
          </Card>

          {/* 감지된 이유 */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">🔍 감지된 원인</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {result.reasons.map((r) => (
                <Badge key={r} variant="outline" className="text-sm text-rose-600 border-rose-200">
                  {r}
                </Badge>
              ))}
            </CardContent>
          </Card>

          {/* 아내 추천 */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">👩 나를 위한 추천</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {result.recommendations.map((rec, i) => (
                <p key={i} className="text-sm text-gray-700">• {rec}</p>
              ))}
            </CardContent>
          </Card>

          {/* 남편 추천 */}
          {husbandRecs.length > 0 && (
            <Card className="border-blue-100 bg-blue-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">👨 남편에게 전달할 내용</CardTitle>
                <CardDescription>이 내용이 남편 대시보드에 표시돼요</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {husbandRecs.map((rec, i) => (
                  <p key={i} className="text-sm text-blue-800">• {rec}</p>
                ))}
              </CardContent>
            </Card>
          )}

          {/* 녹음 내용 */}
          {result.text && result.text !== "기록 없음" && (
            <Card className="border-dashed border-gray-200">
              <CardHeader className="pb-1">
                <CardTitle className="text-sm text-gray-400">🎙 인식된 텍스트</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 italic">"{result.text}"</p>
              </CardContent>
            </Card>
          )}

          <div className="flex gap-2">
            <Button
              className="flex-1 bg-rose-500 hover:bg-rose-600 text-white"
              onClick={() => router.push("/dashboard")}
            >
              대시보드로
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => { setRecordingState("idle"); setTranscript(""); setResult(null); setHusbandRecs([]); }}
            >
              다시 녹음
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── 녹음 화면 ──
  return (
    <div className="min-h-screen bg-rose-50 flex flex-col px-4 py-8">
      <div className="max-w-md mx-auto w-full space-y-4">
        <div className="flex items-center gap-2">
          <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600">←</button>
          <h1 className="text-xl font-bold text-gray-800">감정 기록 🎙</h1>
        </div>

        {/* 안내 카드 */}
        {recordingState === "idle" && (
          <Card>
            <CardContent className="pt-6 text-center space-y-3 pb-6">
              <div className="text-5xl mb-2">🎙️</div>
              <p className="text-lg font-semibold text-gray-800">오늘 어떤 하루였나요?</p>
              <p className="text-sm text-gray-500 leading-relaxed">
                버튼을 누르고 지금 느끼는 감정을 자유롭게 말해주세요.<br />
                AI가 감정을 분석해 아내와 남편 모두에게 맞춤 행동을 추천해드려요.
              </p>
              <div className="bg-rose-50 rounded-xl p-3 text-xs text-rose-600 text-left space-y-1">
                <p>💡 이렇게 말해보세요:</p>
                <p className="italic">"요즘 남편이 핸드폰만 보고 있어서 많이 외로워요..."</p>
                <p className="italic">"아기가 밤에 자꾸 울어서 잠을 제대로 못 자고 있어요"</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 녹음 중 */}
        {recordingState === "recording" && (
          <Card className="border-rose-300">
            <CardContent className="pt-6 text-center space-y-4 pb-6">
              {/* 애니메이션 파형 */}
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
              <p className="text-rose-600 font-semibold">녹음 중... {formatTime(recordingSeconds)}</p>
              <p className="text-xs text-gray-400">자유롭게 말씀해 주세요</p>

              {/* 실시간 텍스트 */}
              {(transcript || interimText) && (
                <div className="bg-gray-50 rounded-xl p-3 text-left min-h-[60px]">
                  <p className="text-sm text-gray-700">{transcript}</p>
                  <p className="text-sm text-gray-400 italic">{interimText}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* 분석 중 */}
        {recordingState === "analyzing" && (
          <Card>
            <CardContent className="pt-8 pb-8 text-center space-y-4">
              <div className="text-4xl animate-bounce">🔍</div>
              <p className="font-semibold text-gray-700">감정을 분석하고 있어요...</p>
              <p className="text-sm text-gray-400">우울감 원인과 맞춤 추천을 생성 중이에요</p>
              <div className="flex justify-center gap-1 mt-2">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-2 h-2 bg-rose-400 rounded-full animate-bounce"
                    style={{ animationDelay: `${i * 0.2}s` }}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 녹음 버튼 */}
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
              {recordingState === "idle" ? "탭하여 녹음 시작" : "탭하여 녹음 완료"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

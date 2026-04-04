"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/store/useAppStore";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import type { MoodEntry } from "@/types";

const MOOD_EMOJIS = [
  { score: 9, emoji: "😄", label: "매우 좋음" },
  { score: 7, emoji: "🙂", label: "좋음" },
  { score: 5, emoji: "😐", label: "보통" },
  { score: 3, emoji: "😔", label: "우울함" },
  { score: 1, emoji: "😢", label: "매우 힘듦" },
];

const REASON_OPTIONS = [
  "수면 부족", "아기 돌봄 스트레스", "외로움", "몸이 힘듦",
  "남편과의 갈등", "정체성 혼란", "경제적 걱정", "기타",
];

function analyzeDepression(score: number): MoodEntry["depressionLevel"] {
  if (score >= 6) return "low";
  if (score >= 3) return "medium";
  return "high";
}

function getRecommendations(level: MoodEntry["depressionLevel"], role: "wife" | "husband"): string[] {
  if (role === "wife") {
    if (level === "low") return ["오늘도 잘 버텨내고 있어요 💪", "10분 산책을 해보세요"];
    if (level === "medium") return ["남편에게 지금 기분을 솔직히 말해보세요", "잠깐 혼자만의 시간을 가져보세요"];
    return ["전문 상담사와 대화를 권장합니다", "지금 당장 남편에게 도움을 요청하세요", "119 정신건강 위기상담: 1577-0199"];
  } else {
    if (level === "low") return ["아내가 오늘 좋은 상태예요 😊", "가벼운 칭찬 한 마디 건네보세요"];
    if (level === "medium") return ["아내가 힘들어하고 있어요", "퇴근 후 바로 집으로 와주세요", "집안일 하나를 먼저 도와주세요"];
    return ["⚠️ 아내가 많이 힘들어합니다", "지금 바로 아내 옆에 있어주세요", "필요시 전문가 상담을 권해주세요"];
  }
}

export default function MoodPage() {
  const router = useRouter();
  const { user, addMoodEntry } = useAppStore();
  const [inputMode, setInputMode] = useState<"text" | "emoji">("emoji");
  const [selectedScore, setSelectedScore] = useState<number | null>(null);
  const [text, setText] = useState("");
  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<MoodEntry | null>(null);

  const handleSubmit = () => {
    if (selectedScore === null && !text.trim()) {
      toast.error("감정 상태를 선택하거나 텍스트를 입력해주세요.");
      return;
    }
    const score = selectedScore ?? 5;
    const level = analyzeDepression(score);
    const recommendations = getRecommendations(level, user?.role ?? "wife");

    const entry: MoodEntry = {
      id: Date.now().toString(),
      userId: user?.id ?? "unknown",
      text: text || (MOOD_EMOJIS.find((m) => m.score === score)?.label ?? ""),
      sentimentScore: score,
      depressionLevel: level,
      reasons: selectedReasons,
      recommendations,
      createdAt: new Date().toISOString(),
    };

    addMoodEntry(entry);
    setResult(entry);
    setSubmitted(true);
  };

  const levelColor = {
    low: "bg-green-100 text-green-700 border-green-200",
    medium: "bg-yellow-100 text-yellow-700 border-yellow-200",
    high: "bg-red-100 text-red-700 border-red-200",
  };
  const levelLabel = { low: "양호", medium: "주의", high: "위험" };

  if (submitted && result) {
    return (
      <div className="min-h-screen bg-rose-50 flex flex-col items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="text-4xl mb-2">
              {result.depressionLevel === "low" ? "🌟" : result.depressionLevel === "medium" ? "💛" : "🆘"}
            </div>
            <CardTitle>감정 기록 완료</CardTitle>
            <Badge className={`mx-auto ${levelColor[result.depressionLevel]}`}>
              {levelLabel[result.depressionLevel]}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-3 space-y-1">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">추천 행동</p>
              {result.recommendations.map((rec, i) => (
                <p key={i} className="text-sm text-gray-700">• {rec}</p>
              ))}
            </div>
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
                onClick={() => { setSubmitted(false); setSelectedScore(null); setText(""); setSelectedReasons([]); }}
              >
                다시 기록
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-rose-50 px-4 py-8">
      <div className="max-w-md mx-auto space-y-4">
        <div className="flex items-center gap-2">
          <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600">←</button>
          <h1 className="text-xl font-bold text-gray-800">감정 기록 💬</h1>
        </div>

        {/* 입력 방식 선택 */}
        <div className="flex gap-2 bg-white rounded-lg p-1 border">
          <button
            className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${inputMode === "emoji" ? "bg-rose-500 text-white" : "text-gray-500"}`}
            onClick={() => setInputMode("emoji")}
          >
            😊 이모지 선택
          </button>
          <button
            className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${inputMode === "text" ? "bg-rose-500 text-white" : "text-gray-500"}`}
            onClick={() => setInputMode("text")}
          >
            ✍️ 텍스트 입력
          </button>
        </div>

        {/* 이모지 선택 */}
        {inputMode === "emoji" && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">지금 기분이 어때요?</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between">
                {MOOD_EMOJIS.map((mood) => (
                  <button
                    key={mood.score}
                    onClick={() => setSelectedScore(mood.score)}
                    className={`flex flex-col items-center p-2 rounded-xl transition-all ${selectedScore === mood.score ? "bg-rose-100 scale-110 ring-2 ring-rose-400" : "hover:bg-gray-100"}`}
                  >
                    <span className="text-3xl">{mood.emoji}</span>
                    <span className="text-xs text-gray-500 mt-1">{mood.label}</span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 텍스트 입력 */}
        {inputMode === "text" && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">오늘 어떤 하루였나요?</CardTitle>
              <CardDescription>자유롭게 감정을 적어보세요</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="오늘 느낀 감정을 솔직하게 적어주세요..."
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={4}
                className="resize-none"
              />
            </CardContent>
          </Card>
        )}

        {/* 이유 선택 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">어떤 이유 때문인가요? (선택)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {REASON_OPTIONS.map((reason) => (
                <button
                  key={reason}
                  onClick={() =>
                    setSelectedReasons((prev) =>
                      prev.includes(reason) ? prev.filter((r) => r !== reason) : [...prev, reason]
                    )
                  }
                  className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                    selectedReasons.includes(reason)
                      ? "bg-rose-500 text-white border-rose-500"
                      : "bg-white text-gray-600 border-gray-200 hover:border-rose-300"
                  }`}
                >
                  {reason}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Button
          className="w-full bg-rose-500 hover:bg-rose-600 text-white h-12 text-base"
          onClick={handleSubmit}
          disabled={selectedScore === null && !text.trim()}
        >
          기록하기
        </Button>
      </div>
    </div>
  );
}

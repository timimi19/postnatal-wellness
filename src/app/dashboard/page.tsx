"use client";

import { useAppStore } from "@/store/useAppStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const router = useRouter();
  const { user, moodEntries, logout } = useAppStore();
  const isWife = user?.role === "wife";

  const latestMood = moodEntries[0];
  const recentEntries = moodEntries.slice(0, 5);

  const depressionColor = {
    low: "bg-green-100 text-green-700",
    medium: "bg-yellow-100 text-yellow-700",
    high: "bg-red-100 text-red-700",
  };

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  return (
    <div className="min-h-screen bg-rose-50 pb-20">
      {/* 헤더 */}
      <div className={`${isWife ? "bg-rose-500" : "bg-blue-500"} text-white px-4 pt-10 pb-6`}>
        <div className="flex justify-between items-start max-w-md mx-auto">
          <div>
            <p className="text-sm opacity-80">{isWife ? "👩 산모" : "👨 파트너"}</p>
            <h1 className="text-2xl font-bold mt-1">
              안녕하세요, {user?.name ?? "사용자"}님 🌸
            </h1>
            <p className="text-sm opacity-80 mt-1">
              {isWife ? "오늘 감정은 어떠세요?" : "오늘 아내를 도와줄 준비가 됐나요?"}
            </p>
          </div>
          <button onClick={handleLogout} className="text-xs opacity-70 hover:opacity-100 mt-2">
            로그아웃
          </button>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-6 space-y-4">
        {/* 최근 감정 상태 */}
        {latestMood ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                {isWife ? "나의 최근 감정" : "아내의 최근 감정"} 💭
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 mb-2">
                <Badge className={depressionColor[latestMood.depressionLevel]}>
                  {latestMood.depressionLevel === "low"
                    ? "양호"
                    : latestMood.depressionLevel === "medium"
                    ? "주의"
                    : "위험"}
                </Badge>
                <span className="text-sm text-gray-500">
                  점수: {latestMood.sentimentScore}/10
                </span>
              </div>
              <p className="text-sm text-gray-700 truncate">{latestMood.text}</p>
              {latestMood.recommendations.length > 0 && (
                <div className="mt-3 space-y-1">
                  <p className="text-xs font-semibold text-gray-500">추천 행동</p>
                  {latestMood.recommendations.map((rec, i) => (
                    <p key={i} className="text-sm text-gray-600">• {rec}</p>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="border-dashed border-2 border-rose-200">
            <CardContent className="py-8 text-center text-gray-400">
              <p className="text-3xl mb-2">📝</p>
              <p className="text-sm">아직 감정 기록이 없어요</p>
              <p className="text-xs mt-1">오늘 첫 감정을 기록해보세요</p>
            </CardContent>
          </Card>
        )}

        {/* 오늘의 플랜 */}
        {user?.plan && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">오늘의 플랜 📋</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {user.plan.dailyGoals.map((goal, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-gray-700">
                  <span className="text-rose-400">✦</span>
                  {goal}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* 최근 감정 기록 목록 */}
        {recentEntries.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">최근 기록 📅</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {recentEntries.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between text-sm border-b pb-2 last:border-0">
                  <span className="text-gray-700 truncate w-2/3">{entry.text}</span>
                  <Badge className={`${depressionColor[entry.depressionLevel]} text-xs`}>
                    {entry.depressionLevel === "low" ? "양호" : entry.depressionLevel === "medium" ? "주의" : "위험"}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* 액션 버튼들 */}
        <div className="grid grid-cols-2 gap-3">
          <Button
            className="h-16 flex-col gap-1 bg-rose-500 hover:bg-rose-600 text-white"
            onClick={() => router.push("/mood")}
          >
            <span className="text-xl">💬</span>
            <span className="text-sm">감정 기록</span>
          </Button>
          <Button
            className="h-16 flex-col gap-1 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200"
            variant="outline"
            onClick={() => router.push("/partner-reminder")}
          >
            <span className="text-xl">📍</span>
            <span className="text-sm">파트너 알림</span>
          </Button>
        </div>
      </div>
    </div>
  );
}

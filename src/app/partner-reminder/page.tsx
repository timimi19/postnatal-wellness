"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/store/useAppStore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export default function PartnerReminderPage() {
  const router = useRouter();
  const { user, partnerReminder, setPartnerReminder } = useAppStore();
  const [gpsStatus, setGpsStatus] = useState<"idle" | "tracking" | "near">("idle");
  const [distance, setDistance] = useState<number | null>(null);

  const isHusband = user?.role === "husband";

  // GPS 시뮬레이션 (실제 구현 시 Geolocation API 사용)
  const startTracking = () => {
    setGpsStatus("tracking");
    toast.info("위치 추적을 시작합니다 📍");

    // 실제 구현: navigator.geolocation.watchPosition(...)
    // 데모용 시뮬레이션
    let count = 0;
    const interval = setInterval(() => {
      count += 1;
      const simDistance = Math.max(0, 5 - count * 0.8);
      setDistance(Math.round(simDistance * 10) / 10);

      if (simDistance <= 0.5) {
        setGpsStatus("near");
        clearInterval(interval);
        setPartnerReminder({
          id: Date.now().toString(),
          message: "남편이 집 근처에 왔어요! 지금 대화를 시작해보세요 💬",
          isActive: true,
          triggeredAt: new Date().toISOString(),
        });
        toast.success("집 근처에 도착했어요! 아내에게 알림을 보냈습니다 🏠");
      }
    }, 2000);

    return () => clearInterval(interval);
  };

  const stopTracking = () => {
    setGpsStatus("idle");
    setDistance(null);
    toast.info("위치 추적을 중지했습니다");
  };

  return (
    <div className="min-h-screen bg-rose-50 px-4 py-8">
      <div className="max-w-md mx-auto space-y-4">
        <div className="flex items-center gap-2">
          <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600">←</button>
          <h1 className="text-xl font-bold text-gray-800">파트너 알림 📍</h1>
        </div>

        {/* 상태 카드 */}
        <Card className={gpsStatus === "near" ? "border-green-300 bg-green-50" : ""}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                {isHusband ? "귀가 감지 서비스" : "남편 위치 현황"}
              </CardTitle>
              <Badge
                className={
                  gpsStatus === "tracking"
                    ? "bg-blue-100 text-blue-700"
                    : gpsStatus === "near"
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-500"
                }
              >
                {gpsStatus === "tracking" ? "추적 중" : gpsStatus === "near" ? "집 근처" : "대기 중"}
              </Badge>
            </div>
            <CardDescription>
              {isHusband
                ? "집 근처에 오면 자동으로 아내에게 알림을 전송합니다"
                : "남편이 귀가할 때 알림을 받을 수 있어요"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {gpsStatus === "near" && (
              <div className="text-center py-4">
                <p className="text-4xl mb-2">🏠</p>
                <p className="font-semibold text-green-700">집 근처에 도착했어요!</p>
                <p className="text-sm text-gray-500 mt-1">
                  {isHusband ? "아내에게 알림이 전송됐어요" : "남편이 곧 도착해요"}
                </p>
              </div>
            )}

            {distance !== null && gpsStatus === "tracking" && (
              <div className="text-center py-2">
                <p className="text-2xl font-bold text-blue-600">{distance}km</p>
                <p className="text-sm text-gray-500">현재 집까지 거리</p>
                <div className="mt-2 h-2 bg-gray-200 rounded-full">
                  <div
                    className="h-2 bg-blue-400 rounded-full transition-all duration-500"
                    style={{ width: `${Math.max(0, 100 - distance * 20)}%` }}
                  />
                </div>
              </div>
            )}

            {isHusband && (
              <div className="flex gap-2">
                {gpsStatus === "idle" ? (
                  <Button
                    className="flex-1 bg-rose-500 hover:bg-rose-600 text-white"
                    onClick={startTracking}
                  >
                    📍 위치 추적 시작
                  </Button>
                ) : gpsStatus === "tracking" ? (
                  <Button variant="outline" className="flex-1" onClick={stopTracking}>
                    ⏹ 추적 중지
                  </Button>
                ) : (
                  <Button
                    className="flex-1 bg-green-500 hover:bg-green-600 text-white"
                    onClick={() => router.push("/mood")}
                  >
                    💬 감정 대화 시작하기
                  </Button>
                )}
              </div>
            )}

            {!isHusband && (
              <div className="text-center text-sm text-gray-500">
                {gpsStatus === "idle"
                  ? "남편이 위치 추적을 시작하면 여기에 표시됩니다"
                  : "남편이 귀가 중이에요..."}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 최근 알림 */}
        {partnerReminder && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">최근 알림 🔔</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-start gap-3 p-3 bg-rose-50 rounded-lg">
                <span className="text-xl">💌</span>
                <div>
                  <p className="text-sm text-gray-700">{partnerReminder.message}</p>
                  {partnerReminder.triggeredAt && (
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(partnerReminder.triggeredAt).toLocaleString("ko-KR")}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 가이드 */}
        <Card className="border-dashed border-rose-200">
          <CardContent className="pt-4 space-y-2 text-sm text-gray-600">
            <p className="font-semibold text-gray-700">💡 이렇게 활용해보세요</p>
            <p>• 남편이 퇴근 후 집 500m 이내 진입 시 자동 알림</p>
            <p>• 알림 수신 후 감정 대화 시작 유도</p>
            <p>• 귀가 전 아내 감정 상태 미리 파악 가능</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/store/useAppStore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import type { UserRole } from "@/types";

const PHQ9_QUESTIONS = [
  "일 또는 여가 활동에 대한 흥미나 즐거움이 없었다",
  "기분이 가라앉거나 우울하거나 희망이 없다고 느꼈다",
  "잠들기 어렵거나 자꾸 깨어났다. 혹은 너무 많이 잤다",
  "피로감을 느끼거나 기운이 없었다",
  "식욕이 없거나 과식을 했다",
  "나는 내가 실패자라고 느끼거나 자신 또는 가족을 실망시켰다",
  "신문 읽기나 TV 보기 등에 집중하기 힘들었다",
  "남들이 알아챌 정도로 느리게 움직이거나 말했다. 혹은 반대로 너무 불안하여 앉아 있을 수 없었다",
  "나는 차라리 죽는 것이 더 낫겠다고 생각하거나 자해에 대한 생각을 했다",
];

const SCORE_OPTIONS = [
  { value: "0", label: "전혀 없음" },
  { value: "1", label: "며칠 동안" },
  { value: "2", label: "7일 이상" },
  { value: "3", label: "거의 매일" },
];

const STEPS = ["역할 선택", "동의", "자가 진단", "니즈 설문", "플랜 생성"];

export default function OnboardingPage() {
  const router = useRouter();
  const { setUser, setOnboardingStep, user } = useAppStore();
  const [step, setStep] = useState(0);
  const [role, setRole] = useState<UserRole | null>(null);
  const [phqAnswers, setPhqAnswers] = useState<number[]>(Array(9).fill(0));
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [needsAnswers, setNeedsAnswers] = useState<string[]>([]);

  const progress = ((step + 1) / STEPS.length) * 100;

  const handleRoleSelect = (selected: UserRole) => {
    setRole(selected);
    setUser({ ...user!, role: selected });
    setStep(1);
  };

  const handleConsent = () => setStep(2);

  const handlePhqAnswer = (score: number) => {
    const updated = [...phqAnswers];
    updated[currentQuestion] = score;
    setPhqAnswers(updated);
    if (currentQuestion < PHQ9_QUESTIONS.length - 1) {
      setCurrentQuestion((q) => q + 1);
    } else {
      setStep(3);
    }
  };

  const handleNeedsSubmit = () => {
    setOnboardingStep(4);
    setStep(4);
  };

  const handleFinish = () => {
    const totalScore = phqAnswers.reduce((a, b) => a + b, 0);
    setUser({
      ...user!,
      plan: {
        dailyGoals:
          role === "wife"
            ? ["감정 일기 쓰기", "10분 산책", "충분한 수면"]
            : ["아내에게 먼저 말 걸기", "집안일 하나 도맡기", "칭찬 한 마디"],
        weeklyCheckIn: "매주 일요일 저녁 감정 체크",
        partnerTasks: ["함께 저녁 식사", "아기 목욕 같이 하기"],
      },
    });
    router.push("/dashboard");
  };

  return (
    <div className="min-h-screen bg-rose-50 flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-md space-y-4">
        {/* 진행 표시 */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-gray-500">
            {STEPS.map((s, i) => (
              <span key={s} className={i === step ? "text-rose-600 font-semibold" : ""}>{s}</span>
            ))}
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Step 0: 역할 선택 */}
        {step === 0 && (
          <Card>
            <CardHeader>
              <CardTitle>안녕하세요! 🌸</CardTitle>
              <CardDescription>어떤 역할로 사용하실 건가요?</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <Button
                className="h-20 text-lg bg-rose-100 hover:bg-rose-200 text-rose-700 border border-rose-300"
                variant="outline"
                onClick={() => handleRoleSelect("wife")}
              >
                👩 아내 (산모)
                <span className="block text-sm text-gray-500 mt-1">감정을 기록하고 지원을 받을게요</span>
              </Button>
              <Button
                className="h-20 text-lg bg-blue-100 hover:bg-blue-200 text-blue-700 border border-blue-300"
                variant="outline"
                onClick={() => handleRoleSelect("husband")}
              >
                👨 남편
                <span className="block text-sm text-gray-500 mt-1">아내를 이해하고 도와줄게요</span>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 1: 동의 */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>개인정보 수집 동의 📋</CardTitle>
              <CardDescription>서비스 이용을 위해 아래 항목에 동의해주세요</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-gray-600">
              <p>• 감정 기록 및 건강 데이터는 서비스 개선 목적으로만 사용됩니다.</p>
              <p>• 수집된 데이터는 암호화되어 안전하게 보관됩니다.</p>
              <p>• 언제든지 데이터 삭제를 요청할 수 있습니다.</p>
              <p>• 의료 진단이나 처방을 대체하지 않습니다.</p>
              <Button
                className="w-full bg-rose-500 hover:bg-rose-600 text-white"
                onClick={handleConsent}
              >
                동의하고 계속하기
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 2: PHQ-9 자가 진단 */}
        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>
                자가 진단 ({currentQuestion + 1}/{PHQ9_QUESTIONS.length}) 🔍
              </CardTitle>
              <CardDescription>
                지난 2주 동안 얼마나 자주 아래와 같은 문제를 경험했나요?
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="font-medium text-gray-800">{PHQ9_QUESTIONS[currentQuestion]}</p>
              <RadioGroup
                onValueChange={(v) => handlePhqAnswer(Number(v))}
                className="space-y-2"
              >
                {SCORE_OPTIONS.map((opt) => (
                  <div key={opt.value} className="flex items-center space-x-2">
                    <RadioGroupItem value={opt.value} id={opt.value} />
                    <Label htmlFor={opt.value}>{opt.label}</Label>
                  </div>
                ))}
              </RadioGroup>
            </CardContent>
          </Card>
        )}

        {/* Step 3: 니즈 설문 */}
        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle>니즈 설문 💬</CardTitle>
              <CardDescription>지금 가장 필요한 도움이 무엇인가요? (해당 항목 모두 선택)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                "감정적인 지지와 공감",
                "집안일 도움",
                "아기 돌봄 분담",
                "혼자만의 시간",
                "전문가 상담 연결",
                "정보 및 교육 자료",
              ].map((need) => (
                <Button
                  key={need}
                  variant={needsAnswers.includes(need) ? "default" : "outline"}
                  className={`w-full justify-start ${needsAnswers.includes(need) ? "bg-rose-500 text-white" : ""}`}
                  onClick={() =>
                    setNeedsAnswers((prev) =>
                      prev.includes(need) ? prev.filter((n) => n !== need) : [...prev, need]
                    )
                  }
                >
                  {need}
                </Button>
              ))}
              <Button
                className="w-full bg-rose-500 hover:bg-rose-600 text-white mt-2"
                onClick={handleNeedsSubmit}
                disabled={needsAnswers.length === 0}
              >
                다음
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 4: 플랜 생성 완료 */}
        {step === 4 && (
          <Card>
            <CardHeader>
              <CardTitle>맞춤 플랜 완성! 🎉</CardTitle>
              <CardDescription>
                {role === "wife"
                  ? "산후 회복을 위한 맞춤 플랜이 준비됐어요"
                  : "아내를 도울 수 있는 맞춤 가이드가 준비됐어요"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {role === "wife" ? (
                <>
                  <p className="text-sm text-gray-600">✅ 매일 감정 일기 쓰기</p>
                  <p className="text-sm text-gray-600">✅ 10분 가벼운 산책</p>
                  <p className="text-sm text-gray-600">✅ 주 1회 감정 체크인</p>
                </>
              ) : (
                <>
                  <p className="text-sm text-gray-600">✅ 매일 아내에게 먼저 말 걸기</p>
                  <p className="text-sm text-gray-600">✅ 집안일 하나 도맡기</p>
                  <p className="text-sm text-gray-600">✅ 퇴근 후 5분 경청 시간</p>
                </>
              )}
              <Button
                className="w-full bg-rose-500 hover:bg-rose-600 text-white mt-4"
                onClick={handleFinish}
              >
                시작하기
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

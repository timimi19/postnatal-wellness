"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/store/useAppStore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import type { UserRole, WellnessPlan } from "@/types";

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

const HUSBAND_QUESTIONS = [
  {
    question: "아내가 요즘 힘들다는 것을 얼마나 인식하고 있나요?",
    emoji: "💡",
    description: "솔직하게 선택해 주세요.",
    options: [
      "전혀 몰랐어요",
      "어렴풋이 느끼고 있어요",
      "알고 있지만 어떻게 해야 할지 모르겠어요",
      "알고 있고 도우려 노력 중이에요",
      "충분히 이해하고 함께 대처하고 있어요",
    ],
  },
  {
    question: "아내와 마지막으로 진심 어린 대화를 한 게 언제인가요?",
    emoji: "💬",
    description: "아기 얘기 말고, 아내 자신에 대한 대화 기준이에요.",
    options: [
      "기억이 잘 안 나요",
      "일주일 이상 됐어요",
      "며칠 전이에요",
      "어제 또는 오늘이에요",
      "매일 대화해요",
    ],
  },
  {
    question: "아내가 힘들다고 표현할 때 나의 반응은?",
    emoji: "🤝",
    description: "가장 솔직한 반응을 골라주세요.",
    options: [
      "대수롭지 않게 넘겼어요",
      "듣긴 하는데 뭘 해야 할지 몰라요",
      "공감하려 하지만 잘 안 돼요",
      "위로의 말을 건네요",
      "끝까지 듣고 함께 해결책을 찾아요",
    ],
  },
  {
    question: "최근 일주일간 아기 돌봄에 얼마나 참여했나요?",
    emoji: "👶",
    description: "목욕, 수유, 달래기, 재우기 등 포함해서요.",
    options: [
      "거의 아내가 전담했어요",
      "가끔 도와줬어요 (부탁받을 때)",
      "절반 정도 분담했어요",
      "적극적으로 참여했어요",
    ],
  },
  {
    question: "집안일(청소·설거지·빨래 등)은 어떻게 하고 있나요?",
    emoji: "🏠",
    description: "최근 일주일 기준이에요.",
    options: [
      "거의 아내가 해요",
      "부탁받으면 해요",
      "내가 먼저 나서서 하는 편이에요",
      "역할을 명확히 나눠서 하고 있어요",
    ],
  },
  {
    question: "아내를 위해 의식적으로 하고 있는 것이 있나요?",
    emoji: "💙",
    description: "해당하는 것을 모두 골라주세요.",
    options: [
      "퇴근 후 바로 집에 와요",
      "먼저 말을 걸어줘요",
      "칭찬이나 감사 표현을 해요",
      "아내 혼자만의 시간을 만들어줘요",
      "아직 특별히 하는 게 없어요",
    ],
    multi: true,
  },
];

interface WifeNeedsState {
  emotionState: string;
  husbandTalkFreq: string;
  comfortThings: string[];
  discomfortThings: string[];
  wishFromHusband: string[];
}

const WIFE_NEEDS_QUESTIONS = [
  {
    key: "emotionState",
    question: "요즘 나의 감정 상태는 어떤가요?",
    emoji: "💭",
    description: "솔직하게 선택해 주세요. 정답은 없어요.",
    type: "single",
    options: [
      "😢 많이 힘들고 우울해요",
      "😔 조금 힘들고 지쳐 있어요",
      "😐 그냥 그래요. 무감각한 느낌",
      "🙂 나쁘지 않아요",
      "😊 요즘 꽤 괜찮아요",
    ],
  },
  {
    key: "husbandTalkFreq",
    question: "남편과 하루에 얼마나 대화하나요?",
    emoji: "💬",
    description: "아기 얘기 말고, 나 자신에 대한 대화 기준이에요.",
    type: "single",
    options: [
      "거의 대화가 없어요 (5분 미만)",
      "짧게 나눠요 (10~20분)",
      "어느 정도 대화해요 (30분~1시간)",
      "충분히 대화하는 편이에요 (1시간 이상)",
      "필요할 때 언제든 대화해요",
    ],
  },
  {
    key: "comfortThings",
    question: "어떤 것들이 나를 편안하게 하나요?",
    emoji: "🌿",
    description: "해당하는 것을 모두 골라주세요.",
    type: "multi",
    options: [
      "남편이 먼저 말을 걸어줄 때",
      "아기를 잠깐 맡아줄 때",
      "혼자만의 조용한 시간",
      "따뜻한 스킨십 (포옹, 손잡기)",
      "맛있는 음식을 준비해줄 때",
      "\"잘하고 있어\"라고 말해줄 때",
      "함께 영상을 보거나 쉴 때",
      "밖에 나가 바람 쐬기",
      "집안이 정돈되어 있을 때",
      "충분한 수면",
    ],
  },
  {
    key: "discomfortThings",
    question: "어떤 것들이 나를 힘들게 하나요?",
    emoji: "😣",
    description: "불편하거나 스트레스받는 상황을 모두 골라주세요.",
    type: "multi",
    options: [
      "남편이 핸드폰만 볼 때",
      "내 말을 끝까지 듣지 않을 때",
      "집안일을 당연하게 내 몫으로 여길 때",
      "아기 울음에 나만 반응해야 할 때",
      "피곤하다는 말을 못할 것 같을 때",
      "남편이 내 감정을 이해 못한다고 느낄 때",
      "혼자 모든 것을 감당해야 할 때",
      "잠을 제대로 못 잘 때",
      "내 몸이 예전 같지 않다고 느낄 때",
    ],
  },
  {
    key: "wishFromHusband",
    question: "남편이 이렇게 해줬으면 해요",
    emoji: "🙏",
    description: "지금 가장 원하는 것을 모두 골라주세요.",
    type: "multi",
    options: [
      "그냥 옆에 있어주기",
      "내 얘기 끊지 말고 끝까지 듣기",
      "먼저 집안일 나서서 하기",
      "아기 돌봄 역할 나누기 (목욕·재우기)",
      "\"힘들지?\" 하고 먼저 물어봐주기",
      "\"잘하고 있어\" 칭찬해주기",
      "나만의 자유 시간 만들어주기",
      "전문 상담을 같이 알아봐주기",
    ],
  },
];

const STEPS = ["역할 선택", "동의", "자가 진단", "니즈 설문", "플랜 생성"];

function generateWifePlan(needs: WifeNeedsState, phqScore: number): WellnessPlan {
  const dailyGoals: string[] = ["매일 감정 기록하기 💬"];
  const partnerTasks: string[] = [];

  // 감정 상태 기반
  if (needs.emotionState.includes("많이 힘들") || needs.emotionState.includes("조금 힘들")) {
    dailyGoals.push("하루 10분 혼자만의 시간 갖기");
  } else {
    dailyGoals.push("오늘 기분 좋았던 순간 1가지 적기");
  }

  // 대화 빈도 기반
  if (needs.husbandTalkFreq.includes("거의 대화가 없어요") || needs.husbandTalkFreq.includes("짧게")) {
    partnerTasks.push("하루 15분 단둘이 대화 시간 정해두기");
    dailyGoals.push("오늘 하루 중 한 가지를 남편에게 이야기하기");
  }

  // 편안함을 주는 것 기반
  if (needs.comfortThings.includes("밖에 나가 바람 쐬기")) {
    dailyGoals.push("짧은 산책 (10~15분)");
  }
  if (needs.comfortThings.includes("따뜻한 스킨십 (포옹, 손잡기)")) {
    partnerTasks.push("아침/저녁 포옹 한 번씩");
  }
  if (needs.comfortThings.includes("\"잘하고 있어\"라고 말해줄 때")) {
    partnerTasks.push("매일 진심 어린 칭찬 한 마디");
  }
  if (needs.comfortThings.includes("집안이 정돈되어 있을 때")) {
    partnerTasks.push("퇴근 후 간단한 정리 담당하기");
  }

  // 불편함을 주는 것 기반
  if (needs.discomfortThings.includes("아기 울음에 나만 반응해야 할 때")) {
    partnerTasks.push("아기 울음 대응 번갈아 맡기");
  }
  if (needs.discomfortThings.includes("잠을 제대로 못 잘 때")) {
    partnerTasks.push("주 2회 이상 밤 수유/달래기 교대하기");
    dailyGoals.push("낮잠 기회 만들기 (30분이라도)");
  }
  if (needs.discomfortThings.includes("혼자 모든 것을 감당해야 할 때")) {
    partnerTasks.push("집안일 역할 목록 함께 나누기");
  }

  // 남편에게 원하는 것 기반
  if (needs.wishFromHusband.includes("나만의 자유 시간 만들어주기")) {
    partnerTasks.push("주말 2시간 아내 자유 시간 보장");
    dailyGoals.push("하고 싶은 것 하나 떠올려 적기");
  }
  if (needs.wishFromHusband.includes("아기 돌봄 역할 나누기 (목욕·재우기)")) {
    partnerTasks.push("아기 목욕·취침 루틴 담당하기");
  }
  if (needs.wishFromHusband.includes("전문 상담을 같이 알아봐주기")) {
    partnerTasks.push("산후 전문 상담 예약 함께 알아보기");
  }

  // PHQ-9 점수 기반
  if (phqScore >= 15) {
    dailyGoals.push("⚠️ 정신건강 위기상담: 1577-0199 (24시간)");
  } else if (phqScore >= 10) {
    dailyGoals.push("주 1회 전문 상담 받아보기");
  }

  return {
    dailyGoals: [...new Set(dailyGoals)],
    weeklyCheckIn: "매주 일요일 저녁 커플 감정 체크인",
    partnerTasks: [...new Set(partnerTasks)],
  };
}

export default function OnboardingPage() {
  const router = useRouter();
  const { setUser, setOnboardingStep, user } = useAppStore();
  const [step, setStep] = useState(0);
  const [role, setRole] = useState<UserRole | null>(null);
  const [phqAnswers, setPhqAnswers] = useState<number[]>(Array(9).fill(0));
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [wifeNeedsStep, setWifeNeedsStep] = useState(0);
  const [wifeNeeds, setWifeNeeds] = useState<WifeNeedsState>({
    emotionState: "",
    husbandTalkFreq: "",
    comfortThings: [],
    discomfortThings: [],
    wishFromHusband: [],
  });
  const [husbandQuizStep, setHusbandQuizStep] = useState(0);
  const [husbandAnswers, setHusbandAnswers] = useState<(string | string[])[]>(
    Array(HUSBAND_QUESTIONS.length).fill(null)
  );
  const [husbandMultiSelected, setHusbandMultiSelected] = useState<string[]>([]);
  const [generatedPlan, setGeneratedPlan] = useState<WellnessPlan | null>(null);

  const progress = ((step + 1) / STEPS.length) * 100;
  const phqTotal = phqAnswers.reduce((a, b) => a + b, 0);

  const handleRoleSelect = (selected: UserRole) => {
    setRole(selected);
    setUser({ ...user!, role: selected });
    setStep(1);
  };

  const handleConsent = () => setStep(2);

  // PHQ-9 (아내)
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

  // 남편 자가진단
  const handleHusbandSingle = (value: string) => {
    const updated = [...husbandAnswers];
    updated[husbandQuizStep] = value;
    setHusbandAnswers(updated);
    if (husbandQuizStep < HUSBAND_QUESTIONS.length - 1) {
      setHusbandQuizStep((s) => s + 1);
      setHusbandMultiSelected([]);
    } else {
      setStep(3);
    }
  };

  const handleHusbandMultiNext = () => {
    const updated = [...husbandAnswers];
    updated[husbandQuizStep] = husbandMultiSelected;
    setHusbandAnswers(updated);

    // 자가진단 답변 기반 플랜 생성 후 바로 step 4로
    const answers = updated;
    const dailyGoals: string[] = ["아내에게 먼저 말 걸기 💬"];
    if (typeof answers[0] === "string" && (answers[0].includes("전혀") || answers[0].includes("어렴풋"))) {
      dailyGoals.push("산후우울증 정보 1가지 읽어보기");
    }
    if (typeof answers[1] === "string" && (answers[1].includes("기억") || answers[1].includes("일주일"))) {
      dailyGoals.push("오늘 퇴근 후 아내에게 \"오늘 어땠어?\" 물어보기");
    }
    if (typeof answers[3] === "string" && answers[3].includes("전담")) {
      dailyGoals.push("오늘 아기 돌봄 한 가지 자발적으로 하기");
    }
    if (typeof answers[4] === "string" && answers[4].includes("아내가")) {
      dailyGoals.push("집에 오면 설거지 또는 청소 한 가지 먼저 하기");
    }
    const plan: WellnessPlan = {
      dailyGoals: [...new Set(dailyGoals)],
      weeklyCheckIn: "매주 일요일 저녁 커플 감정 체크인",
      partnerTasks: ["아내 감정 기록 확인하기", "집안일 역할 나누기", "아내 자유 시간 만들어주기"],
    };
    setGeneratedPlan(plan);
    setStep(4);
  };

  const currentWifeQ = WIFE_NEEDS_QUESTIONS[wifeNeedsStep];

  const handleWifeNeedsSingle = (value: string) => {
    const key = currentWifeQ.key as keyof WifeNeedsState;
    setWifeNeeds((prev) => ({ ...prev, [key]: value }));
    if (wifeNeedsStep < WIFE_NEEDS_QUESTIONS.length - 1) {
      setWifeNeedsStep((s) => s + 1);
    } else {
      const plan = generateWifePlan({ ...wifeNeeds, [key]: value }, phqTotal);
      setGeneratedPlan(plan);
      setStep(4);
    }
  };

  const handleWifeNeedsMultiToggle = (option: string) => {
    const key = currentWifeQ.key as keyof WifeNeedsState;
    const current = wifeNeeds[key] as string[];
    setWifeNeeds((prev) => ({
      ...prev,
      [key]: current.includes(option)
        ? current.filter((o) => o !== option)
        : [...current, option],
    }));
  };

  const handleWifeNeedsMultiNext = () => {
    const key = currentWifeQ.key as keyof WifeNeedsState;
    if (wifeNeedsStep < WIFE_NEEDS_QUESTIONS.length - 1) {
      setWifeNeedsStep((s) => s + 1);
    } else {
      const plan = generateWifePlan(wifeNeeds, phqTotal);
      setGeneratedPlan(plan);
      setStep(4);
    }
  };

  const handleNeedsSubmit = () => {
    // 남편 자가진단 답변 기반 플랜 생성
    const answers = husbandAnswers;
    const dailyGoals: string[] = ["아내에게 먼저 말 걸기 💬"];

    // Q1: 아내 상태 인식
    if (typeof answers[0] === "string" && (answers[0].includes("전혀") || answers[0].includes("어렴풋"))) {
      dailyGoals.push("산후우울증 정보 1가지 읽어보기");
    }
    // Q2: 대화 빈도
    if (typeof answers[1] === "string" && (answers[1].includes("기억") || answers[1].includes("일주일"))) {
      dailyGoals.push("오늘 퇴근 후 아내에게 \"오늘 어땠어?\" 물어보기");
    }
    // Q4: 아기 돌봄
    if (typeof answers[3] === "string" && answers[3].includes("전담")) {
      dailyGoals.push("오늘 아기 돌봄 한 가지 자발적으로 하기");
    }
    // Q5: 집안일
    if (typeof answers[4] === "string" && answers[4].includes("아내가")) {
      dailyGoals.push("집에 오면 설거지 또는 청소 한 가지 먼저 하기");
    }

    const plan: WellnessPlan = {
      dailyGoals: [...new Set(dailyGoals)],
      weeklyCheckIn: "매주 일요일 저녁 커플 감정 체크인",
      partnerTasks: ["아내 감정 기록 확인하기", "집안일 역할 나누기", "아내 자유 시간 만들어주기"],
    };
    setGeneratedPlan(plan);
    setStep(4);
  };

  const handleFinish = () => {
    if (generatedPlan) {
      setUser({ ...user!, plan: generatedPlan });
    }
    setOnboardingStep(4);
    router.push("/dashboard");
  };

  return (
    <div className="min-h-screen bg-rose-50 flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-md space-y-4">
        {/* 진행 표시 */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-gray-400">
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
                <span>👩 아내 (산모)</span>
                <span className="block text-sm text-gray-500 mt-1">감정을 기록하고 지원을 받을게요</span>
              </Button>
              <Button
                className="h-20 text-lg bg-blue-100 hover:bg-blue-200 text-blue-700 border border-blue-300"
                variant="outline"
                onClick={() => handleRoleSelect("husband")}
              >
                <span>👨 남편</span>
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

        {/* Step 2: 아내 - PHQ-9 자가 진단 / 남편 - 관계·노력도 자가진단 */}
        {step === 2 && role === "wife" && (
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
              {/* key를 currentQuestion으로 설정해 질문 바뀔 때 RadioGroup 초기화 */}
              <RadioGroup
                key={currentQuestion}
                onValueChange={(v) => handlePhqAnswer(Number(v))}
                className="space-y-2"
              >
                {SCORE_OPTIONS.map((opt) => (
                  <div key={opt.value} className="flex items-center space-x-2">
                    <RadioGroupItem value={opt.value} id={`phq-${opt.value}`} />
                    <Label htmlFor={`phq-${opt.value}`}>{opt.label}</Label>
                  </div>
                ))}
              </RadioGroup>
            </CardContent>
          </Card>
        )}

        {step === 2 && role === "husband" && (() => {
          const q = HUSBAND_QUESTIONS[husbandQuizStep];
          const isMulti = !!q.multi;
          return (
            <Card>
              <CardHeader>
                <CardTitle>
                  {q.emoji} {q.question}
                </CardTitle>
                <CardDescription>
                  ({husbandQuizStep + 1}/{HUSBAND_QUESTIONS.length}) {q.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {!isMulti ? (
                  q.options.map((opt) => (
                    <Button
                      key={opt}
                      variant="outline"
                      className="w-full justify-start hover:bg-blue-50 hover:border-blue-400 text-left h-auto py-3"
                      onClick={() => handleHusbandSingle(opt)}
                    >
                      {opt}
                    </Button>
                  ))
                ) : (
                  <>
                    <div className="flex flex-wrap gap-2">
                      {q.options.map((opt) => (
                        <button
                          key={opt}
                          onClick={() =>
                            setHusbandMultiSelected((prev) =>
                              prev.includes(opt) ? prev.filter((o) => o !== opt) : [...prev, opt]
                            )
                          }
                          className={`px-3 py-2 rounded-xl text-sm border transition-colors text-left ${
                            husbandMultiSelected.includes(opt)
                              ? "bg-blue-500 text-white border-blue-500"
                              : "bg-white text-gray-600 border-gray-200 hover:border-blue-300"
                          }`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                    <Button
                      className="w-full bg-blue-500 hover:bg-blue-600 text-white mt-2"
                      onClick={handleHusbandMultiNext}
                    >
                      완료 ✓
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          );
        })()}

        {/* Step 3: 니즈 설문 - 아내 */}
        {step === 3 && role === "wife" && (
          <Card>
            <CardHeader>
              <CardTitle>
                {currentWifeQ.emoji} {currentWifeQ.question}
              </CardTitle>
              <CardDescription>
                ({wifeNeedsStep + 1}/{WIFE_NEEDS_QUESTIONS.length}){" "}
                {"description" in currentWifeQ ? currentWifeQ.description : "솔직하게 답해주세요"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {currentWifeQ.type === "single" ? (
                currentWifeQ.options.map((opt) => (
                  <Button
                    key={opt}
                    variant="outline"
                    className="w-full justify-start hover:bg-rose-50 hover:border-rose-400 text-left h-auto py-3"
                    onClick={() => handleWifeNeedsSingle(opt)}
                  >
                    {opt}
                  </Button>
                ))
              ) : (
                <>
                  <div className="flex flex-wrap gap-2">
                    {currentWifeQ.options.map((opt) => {
                      const selected = (wifeNeeds[currentWifeQ.key as keyof WifeNeedsState] as string[]).includes(opt);
                      return (
                        <button
                          key={opt}
                          onClick={() => handleWifeNeedsMultiToggle(opt)}
                          className={`px-3 py-2 rounded-xl text-sm border transition-colors text-left ${
                            selected
                              ? "bg-rose-500 text-white border-rose-500"
                              : "bg-white text-gray-600 border-gray-200 hover:border-rose-300"
                          }`}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                  <Button
                    className="w-full bg-rose-500 hover:bg-rose-600 text-white mt-2"
                    onClick={handleWifeNeedsMultiNext}
                  >
                    {wifeNeedsStep < WIFE_NEEDS_QUESTIONS.length - 1 ? "다음 →" : "완료 ✓"}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 3: 남편은 step 2에서 바로 step 4로 이동하므로 여기서 처리 불필요 */}
        {step === 3 && role === "husband" && null}

        {/* Step 4: 플랜 생성 완료 */}
        {step === 4 && generatedPlan && (
          <Card>
            <CardHeader className="text-center">
              <div className="text-4xl mb-1">🎉</div>
              <CardTitle>맞춤 플랜이 완성됐어요!</CardTitle>
              <CardDescription>
                {role === "wife"
                  ? "답변을 분석해 나만을 위한 회복 플랜을 만들었어요"
                  : "아내를 도울 수 있는 맞춤 가이드가 준비됐어요"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                  {role === "wife" ? "나의 일일 목표" : "오늘부터 실천할 것들"}
                </p>
                {generatedPlan.dailyGoals.map((goal, i) => (
                  <p key={i} className="text-sm text-gray-700 mb-1">✅ {goal}</p>
                ))}
              </div>
              {generatedPlan.partnerTasks.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                    {role === "wife" ? "남편에게 요청할 것들" : "아내를 위한 파트너 과제"}
                  </p>
                  {generatedPlan.partnerTasks.map((task, i) => (
                    <p key={i} className="text-sm text-gray-700 mb-1">💙 {task}</p>
                  ))}
                </div>
              )}
              <div className="bg-rose-50 rounded-lg p-3 text-sm text-rose-700">
                📅 {generatedPlan.weeklyCheckIn}
              </div>
              <Button
                className="w-full bg-rose-500 hover:bg-rose-600 text-white mt-2"
                onClick={handleFinish}
              >
                시작하기 🌸
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export type UserRole = "wife" | "husband";

export interface User {
  id: string;
  name: string;
  role: UserRole;
  partnerId?: string;
  plan?: WellnessPlan;
  phqScore?: number;         // PHQ-9 총점 (아내)
  wifeNeeds?: {
    emotionState: string;
    husbandTalkFreq: string;
    comfortThings: string[];
    discomfortThings: string[];
    wishFromHusband: string[];
  };
  husbandAnswers?: string[]; // 남편 자가진단 답변
}

export interface MoodEntry {
  id: string;
  userId: string;
  text: string;
  sentimentScore: number; // 0~10, 낮을수록 우울
  depressionLevel: "low" | "medium" | "high";
  reasons: string[];
  recommendations: string[];
  createdAt: string;
}

export interface PHQ9Answer {
  questionIndex: number;
  score: number; // 0~3
}

export interface EPDSAnswer {
  questionIndex: number;
  score: number; // 0~3
}

export interface NeedsAnswer {
  category: string;
  response: string;
}

export interface WellnessPlan {
  dailyGoals: string[];
  weeklyCheckIn: string;
  partnerTasks: string[];
}

export interface PartnerReminder {
  id: string;
  message: string;
  isActive: boolean;
  triggeredAt?: string;
}

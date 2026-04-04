"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/store/useAppStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";

export default function LoginPage() {
  const router = useRouter();
  const { setUser, setToken } = useAppStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // TODO: 실제 API 연동 시 교체
      const mockUser = { id: "1", name: "사용자", role: "wife" as const };
      setToken("mock-token");
      setUser(mockUser);
      router.push("/onboarding");
    } catch {
      toast.error("로그인에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-rose-50 px-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center pb-2">
          <div className="text-4xl mb-2">🌸</div>
          <CardTitle className="text-2xl text-rose-700">산후 웰니스</CardTitle>
          <CardDescription className="text-gray-500">
            함께하는 산후 회복 여정
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="email">이메일</Label>
              <Input
                id="email"
                type="email"
                placeholder="example@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="password">비밀번호</Label>
              <Input
                id="password"
                type="password"
                placeholder="비밀번호를 입력하세요"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-rose-500 hover:bg-rose-600 text-white"
              disabled={loading}
            >
              {loading ? "로그인 중..." : "로그인"}
            </Button>
            <p className="text-center text-sm text-gray-500">
              계정이 없으신가요?{" "}
              <span className="text-rose-500 cursor-pointer hover:underline">
                회원가입
              </span>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

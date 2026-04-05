"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/store/useAppStore";

export default function Home() {
  const router = useRouter();
  const { user, setUser, setToken } = useAppStore();

  useEffect(() => {
    // Auto-set a guest user if none exists, skip login entirely
    if (!user) {
      setToken("guest");
      setUser({ id: "guest", name: "사용자", role: "wife" });
    }
    router.replace("/onboarding");
  }, []);

  return null;
}

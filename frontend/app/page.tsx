"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./auth/auth-context";

export default function HomePage() {
  const router = useRouter();
  const { accessToken, isAuthReady, user } = useAuth();

  useEffect(() => {
    if (!isAuthReady) return;

    router.replace(user && accessToken ? "/posts" : "/login");
  }, [accessToken, isAuthReady, router, user]);

  return (
    <main className="page-shell state-page">
      <section className="state-card" aria-live="polite">
        <span className="loading-spinner" aria-hidden="true" />
        <h1>로그인 상태 확인 중</h1>
        <p>잠시만 기다려주세요.</p>
      </section>
    </main>
  );
}

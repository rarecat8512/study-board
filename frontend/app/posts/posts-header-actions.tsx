"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "../auth/auth-context";

export function PostsHeaderActions() {
  const router = useRouter();
  const { accessToken, isAuthReady, logout, user } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleLogout() {
    setIsLoggingOut(true);
    await logout();
    router.replace("/login");
  }

  if (!isAuthReady) {
    return <span className="auth-status auth-status-checking">로그인 상태 확인 중...</span>;
  }

  if (!user || !accessToken) {
    return <Link className="primary-link" href="/login">로그인</Link>;
  }

  return (
    <>
      <Link className="primary-link" href="/posts/new">글 작성</Link>
      <Link className="secondary-link" href="/mypage">마이페이지</Link>
      <button
        className="logout-button"
        type="button"
        disabled={isLoggingOut}
        onClick={() => void handleLogout()}
      >
        {isLoggingOut ? "로그아웃 중..." : "로그아웃"}
      </button>
    </>
  );
}

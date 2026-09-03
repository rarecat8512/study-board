"use client";

import Link from "next/link";
import { useAuth } from "./auth-context";

export function AuthStatus() {
  const { accessToken, user, isAuthReady, logout } = useAuth();

  if (!isAuthReady) {
    return (
      <div className="auth-status auth-status-checking" aria-live="polite">
        <span className="status-dot status-dot-checking" aria-hidden="true" />
        <span>로그인 상태 확인 중...</span>
      </div>
    );
  }

  if (user && accessToken) {
    return (
      <div className="signed-in-actions">
        <div className="auth-status auth-status-signed-in">
          <span className="status-dot" aria-hidden="true" />
          <span>{user.name}님, 로그인되었습니다.</span>
        </div>
        <Link className="primary-link" href="/posts/new">
          글 작성
        </Link>
        <Link className="secondary-link" href="/mypage">
          마이페이지
        </Link>
        <button className="logout-button" type="button" onClick={() => void logout()}>
          로그아웃
        </button>
      </div>
    );
  }

  return (
    <Link className="primary-link" href="/login">
      로그인하기
    </Link>
  );
}

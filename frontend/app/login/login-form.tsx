"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useAuth } from "../auth/auth-context";

export function LoginForm({ notice }: { notice?: string }) {
  const router = useRouter();
  const { isAuthReady, login } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage("");

    const formData = new FormData(event.currentTarget);

    try {
      await login({
        email: String(formData.get("email") ?? ""),
        password: String(formData.get("password") ?? "")
      });
      router.push("/");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "로그인 중 문제가 발생했습니다."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="login-card">
      <div className="login-heading">
        <p className="eyebrow">Welcome back</p>
        <h1 className="login-title">로그인</h1>
        <p className="login-description">이메일 인증을 완료한 계정으로 로그인해주세요.</p>
      </div>

      <form className="login-form" onSubmit={handleSubmit}>
        {notice ? <p className="form-success" role="status">{notice}</p> : null}
        <label className="form-field">
          <span>이메일</span>
          <input
            name="email"
            type="email"
            autoComplete="email"
            placeholder="name@example.com"
            required
          />
        </label>

        <label className="form-field">
          <span>비밀번호</span>
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="비밀번호를 입력해주세요"
            required
          />
        </label>

        {errorMessage ? (
          <p className="form-error" role="alert">
            {errorMessage}
          </p>
        ) : null}

        <button className="login-button" type="submit" disabled={isSubmitting || !isAuthReady}>
          {!isAuthReady ? "로그인 상태 확인 중..." : isSubmitting ? "로그인 중..." : "로그인"}
        </button>
      </form>

      <p className="auth-switch">아직 계정이 없나요? <Link href="/register">회원가입</Link></p>

      <Link className="back-link" href="/">
        홈으로 돌아가기
      </Link>
    </section>
  );
}

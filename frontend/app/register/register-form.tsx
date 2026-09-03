"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { apiFetch, readApiResponse } from "../lib/api";

type RegisterResponse = {
  message?: string;
  user?: { id: number; email: string; name: string };
};

export function RegisterForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [registeredEmail, setRegisteredEmail] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage("");
    const form = event.currentTarget;
    const formData = new FormData(form);
    const password = String(formData.get("password") ?? "");
    const passwordConfirm = String(formData.get("passwordConfirm") ?? "");

    if (password !== passwordConfirm) {
      setErrorMessage("비밀번호가 일치하지 않습니다.");
      setIsSubmitting(false);
      return;
    }

    try {
      const response = await apiFetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: String(formData.get("email") ?? ""),
          password,
          name: String(formData.get("name") ?? "")
        })
      });
      const result = await readApiResponse<RegisterResponse>(response, "회원가입을 완료하지 못했습니다.");
      if (!result.user) throw new Error("회원가입 응답이 올바르지 않습니다.");
      setRegisteredEmail(result.user.email);
      form.reset();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "회원가입 중 문제가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (registeredEmail) {
    return (
      <section className="login-card register-complete" aria-live="polite">
        <div className="verification-icon verification-icon-success" aria-hidden="true">✓</div>
        <p className="eyebrow">Check your email</p>
        <h1 className="login-title">인증 메일을 확인해주세요</h1>
        <p className="login-description"><strong>{registeredEmail}</strong> 주소로 인증 링크를 보냈습니다. 링크를 열어 인증한 뒤 로그인할 수 있습니다.</p>
        <Link className="primary-link" href="/login">로그인 화면으로</Link>
      </section>
    );
  }

  return (
    <section className="login-card register-card">
      <div className="login-heading">
        <p className="eyebrow">Create account</p>
        <h1 className="login-title">회원가입</h1>
        <p className="login-description">이메일 인증을 완료하면 게시글과 댓글을 작성할 수 있습니다.</p>
      </div>
      <form className="login-form" onSubmit={handleSubmit}>
        <label className="form-field"><span>이름</span><input name="name" autoComplete="name" minLength={2} maxLength={50} placeholder="이름을 입력해주세요" required /></label>
        <label className="form-field"><span>이메일</span><input name="email" type="email" autoComplete="email" maxLength={255} placeholder="name@example.com" required /></label>
        <label className="form-field"><span>비밀번호</span><input name="password" type="password" autoComplete="new-password" minLength={8} placeholder="8자 이상 입력해주세요" required /></label>
        <label className="form-field"><span>비밀번호 확인</span><input name="passwordConfirm" type="password" autoComplete="new-password" minLength={8} placeholder="비밀번호를 다시 입력해주세요" required /></label>
        {errorMessage ? <p className="form-error" role="alert">{errorMessage}</p> : null}
        <button className="login-button" type="submit" disabled={isSubmitting}>{isSubmitting ? "가입 중..." : "회원가입"}</button>
      </form>
      <p className="auth-switch">이미 계정이 있나요? <Link href="/login">로그인</Link></p>
      <Link className="back-link" href="/">홈으로 돌아가기</Link>
    </section>
  );
}

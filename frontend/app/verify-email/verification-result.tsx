"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { apiFetch, readApiResponse } from "../lib/api";

type VerificationStatus = "loading" | "success" | "error";

export function VerificationResult({ token }: { token?: string }) {
  const requestStarted = useRef(false);
  const [status, setStatus] = useState<VerificationStatus>(token ? "loading" : "error");
  const [errorMessage, setErrorMessage] = useState(
    token ? "" : "인증 토큰이 없습니다. 이메일의 인증 링크를 다시 확인해주세요."
  );

  useEffect(() => {
    if (!token || requestStarted.current) {
      return;
    }

    requestStarted.current = true;

    async function verify() {
      try {
        const response = await apiFetch("/api/auth/verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token })
        });

        await readApiResponse(response, "이메일 인증에 실패했습니다.");

        setStatus("success");
      } catch (error) {
        setStatus("error");
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "이메일 인증 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요."
        );
      }
    }

    void verify();
  }, [token]);

  if (status === "loading") {
    return (
      <section className="verification-card" aria-live="polite">
        <div className="verification-icon verification-icon-loading" aria-hidden="true">
          <span className="spinner" />
        </div>
        <p className="eyebrow">Email verification</p>
        <h1 className="verification-title">이메일을 확인하고 있어요</h1>
        <p className="verification-description">
          인증 링크가 유효한지 확인 중입니다. 잠시만 기다려주세요.
        </p>
      </section>
    );
  }

  if (status === "success") {
    return (
      <section className="verification-card" aria-live="polite">
        <div className="verification-icon verification-icon-success" aria-hidden="true">
          ✓
        </div>
        <p className="eyebrow">Verification complete</p>
        <h1 className="verification-title">이메일 인증이 완료됐어요</h1>
        <p className="verification-description">
          이제 Study Board의 모든 기능을 사용할 수 있습니다.
        </p>
        <Link className="primary-link" href="/login">
          로그인하러 가기
        </Link>
      </section>
    );
  }

  return (
    <section className="verification-card" aria-live="assertive">
      <div className="verification-icon verification-icon-error" aria-hidden="true">
        !
      </div>
      <p className="eyebrow eyebrow-error">Verification failed</p>
      <h1 className="verification-title">이메일을 인증할 수 없어요</h1>
      <p className="verification-description">{errorMessage}</p>
      <Link className="secondary-link" href="/">
        홈으로 돌아가기
      </Link>
    </section>
  );
}

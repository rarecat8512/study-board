"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <main className="page-shell state-page">
      <section className="state-card" role="alert">
        <p className="eyebrow">Something went wrong</p><h1>화면을 불러오지 못했어요</h1>
        <p>잠시 후 다시 시도해주세요. 같은 문제가 계속되면 서버 실행 상태를 확인해주세요.</p>
        <div><button className="login-button" type="button" onClick={reset}>다시 시도</button><Link className="secondary-link" href="/">홈으로</Link></div>
      </section>
    </main>
  );
}

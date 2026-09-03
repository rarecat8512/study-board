import { AuthStatus } from "./auth/auth-status";
import Link from "next/link";

export default function HomePage() {
  return (
    <main className="page-shell">
      <section className="hero">
        <p className="eyebrow">Frontend to FullStack</p>
        <h1>Study Board</h1>
        <p className="description">
          Next.js, Express, Prisma, MySQL과 JWT 인증 흐름을 이해하며 만드는 학습용 게시판입니다.
        </p>
        <div className="status-card">
          <span className="status-dot" aria-hidden="true" />
          <span>인증·게시판 핵심 기능 구현 완료</span>
        </div>
        <div className="home-actions">
          <Link className="secondary-link" href="/posts">게시글 보기</Link>
          <AuthStatus />
        </div>
      </section>
    </main>
  );
}

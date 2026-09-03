import Link from "next/link";

export default function NotFound() {
  return <main className="page-shell state-page"><section className="state-card"><p className="eyebrow">404</p><h1>페이지를 찾을 수 없어요</h1><p>주소가 잘못되었거나 이동한 페이지일 수 있습니다.</p><div><Link className="primary-link" href="/posts">게시글 목록</Link><Link className="secondary-link" href="/">홈으로</Link></div></section></main>;
}

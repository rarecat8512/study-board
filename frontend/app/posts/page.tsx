import Link from "next/link";
import { PostList } from "./post-list";

type PostsPageProps = {
  searchParams: Promise<{ page?: string | string[]; q?: string | string[] }>;
};

export default async function PostsPage({ searchParams }: PostsPageProps) {
  const params = await searchParams;
  const requestedPage = params.page;
  const requestedQuery = Array.isArray(params.q) ? params.q[0] : params.q;
  const query = (requestedQuery ?? "").trim().slice(0, 100);
  const pageValue = Array.isArray(requestedPage) ? requestedPage[0] : requestedPage;
  const parsedPage = Number(pageValue ?? "1");
  const page = Number.isSafeInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  return (
    <main className="posts-page">
      <header className="posts-header">
        <div>
          <p className="eyebrow">Study records</p>
          <h1 className="posts-title">게시글</h1>
          <p className="posts-description">배운 것과 고민한 내용을 함께 기록합니다.</p>
        </div>
        <div className="posts-header-actions">
          <Link className="secondary-link" href="/">홈</Link>
          <Link className="primary-link" href="/posts/new">글 작성</Link>
        </div>
      </header>
      <form className="post-search" action="/posts" method="get" role="search">
        <label className="visually-hidden" htmlFor="post-search-query">게시글 검색</label>
        <input id="post-search-query" name="q" defaultValue={query} maxLength={100} placeholder="제목이나 내용으로 검색" />
        <button className="login-button" type="submit">검색</button>
        {query ? <Link className="secondary-link" href="/posts">초기화</Link> : null}
      </form>
      <PostList page={page} query={query} />
    </main>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch, readApiResponse } from "../lib/api";

type PostSummary = {
  id: number;
  title: string;
  content: string;
  createdAt: string;
  isDeleted: boolean;
  author: {
    id: number | null;
    name: string;
  };
};

type PostListResponse = {
  posts: PostSummary[];
  pagination: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
  };
};

export function PostList({ page, query }: { page: number; query: string }) {
  const [data, setData] = useState<PostListResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let isCurrent = true;

    const params = new URLSearchParams({ page: String(page), limit: "10" });
    if (query) params.set("q", query);

    void apiFetch(`/api/posts?${params.toString()}`)
      .then((response) => readApiResponse<PostListResponse>(response, "게시글 목록을 불러오지 못했습니다."))
      .then((result) => {
        if (isCurrent) {
          setData(result);
          setErrorMessage("");
        }
      })
      .catch((error: unknown) => {
        if (isCurrent) {
          setErrorMessage(
            error instanceof Error ? error.message : "게시글 목록을 불러오지 못했습니다."
          );
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [page, query]);

  if (errorMessage) {
    return <p className="post-list-message post-list-error" role="alert">{errorMessage}</p>;
  }

  if (!data) {
    return <p className="post-list-message" aria-live="polite">게시글을 불러오고 있어요...</p>;
  }

  if (data.posts.length === 0) {
    return (
      <div className="empty-posts">
        <p>{query ? `“${query}” 검색 결과가 없습니다.` : "아직 작성된 게시글이 없습니다."}</p>
        {query ? <Link className="secondary-link" href="/posts">전체 게시글 보기</Link> : <Link className="primary-link" href="/posts/new">첫 글 작성하기</Link>}
      </div>
    );
  }

  const firstPage = Math.min(
    Math.max(1, data.pagination.page - 2),
    Math.max(1, data.pagination.totalPages - 4)
  );
  const lastPage = Math.min(data.pagination.totalPages, firstPage + 4);
  const pageNumbers = Array.from(
    { length: lastPage - firstPage + 1 },
    (_, index) => firstPage + index
  );
  const pageHref = (targetPage: number) => {
    const params = new URLSearchParams({ page: String(targetPage) });
    if (query) params.set("q", query);
    return `/posts?${params.toString()}`;
  };

  return (
    <>
      <div className="post-list" aria-live="polite">
        {data.posts.map((post) => (
          <article className={`post-summary${post.isDeleted ? " post-summary-deleted" : ""}`} key={post.id}>
            <div className="post-summary-meta">
              <span>{post.author.name}</span>
              <time dateTime={post.createdAt}>
                {new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium" }).format(new Date(post.createdAt))}
              </time>
            </div>
            <h2><Link href={`/posts/${post.id}`}>{post.title}</Link></h2>
            <p>{post.content.length > 140 ? `${post.content.slice(0, 140)}…` : post.content}</p>
          </article>
        ))}
      </div>

      <nav className="pagination" aria-label="게시글 페이지">
        {data.pagination.page > 1 ? (
          <Link href={pageHref(data.pagination.page - 1)}>이전</Link>
        ) : null}
        {pageNumbers.map((pageNumber) => (
          <Link
            aria-current={pageNumber === data.pagination.page ? "page" : undefined}
            className={pageNumber === data.pagination.page ? "pagination-current" : ""}
            href={pageHref(pageNumber)}
            key={pageNumber}
          >
            {pageNumber}
          </Link>
        ))}
        {data.pagination.page < data.pagination.totalPages ? (
          <Link href={pageHref(data.pagination.page + 1)}>다음</Link>
        ) : null}
      </nav>
    </>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "../auth/auth-context";
import { apiUrl, readApiResponse } from "../lib/api";
import { AccountSettings } from "./account-settings";

type MyPageData = {
  user: { id: number; email: string; name: string; createdAt: string };
  counts: { posts: number; comments: number };
  posts: Array<{ id: number; title: string; content: string; createdAt: string; isDeleted: boolean }>;
  comments: Array<{
    id: number;
    content: string;
    createdAt: string;
    isDeleted: boolean;
    isReply: boolean;
    post: { id: number; title: string; isDeleted: boolean };
  }>;
};

export function MyPage() {
  const { accessToken, authorizedFetch, isAuthReady, user } = useAuth();
  const [data, setData] = useState<MyPageData | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!isAuthReady || !accessToken || !user) return;
    let isCurrent = true;
    void authorizedFetch(apiUrl("/api/users/me"))
      .then((response) => readApiResponse<MyPageData>(response, "마이페이지를 불러오지 못했습니다."))
      .then((result) => { if (isCurrent) setData(result); })
      .catch((error: unknown) => { if (isCurrent) setErrorMessage(error instanceof Error ? error.message : "마이페이지를 불러오지 못했습니다."); });
    return () => { isCurrent = false; };
  }, [accessToken, authorizedFetch, isAuthReady, user]);

  if (!isAuthReady) return <section className="mypage-message"><h1>로그인 상태를 확인하고 있어요</h1></section>;
  if (!user || !accessToken) return <section className="mypage-message"><h1>로그인이 필요해요</h1><p>내 활동은 로그인한 사용자만 확인할 수 있습니다.</p><Link className="primary-link" href="/login">로그인하러 가기</Link></section>;
  if (errorMessage) return <section className="mypage-message"><h1>불러오지 못했어요</h1><p className="form-error">{errorMessage}</p><Link className="secondary-link" href="/">홈으로</Link></section>;
  if (!data) return <section className="mypage-message" aria-live="polite"><h1>내 활동을 불러오고 있어요</h1></section>;

  return (
    <>
      <header className="mypage-header">
        <div><p className="eyebrow">My activity</p><h1>마이페이지</h1><p>{data.user.name}님의 학습 기록을 모아봤어요.</p></div>
        <Link className="secondary-link" href="/">홈</Link>
      </header>
      <section className="profile-card">
        <div><span>이름</span><strong>{data.user.name}</strong></div>
        <div><span>이메일</span><strong>{data.user.email}</strong></div>
        <div><span>가입일</span><strong>{new Intl.DateTimeFormat("ko-KR", { dateStyle: "long" }).format(new Date(data.user.createdAt))}</strong></div>
      </section>
      <div className="activity-counts"><div><strong>{data.counts.posts}</strong><span>작성한 게시글</span></div><div><strong>{data.counts.comments}</strong><span>작성한 댓글·대댓글</span></div></div>
      <section className="activity-section">
        <div className="activity-heading"><h2>내 게시글</h2><Link href="/posts/new">새 글 작성</Link></div>
        {data.posts.length ? <div className="activity-list">{data.posts.map((post) => <Link className={post.isDeleted ? "activity-item activity-item-deleted" : "activity-item"} href={`/posts/${post.id}`} key={post.id}><strong>{post.title}</strong><span>{new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium" }).format(new Date(post.createdAt))}</span><p>{post.content.length > 90 ? `${post.content.slice(0, 90)}…` : post.content}</p></Link>)}</div> : <p className="activity-empty">작성한 게시글이 없습니다.</p>}
      </section>
      <section className="activity-section">
        <div className="activity-heading"><h2>내 댓글</h2></div>
        {data.comments.length ? <div className="activity-list">{data.comments.map((comment) => <Link className={comment.isDeleted ? "activity-item activity-item-deleted" : "activity-item"} href={`/posts/${comment.post.id}`} key={comment.id}><strong>{comment.isReply ? "대댓글" : "댓글"} · {comment.post.title}</strong><span>{new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium" }).format(new Date(comment.createdAt))}</span><p>{comment.content}</p></Link>)}</div> : <p className="activity-empty">작성한 댓글이 없습니다.</p>}
      </section>
      <AccountSettings />
    </>
  );
}

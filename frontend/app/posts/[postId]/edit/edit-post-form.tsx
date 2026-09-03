"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../../../auth/auth-context";
import { apiFetch, apiUrl, readApiResponse } from "../../../lib/api";

type PostResponse = {
  message?: string;
  post?: {
    id: number;
    title: string;
    content: string;
    isDeleted: boolean;
    author: { id: number | null; name: string };
  };
};

export function EditPostForm({ postId }: { postId: string }) {
  const router = useRouter();
  const { accessToken, authorizedFetch, isAuthReady, user } = useAuth();
  const [post, setPost] = useState<PostResponse["post"]>(undefined);
  const [loadingError, setLoadingError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    void apiFetch(`/api/posts/${encodeURIComponent(postId)}`)
      .then(async (response) => {
        const result = await readApiResponse<PostResponse>(response, "게시글을 불러오지 못했습니다.");
        if (!result.post) throw new Error("게시글 조회 응답이 올바르지 않습니다.");
        if (result.post.isDeleted) throw new Error("삭제된 게시글은 수정할 수 없습니다.");
        setPost(result.post);
      })
      .catch((error: unknown) => setLoadingError(error instanceof Error ? error.message : "게시글을 불러오지 못했습니다."));
  }, [postId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setSubmitError("");
    const formData = new FormData(event.currentTarget);
    try {
      const response = await authorizedFetch(apiUrl(`/api/posts/${encodeURIComponent(postId)}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: String(formData.get("title") ?? ""), content: String(formData.get("content") ?? "") })
      });
      await readApiResponse<PostResponse>(response, "게시글을 수정하지 못했습니다.");
      router.push(`/posts/${postId}`);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "게시글 수정 중 문제가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!isAuthReady || (!post && !loadingError)) return <section className="post-editor-card"><h1 className="editor-title">게시글을 불러오고 있어요</h1></section>;
  if (!user || !accessToken) return <section className="post-editor-card post-login-required"><h1 className="editor-title">로그인이 필요해요</h1><Link className="primary-link" href="/login">로그인하러 가기</Link></section>;
  if (loadingError) return <section className="post-editor-card post-login-required"><h1 className="editor-title">수정할 수 없어요</h1><p className="form-error">{loadingError}</p><Link className="secondary-link" href={`/posts/${postId}`}>게시글로 돌아가기</Link></section>;
  if (!post || user.id !== post.author.id) return <section className="post-editor-card post-login-required"><h1 className="editor-title">수정 권한이 없어요</h1><Link className="secondary-link" href={`/posts/${postId}`}>게시글로 돌아가기</Link></section>;

  return (
    <section className="post-editor-card">
      <div className="editor-heading"><p className="eyebrow">Edit post</p><h1 className="editor-title">게시글 수정</h1><p className="editor-description">작성한 제목과 내용을 변경할 수 있습니다.</p></div>
      <form className="post-form" onSubmit={handleSubmit}>
        <label className="form-field"><span>제목</span><input name="title" defaultValue={post.title} maxLength={100} required /></label>
        <label className="form-field"><span>내용</span><textarea name="content" defaultValue={post.content} maxLength={10_000} rows={12} required /></label>
        {submitError ? <p className="form-error" role="alert">{submitError}</p> : null}
        <div className="editor-actions"><Link className="secondary-link" href={`/posts/${postId}`}>취소</Link><button className="login-button editor-submit" type="submit" disabled={isSubmitting}>{isSubmitting ? "수정 중..." : "수정 완료"}</button></div>
      </form>
    </section>
  );
}

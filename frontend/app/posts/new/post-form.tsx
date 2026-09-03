"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useAuth } from "../../auth/auth-context";
import { apiUrl, readApiResponse } from "../../lib/api";

type CreatedPost = {
  id: number;
  title: string;
};

type ApiResponse = {
  message?: string;
  post?: CreatedPost;
};

export function PostForm() {
  const { accessToken, authorizedFetch, isAuthReady, user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [createdPost, setCreatedPost] = useState<CreatedPost | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage("");

    const form = event.currentTarget;
    const formData = new FormData(form);

    try {
      const response = await authorizedFetch(apiUrl("/api/posts"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: String(formData.get("title") ?? ""),
          content: String(formData.get("content") ?? "")
        })
      });
      const result = await readApiResponse<ApiResponse>(response, "게시글을 작성하지 못했습니다.");
      if (!result.post) throw new Error("게시글 작성 응답이 올바르지 않습니다.");

      setCreatedPost(result.post);
      form.reset();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "게시글 작성 중 문제가 발생했습니다."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!isAuthReady) {
    return (
      <section className="post-editor-card" aria-live="polite">
        <p className="eyebrow">New post</p>
        <h1 className="editor-title">로그인 상태를 확인하고 있어요</h1>
      </section>
    );
  }

  if (!user || !accessToken) {
    return (
      <section className="post-editor-card post-login-required">
        <p className="eyebrow">Login required</p>
        <h1 className="editor-title">글을 작성하려면 로그인이 필요해요</h1>
        <p className="editor-description">
          인증된 사용자만 게시글을 작성할 수 있습니다.
        </p>
        <Link className="primary-link" href="/login">
          로그인하러 가기
        </Link>
      </section>
    );
  }

  if (createdPost) {
    return (
      <section className="post-editor-card post-created" aria-live="polite">
        <div className="verification-icon verification-icon-success" aria-hidden="true">
          ✓
        </div>
        <p className="eyebrow">Post published</p>
        <h1 className="editor-title">게시글이 작성됐어요</h1>
        <p className="editor-description">“{createdPost.title}” 게시글이 저장되었습니다.</p>
        <div className="editor-actions">
          <button className="secondary-button" type="button" onClick={() => setCreatedPost(null)}>
            새 글 작성
          </button>
          <Link className="primary-link" href="/">
            홈으로 이동
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="post-editor-card">
      <div className="editor-heading">
        <p className="eyebrow">New post</p>
        <h1 className="editor-title">게시글 작성</h1>
        <p className="editor-description">{user.name}님의 생각과 학습 내용을 기록해보세요.</p>
      </div>

      <form className="post-form" onSubmit={handleSubmit}>
        <label className="form-field">
          <span>제목</span>
          <input name="title" maxLength={100} placeholder="제목을 입력해주세요" required />
        </label>

        <label className="form-field">
          <span>내용</span>
          <textarea
            name="content"
            maxLength={10_000}
            rows={12}
            placeholder="내용을 입력해주세요"
            required
          />
        </label>

        {errorMessage ? (
          <p className="form-error" role="alert">
            {errorMessage}
          </p>
        ) : null}

        <div className="editor-actions">
          <Link className="secondary-link" href="/">
            취소
          </Link>
          <button className="login-button editor-submit" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "저장 중..." : "게시글 작성"}
          </button>
        </div>
      </form>
    </section>
  );
}

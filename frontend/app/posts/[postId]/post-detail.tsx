"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../../auth/auth-context";
import { apiFetch, apiUrl, readApiResponse } from "../../lib/api";

type CommentItem = {
  id: number;
  content: string;
  createdAt: string;
  isDeleted: boolean;
  author: { id: number | null; name: string };
  replies?: CommentItem[];
};

type PostDetailResponse = {
  post: {
    id: number;
    title: string;
    content: string;
    createdAt: string;
    isDeleted: boolean;
    canComment: boolean;
    author: { id: number | null; name: string };
    comments: CommentItem[];
  };
};

function CommentForm({
  postId,
  parentId,
  onCreated,
  compact = false
}: {
  postId: string;
  parentId?: number;
  onCreated: () => void;
  compact?: boolean;
}) {
  const { authorizedFetch } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage("");
    const form = event.currentTarget;
    const formData = new FormData(form);

    try {
      const response = await authorizedFetch(
        apiUrl(`/api/posts/${encodeURIComponent(postId)}/comments`),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: String(formData.get("content") ?? ""),
            ...(parentId ? { parentId } : {})
          })
        }
      );
      await readApiResponse(response, "댓글을 작성하지 못했습니다.");

      form.reset();
      onCreated();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "댓글 작성 중 문제가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className={`comment-form${compact ? " comment-form-compact" : ""}`} onSubmit={handleSubmit}>
      <label>
        <span className="visually-hidden">{parentId ? "대댓글" : "댓글"} 내용</span>
        <textarea
          name="content"
          maxLength={1_000}
          placeholder={parentId ? "대댓글을 입력해주세요" : "댓글을 입력해주세요"}
          required
          rows={compact ? 3 : 4}
        />
      </label>
      {errorMessage ? <p className="form-error" role="alert">{errorMessage}</p> : null}
      <div className="comment-form-actions">
        <button className="login-button" disabled={isSubmitting} type="submit">
          {isSubmitting ? "등록 중..." : parentId ? "대댓글 등록" : "댓글 등록"}
        </button>
      </div>
    </form>
  );
}

function Comment({
  comment,
  postId,
  isReply = false,
  canReply,
  onCreated
}: {
  comment: CommentItem;
  postId: string;
  isReply?: boolean;
  canReply: boolean;
  onCreated: () => void;
}) {
  const { authorizedFetch, user } = useAuth();
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState("");

  async function handleUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setActionError("");
    const formData = new FormData(event.currentTarget);
    try {
      const response = await authorizedFetch(
        apiUrl(`/api/posts/${encodeURIComponent(postId)}/comments/${comment.id}`),
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: String(formData.get("content") ?? "") })
        }
      );
      await readApiResponse(response, "댓글을 수정하지 못했습니다.");
      setIsEditing(false);
      onCreated();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "댓글 수정 중 문제가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    setIsSubmitting(true);
    setActionError("");
    try {
      const response = await authorizedFetch(
        apiUrl(`/api/posts/${encodeURIComponent(postId)}/comments/${comment.id}`),
        { method: "DELETE" }
      );
      await readApiResponse(response, "댓글을 삭제하지 못했습니다.");
      setShowDeleteConfirm(false);
      onCreated();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "댓글 삭제 중 문제가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <article className={`comment-item${isReply ? " comment-reply" : ""}`}>
      <div className="comment-meta">
        <strong>{comment.author.name}</strong>
        <time dateTime={comment.createdAt}>
          {new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium" }).format(new Date(comment.createdAt))}
        </time>
      </div>
      {isEditing ? (
        <form className="comment-edit-form" onSubmit={handleUpdate}>
          <textarea name="content" defaultValue={comment.content} maxLength={1_000} rows={3} required aria-label="댓글 수정 내용" />
          {actionError ? <p className="form-error" role="alert">{actionError}</p> : null}
          <div><button className="secondary-button" type="button" onClick={() => setIsEditing(false)} disabled={isSubmitting}>취소</button><button className="login-button" type="submit" disabled={isSubmitting}>{isSubmitting ? "수정 중..." : "수정 완료"}</button></div>
        </form>
      ) : (
        <p className={comment.isDeleted ? "deleted-comment" : ""}>{comment.content}</p>
      )}
      {user?.id === comment.author.id && !comment.isDeleted && !isEditing ? (
        <div className="comment-owner-actions">
          <button type="button" onClick={() => { setActionError(""); setIsEditing(true); }}>수정</button>
          <button type="button" onClick={() => { setActionError(""); setShowDeleteConfirm(true); }}>삭제</button>
        </div>
      ) : null}
      {showDeleteConfirm ? (
        <div className="comment-delete-confirm" role="alertdialog" aria-label="댓글 삭제 확인">
          <p>이 댓글을 삭제할까요?</p>
          {actionError ? <p className="form-error" role="alert">{actionError}</p> : null}
          <div><button className="secondary-button" type="button" onClick={() => setShowDeleteConfirm(false)} disabled={isSubmitting}>취소</button><button className="danger-button" type="button" onClick={handleDelete} disabled={isSubmitting}>{isSubmitting ? "삭제 중..." : "정말 삭제"}</button></div>
        </div>
      ) : null}
      {canReply && !isReply ? (
        <>
          <button
            className="reply-toggle"
            type="button"
            onClick={() => setShowReplyForm((visible) => !visible)}
          >
            {showReplyForm ? "답글 취소" : "답글"}
          </button>
          {showReplyForm ? (
            <CommentForm
              compact
              onCreated={() => {
                setShowReplyForm(false);
                onCreated();
              }}
              parentId={comment.id}
              postId={postId}
            />
          ) : null}
        </>
      ) : null}
    </article>
  );
}

export function PostDetail({ postId }: { postId: string }) {
  const { accessToken, authorizedFetch, isAuthReady, user } = useAuth();
  const [data, setData] = useState<PostDetailResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  async function handleDelete() {
    setIsDeleting(true);
    setDeleteError("");
    try {
      const response = await authorizedFetch(apiUrl(`/api/posts/${encodeURIComponent(postId)}`), {
        method: "DELETE"
      });
      await readApiResponse(response, "게시글을 삭제하지 못했습니다.");
      setShowDeleteConfirm(false);
      setReloadKey((key) => key + 1);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "게시글 삭제 중 문제가 발생했습니다.");
    } finally {
      setIsDeleting(false);
    }
  }

  useEffect(() => {
    let isCurrent = true;

    void apiFetch(`/api/posts/${encodeURIComponent(postId)}`)
      .then((response) => readApiResponse<PostDetailResponse>(response, "게시글을 불러오지 못했습니다."))
      .then((result) => {
        if (isCurrent) setData(result);
      })
      .catch((error: unknown) => {
        if (isCurrent) {
          setErrorMessage(error instanceof Error ? error.message : "게시글을 불러오지 못했습니다.");
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [postId, reloadKey]);

  if (errorMessage) {
    return (
      <div className="post-detail-message" role="alert">
        <p>{errorMessage}</p>
        <Link className="secondary-link" href="/posts">목록으로 돌아가기</Link>
      </div>
    );
  }

  if (!data) {
    return <p className="post-detail-message" aria-live="polite">게시글을 불러오고 있어요...</p>;
  }

  const { post } = data;
  const commentCount = post.comments.reduce(
    (count, comment) => count + 1 + (comment.replies?.length ?? 0),
    0
  );

  return (
    <>
      <article className={`post-detail-card${post.isDeleted ? " post-detail-deleted" : ""}`}>
        <div className="post-detail-meta">
          <span>{post.author.name}</span>
          <time dateTime={post.createdAt}>
            {new Intl.DateTimeFormat("ko-KR", { dateStyle: "long" }).format(new Date(post.createdAt))}
          </time>
        </div>
        <h1>{post.title}</h1>
        <div className="post-content">{post.content}</div>
        {isAuthReady && user?.id === post.author.id && !post.isDeleted ? (
          <div className="post-owner-actions">
            <Link className="secondary-link" href={`/posts/${post.id}/edit`}>수정</Link>
            <button className="danger-button" type="button" onClick={() => setShowDeleteConfirm(true)}>
              삭제
            </button>
          </div>
        ) : null}
        {showDeleteConfirm ? (
          <div className="delete-confirm" role="alertdialog" aria-label="게시글 삭제 확인">
            <p>게시글을 삭제할까요? 기존 댓글은 남고 새 댓글 작성은 막힙니다.</p>
            {deleteError ? <p className="form-error">{deleteError}</p> : null}
            <div>
              <button className="secondary-button" type="button" onClick={() => setShowDeleteConfirm(false)} disabled={isDeleting}>취소</button>
              <button className="danger-button" type="button" onClick={handleDelete} disabled={isDeleting}>
                {isDeleting ? "삭제 중..." : "정말 삭제"}
              </button>
            </div>
          </div>
        ) : null}
        {post.isDeleted ? (
          <p className="deleted-post-notice">삭제된 게시글에는 새 댓글을 작성할 수 없습니다.</p>
        ) : null}
      </article>

      <section className="comments-section">
        <h2>댓글 <span>{commentCount}</span></h2>
        {post.canComment && isAuthReady ? (
          user && accessToken ? (
            <CommentForm postId={postId} onCreated={() => setReloadKey((key) => key + 1)} />
          ) : (
            <p className="comment-login-message">
              <Link href="/login">로그인</Link>하면 댓글을 작성할 수 있습니다.
            </p>
          )
        ) : null}
        {post.comments.length === 0 ? (
          <p className="comments-empty">아직 댓글이 없습니다.</p>
        ) : (
          <div className="comments-list">
            {post.comments.map((comment) => (
              <div key={comment.id}>
                <Comment
                  canReply={post.canComment && !comment.isDeleted && Boolean(user && accessToken)}
                  comment={comment}
                  onCreated={() => setReloadKey((key) => key + 1)}
                  postId={postId}
                />
                {comment.replies?.map((reply) => (
                  <Comment
                    canReply={false}
                    comment={reply}
                    isReply
                    key={reply.id}
                    onCreated={() => setReloadKey((key) => key + 1)}
                    postId={postId}
                  />
                ))}
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

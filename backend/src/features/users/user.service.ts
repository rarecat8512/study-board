import { prisma } from "../../lib/prisma.js";
import type { MyPageQuery } from "./user.schema.js";

const DELETED_POST_MESSAGE = "삭제된 게시물입니다.";
const DELETED_COMMENT_MESSAGE = "삭제된 댓글입니다.";
const PAGE_SIZE = 10;

export async function getMyPage(userId: number, { postPage, commentPage }: MyPageQuery) {
  const result = await prisma.$transaction(async (transaction) => {
    const [user, postCount, commentCount] = await Promise.all([
      transaction.user.findUniqueOrThrow({
        where: { id: userId },
        select: { id: true, email: true, name: true, createdAt: true }
      }),
      transaction.post.count({ where: { userId } }),
      transaction.comment.count({ where: { userId } })
    ]);
    const postTotalPages = Math.max(1, Math.ceil(postCount / PAGE_SIZE));
    const commentTotalPages = Math.max(1, Math.ceil(commentCount / PAGE_SIZE));
    const currentPostPage = Math.min(postPage, postTotalPages);
    const currentCommentPage = Math.min(commentPage, commentTotalPages);
    const [posts, comments] = await Promise.all([
      transaction.post.findMany({
        where: { userId },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (currentPostPage - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: { id: true, title: true, content: true, createdAt: true, deletedAt: true }
      }),
      transaction.comment.findMany({
        where: { userId },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (currentCommentPage - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: {
          id: true,
          content: true,
          createdAt: true,
          deletedAt: true,
          parentId: true,
          post: { select: { id: true, title: true, deletedAt: true } }
        }
      })
    ]);
    return { user, postCount, commentCount, posts, comments, currentPostPage, currentCommentPage, postTotalPages, commentTotalPages };
  });

  const { user, postCount, commentCount, posts, comments, currentPostPage, currentCommentPage, postTotalPages, commentTotalPages } = result;

  return {
    user,
    counts: { posts: postCount, comments: commentCount },
    pagination: {
      posts: { page: currentPostPage, limit: PAGE_SIZE, totalItems: postCount, totalPages: postTotalPages },
      comments: { page: currentCommentPage, limit: PAGE_SIZE, totalItems: commentCount, totalPages: commentTotalPages }
    },
    posts: posts.map((post) => ({
      id: post.id,
      title: post.deletedAt ? DELETED_POST_MESSAGE : post.title,
      content: post.deletedAt ? DELETED_POST_MESSAGE : post.content,
      createdAt: post.createdAt,
      isDeleted: Boolean(post.deletedAt)
    })),
    comments: comments.map((comment) => ({
      id: comment.id,
      content: comment.deletedAt ? DELETED_COMMENT_MESSAGE : comment.content,
      createdAt: comment.createdAt,
      isDeleted: Boolean(comment.deletedAt),
      isReply: comment.parentId !== null,
      post: {
        id: comment.post.id,
        title: comment.post.deletedAt ? DELETED_POST_MESSAGE : comment.post.title,
        isDeleted: Boolean(comment.post.deletedAt)
      }
    }))
  };
}

import { prisma } from "../../lib/prisma.js";

const DELETED_POST_MESSAGE = "삭제된 게시물입니다.";
const DELETED_COMMENT_MESSAGE = "삭제된 댓글입니다.";

export async function getMyPage(userId: number) {
  const [user, postCount, commentCount, posts, comments] = await prisma.$transaction([
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, email: true, name: true, createdAt: true }
    }),
    prisma.post.count({ where: { userId } }),
    prisma.comment.count({ where: { userId } }),
    prisma.post.findMany({
      where: { userId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 20,
      select: { id: true, title: true, content: true, createdAt: true, deletedAt: true }
    }),
    prisma.comment.findMany({
      where: { userId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 20,
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

  return {
    user,
    counts: { posts: postCount, comments: commentCount },
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

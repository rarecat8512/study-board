import { AppError } from "../../errors/app-error.js";
import { prisma } from "../../lib/prisma.js";
import type { CreateCommentInput, UpdateCommentInput } from "./comment.schema.js";

export function createComment(postId: number, userId: number, input: CreateCommentInput) {
  return prisma.$transaction(async (transaction) => {
    const post = await transaction.post.findUnique({
      where: { id: postId },
      select: { id: true, deletedAt: true }
    });

    if (!post) {
      throw new AppError(404, "POST_NOT_FOUND", "게시글을 찾을 수 없습니다.");
    }

    if (post.deletedAt) {
      throw new AppError(409, "POST_DELETED", "삭제된 게시글에는 댓글을 작성할 수 없습니다.");
    }

    if (input.parentId) {
      const parent = await transaction.comment.findFirst({
        where: { id: input.parentId, postId },
        select: { id: true, parentId: true }
      });

      if (!parent) {
        throw new AppError(400, "INVALID_PARENT_COMMENT", "부모 댓글을 찾을 수 없습니다.");
      }

      if (parent.parentId) {
        throw new AppError(400, "REPLY_DEPTH_EXCEEDED", "대댓글에는 답글을 작성할 수 없습니다.");
      }
    }

    return transaction.comment.create({
      data: {
        postId,
        userId,
        parentId: input.parentId,
        content: input.content
      },
      select: {
        id: true,
        content: true,
        parentId: true,
        createdAt: true,
        updatedAt: true,
        author: {
          select: { id: true, name: true }
        }
      }
    });
  });
}

async function findEditableComment(postId: number, commentId: number, userId: number) {
  const comment = await prisma.comment.findFirst({
    where: { id: commentId, postId },
    select: { id: true, userId: true, deletedAt: true }
  });

  if (!comment) {
    throw new AppError(404, "COMMENT_NOT_FOUND", "댓글을 찾을 수 없습니다.");
  }
  if (comment.userId !== userId) {
    throw new AppError(403, "COMMENT_FORBIDDEN", "댓글을 변경할 권한이 없습니다.");
  }
  if (comment.deletedAt) {
    throw new AppError(409, "COMMENT_DELETED", "이미 삭제된 댓글입니다.");
  }
}

export async function updateComment(
  postId: number,
  commentId: number,
  userId: number,
  input: UpdateCommentInput
) {
  await findEditableComment(postId, commentId, userId);
  const result = await prisma.comment.updateMany({
    where: { id: commentId, postId, userId, deletedAt: null },
    data: { content: input.content }
  });
  if (result.count === 0) {
    throw new AppError(409, "COMMENT_DELETED", "이미 삭제된 댓글입니다.");
  }
  return prisma.comment.findUniqueOrThrow({
    where: { id: commentId },
    select: { id: true, content: true, parentId: true, createdAt: true, updatedAt: true }
  });
}

export async function softDeleteComment(postId: number, commentId: number, userId: number) {
  await findEditableComment(postId, commentId, userId);
  const deletedAt = new Date();
  const result = await prisma.comment.updateMany({
    where: { id: commentId, postId, userId, deletedAt: null },
    data: { deletedAt }
  });
  if (result.count === 0) {
    throw new AppError(409, "COMMENT_DELETED", "이미 삭제된 댓글입니다.");
  }
  return { id: commentId, deletedAt };
}

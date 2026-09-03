import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../errors/app-error.js";
import type { CreatePostInput, ListPostsQuery, UpdatePostInput } from "./post.schema.js";

const DELETED_POST_MESSAGE = "삭제된 게시물입니다.";

export function createPost(userId: number, input: CreatePostInput) {
  return prisma.post.create({
    data: {
      title: input.title,
      content: input.content,
      userId
    },
    select: {
      id: true,
      title: true,
      content: true,
      createdAt: true,
      updatedAt: true,
      author: {
        select: {
          id: true,
          name: true
        }
      }
    }
  });
}

async function findEditablePost(postId: number, userId: number) {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { id: true, userId: true, deletedAt: true }
  });

  if (!post) {
    throw new AppError(404, "POST_NOT_FOUND", "게시글을 찾을 수 없습니다.");
  }
  if (post.userId !== userId) {
    throw new AppError(403, "POST_FORBIDDEN", "게시글을 변경할 권한이 없습니다.");
  }
  if (post.deletedAt) {
    throw new AppError(409, "POST_DELETED", "이미 삭제된 게시글입니다.");
  }
}

export async function updatePost(postId: number, userId: number, input: UpdatePostInput) {
  await findEditablePost(postId, userId);

  const result = await prisma.post.updateMany({
    where: { id: postId, userId, deletedAt: null },
    data: input
  });
  if (result.count === 0) {
    throw new AppError(409, "POST_DELETED", "이미 삭제된 게시글입니다.");
  }

  return prisma.post.findUniqueOrThrow({
    where: { id: postId },
    select: {
      id: true,
      title: true,
      content: true,
      createdAt: true,
      updatedAt: true,
      author: { select: { id: true, name: true } }
    }
  });
}

export async function softDeletePost(postId: number, userId: number) {
  await findEditablePost(postId, userId);

  const deletedAt = new Date();
  const result = await prisma.post.updateMany({
    where: { id: postId, userId, deletedAt: null },
    data: { deletedAt }
  });
  if (result.count === 0) {
    throw new AppError(409, "POST_DELETED", "이미 삭제된 게시글입니다.");
  }

  return { id: postId, deletedAt };
}

export async function listPosts({ page, limit, q }: ListPostsQuery) {
  const where = q
    ? {
        deletedAt: null,
        OR: [{ title: { contains: q } }, { content: { contains: q } }]
      }
    : {};

  const { totalItems, totalPages, currentPage, posts } = await prisma.$transaction(
    async (transaction) => {
      const totalItems = await transaction.post.count({ where });
      const totalPages = Math.max(1, Math.ceil(totalItems / limit));
      const currentPage = Math.min(page, totalPages);
      const posts = await transaction.post.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (currentPage - 1) * limit,
        take: limit,
        select: {
          id: true,
          title: true,
          content: true,
          createdAt: true,
          updatedAt: true,
          deletedAt: true,
          author: {
            select: {
              id: true,
              name: true
            }
          }
        }
      });
      return { totalItems, totalPages, currentPage, posts };
    }
  );

  return {
    posts: posts.map((post) => ({
      id: post.id,
      title: post.deletedAt ? DELETED_POST_MESSAGE : post.title,
      content: post.deletedAt ? DELETED_POST_MESSAGE : post.content,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      isDeleted: Boolean(post.deletedAt),
      author: {
        id: post.author?.id ?? null,
        name: post.author?.name ?? "탈퇴한 사용자"
      }
    })),
    pagination: {
      page: currentPage,
      limit,
      totalItems,
      totalPages
    }
  };
}

function presentComment(comment: {
  id: number;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  author: { id: number; name: string | null } | null;
}) {
  return {
    id: comment.id,
    content: comment.deletedAt ? "삭제된 댓글입니다." : comment.content,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
    isDeleted: Boolean(comment.deletedAt),
    author: {
      id: comment.author?.id ?? null,
      name: comment.author?.name ?? "탈퇴한 사용자"
    }
  };
}

export async function getPostDetail(postId: number) {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: {
      id: true,
      title: true,
      content: true,
      createdAt: true,
      updatedAt: true,
      deletedAt: true,
      author: {
        select: { id: true, name: true }
      },
      comments: {
        where: { parentId: null },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: {
          id: true,
          content: true,
          createdAt: true,
          updatedAt: true,
          deletedAt: true,
          author: { select: { id: true, name: true } },
          replies: {
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            select: {
              id: true,
              content: true,
              createdAt: true,
              updatedAt: true,
              deletedAt: true,
              author: { select: { id: true, name: true } }
            }
          }
        }
      }
    }
  });

  if (!post) {
    throw new AppError(404, "POST_NOT_FOUND", "게시글을 찾을 수 없습니다.");
  }

  const isDeleted = Boolean(post.deletedAt);

  return {
    post: {
      id: post.id,
      title: isDeleted ? DELETED_POST_MESSAGE : post.title,
      content: isDeleted ? DELETED_POST_MESSAGE : post.content,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      isDeleted,
      canComment: !isDeleted,
      author: {
        id: post.author?.id ?? null,
        name: post.author?.name ?? "탈퇴한 사용자"
      },
      comments: post.comments.map((comment) => ({
        ...presentComment(comment),
        replies: comment.replies.map(presentComment)
      }))
    }
  };
}

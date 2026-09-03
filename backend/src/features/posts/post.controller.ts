import type { RequestHandler } from "express";
import type { CreatePostInput, UpdatePostInput } from "./post.schema.js";
import { listPostsQuerySchema, postIdSchema } from "./post.schema.js";
import { createPost, getPostDetail, listPosts, softDeletePost, updatePost } from "./post.service.js";

export const createPostController: RequestHandler = async (request, response) => {
  const post = await createPost(request.auth!.userId, request.body as CreatePostInput);

  response.status(201).json({ post });
};

export const getPostDetailController: RequestHandler = async (request, response) => {
  const postId = postIdSchema.safeParse(request.params.postId);

  if (!postId.success) {
    response.status(400).json({
      code: "VALIDATION_ERROR",
      message: "게시글 번호를 확인해주세요."
    });
    return;
  }

  response.status(200).json(await getPostDetail(postId.data));
};

export const listPostsController: RequestHandler = async (request, response) => {
  const query = listPostsQuerySchema.safeParse(request.query);

  if (!query.success) {
    response.status(400).json({
      code: "VALIDATION_ERROR",
      message: "페이지 번호를 확인해주세요.",
      fields: query.error.flatten().fieldErrors
    });
    return;
  }

  response.status(200).json(await listPosts(query.data));
};

function parsePostId(value: string | string[] | undefined) {
  const result = postIdSchema.safeParse(value);
  if (!result.success) {
    throw new Error("INVALID_POST_ID");
  }
  return result.data;
}

export const updatePostController: RequestHandler = async (request, response) => {
  try {
    const postId = parsePostId(request.params.postId);
    const post = await updatePost(postId, request.auth!.userId, request.body as UpdatePostInput);
    response.status(200).json({ post });
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_POST_ID") {
      response.status(400).json({ code: "VALIDATION_ERROR", message: "게시글 번호를 확인해주세요." });
      return;
    }
    throw error;
  }
};

export const deletePostController: RequestHandler = async (request, response) => {
  try {
    const postId = parsePostId(request.params.postId);
    response.status(200).json({ post: await softDeletePost(postId, request.auth!.userId) });
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_POST_ID") {
      response.status(400).json({ code: "VALIDATION_ERROR", message: "게시글 번호를 확인해주세요." });
      return;
    }
    throw error;
  }
};

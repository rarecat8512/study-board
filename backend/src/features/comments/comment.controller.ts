import type { RequestHandler } from "express";
import { postIdSchema } from "../posts/post.schema.js";
import { commentIdSchema, type CreateCommentInput, type UpdateCommentInput } from "./comment.schema.js";
import { createComment, softDeleteComment, updateComment } from "./comment.service.js";

export const createCommentController: RequestHandler = async (request, response) => {
  const postId = postIdSchema.safeParse(request.params.postId);

  if (!postId.success) {
    response.status(400).json({
      code: "VALIDATION_ERROR",
      message: "게시글 번호를 확인해주세요."
    });
    return;
  }

  const comment = await createComment(
    postId.data,
    request.auth!.userId,
    request.body as CreateCommentInput
  );

  response.status(201).json({ comment });
};

function parseCommentParams(postValue: string | string[] | undefined, commentValue: string | string[] | undefined) {
  const postId = postIdSchema.safeParse(postValue);
  const commentId = commentIdSchema.safeParse(commentValue);
  return postId.success && commentId.success ? { postId: postId.data, commentId: commentId.data } : null;
}

export const updateCommentController: RequestHandler = async (request, response) => {
  const ids = parseCommentParams(request.params.postId, request.params.commentId);
  if (!ids) {
    response.status(400).json({ code: "VALIDATION_ERROR", message: "댓글 번호를 확인해주세요." });
    return;
  }
  const comment = await updateComment(ids.postId, ids.commentId, request.auth!.userId, request.body as UpdateCommentInput);
  response.status(200).json({ comment });
};

export const deleteCommentController: RequestHandler = async (request, response) => {
  const ids = parseCommentParams(request.params.postId, request.params.commentId);
  if (!ids) {
    response.status(400).json({ code: "VALIDATION_ERROR", message: "댓글 번호를 확인해주세요." });
    return;
  }
  const comment = await softDeleteComment(ids.postId, ids.commentId, request.auth!.userId);
  response.status(200).json({ comment });
};

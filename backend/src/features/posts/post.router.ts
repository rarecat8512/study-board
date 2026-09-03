import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { validateBody } from "../../middleware/validate.js";
import {
  createPostController,
  deletePostController,
  getPostDetailController,
  listPostsController,
  updatePostController
} from "./post.controller.js";
import { createPostSchema, updatePostSchema } from "./post.schema.js";
import { createCommentController, deleteCommentController, updateCommentController } from "../comments/comment.controller.js";
import { createCommentSchema, updateCommentSchema } from "../comments/comment.schema.js";

export function createPostRouter() {
  const router = Router();

  router.post("/", authenticate, validateBody(createPostSchema), createPostController);
  router.get("/", listPostsController);
  router.get("/:postId", getPostDetailController);
  router.patch("/:postId", authenticate, validateBody(updatePostSchema), updatePostController);
  router.delete("/:postId", authenticate, deletePostController);
  router.post(
    "/:postId/comments",
    authenticate,
    validateBody(createCommentSchema),
    createCommentController
  );
  router.patch(
    "/:postId/comments/:commentId",
    authenticate,
    validateBody(updateCommentSchema),
    updateCommentController
  );
  router.delete("/:postId/comments/:commentId", authenticate, deleteCommentController);

  return router;
}

import { z } from "zod";

export const createCommentSchema = z.object({
  content: z
    .string()
    .min(1, "댓글 내용을 입력해주세요.")
    .max(1_000, "댓글은 1,000자 이하여야 합니다.")
    .refine((value) => value.trim().length > 0, "댓글 내용을 입력해주세요."),
  parentId: z.number().int().positive().optional()
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;

export const updateCommentSchema = z.object({
  content: z
    .string()
    .min(1, "댓글 내용을 입력해주세요.")
    .max(1_000, "댓글은 1,000자 이하여야 합니다.")
    .refine((value) => value.trim().length > 0, "댓글 내용을 입력해주세요.")
});

export type UpdateCommentInput = z.infer<typeof updateCommentSchema>;
export const commentIdSchema = z.coerce.number().int().positive();

import { z } from "zod";

export const createPostSchema = z.object({
  title: z.string().trim().min(1, "제목을 입력해주세요.").max(100, "제목은 100자 이하여야 합니다."),
  content: z
    .string()
    .min(1, "내용을 입력해주세요.")
    .max(10_000, "내용은 10,000자 이하여야 합니다.")
    .refine((value) => value.trim().length > 0, "내용을 입력해주세요.")
});

export type CreatePostInput = z.infer<typeof createPostSchema>;

export const updatePostSchema = createPostSchema
  .partial()
  .refine((input) => input.title !== undefined || input.content !== undefined, {
    message: "수정할 내용을 입력해주세요."
  });

export type UpdatePostInput = z.infer<typeof updatePostSchema>;

export const listPostsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  q: z.string().trim().max(100, "검색어는 100자 이하여야 합니다.").default("")
});

export type ListPostsQuery = z.infer<typeof listPostsQuerySchema>;

export const postIdSchema = z.coerce.number().int().positive();

import { z } from "zod";

export const myPageQuerySchema = z.object({
  postPage: z.coerce.number().int().min(1).default(1),
  commentPage: z.coerce.number().int().min(1).default(1)
});

export type MyPageQuery = z.infer<typeof myPageQuerySchema>;

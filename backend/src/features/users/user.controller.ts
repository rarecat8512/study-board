import type { RequestHandler } from "express";
import { getMyPage } from "./user.service.js";
import { myPageQuerySchema } from "./user.schema.js";

export const getMyPageController: RequestHandler = async (request, response) => {
  const query = myPageQuerySchema.safeParse(request.query);
  if (!query.success) {
    response.status(400).json({
      code: "VALIDATION_ERROR",
      message: "페이지 번호를 확인해주세요.",
      fields: query.error.flatten().fieldErrors
    });
    return;
  }
  response.status(200).json(await getMyPage(request.auth!.userId, query.data));
};

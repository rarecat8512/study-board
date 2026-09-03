import type { RequestHandler } from "express";

export const notFoundHandler: RequestHandler = (_request, response) => {
  response.status(404).json({
    code: "NOT_FOUND",
    message: "요청한 API를 찾을 수 없습니다."
  });
};

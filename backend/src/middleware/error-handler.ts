import type { ErrorRequestHandler } from "express";
import { AppError } from "../errors/app-error.js";

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  if (error instanceof AppError) {
    response.status(error.statusCode).json({
      code: error.code,
      message: error.message,
      ...(error.details === undefined ? {} : { details: error.details })
    });
    return;
  }

  console.error(error);
  response.status(500).json({
    code: "INTERNAL_SERVER_ERROR",
    message: "서버에서 오류가 발생했습니다."
  });
};

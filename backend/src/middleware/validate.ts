import type { RequestHandler } from "express";
import type { ZodType } from "zod";

export function validateBody(schema: ZodType): RequestHandler {
  return (request, response, next) => {
    const result = schema.safeParse(request.body);

    if (!result.success) {
      response.status(400).json({
        code: "VALIDATION_ERROR",
        message: "입력값을 확인해 주세요.",
        fields: result.error.flatten().fieldErrors
      });
      return;
    }

    request.body = result.data;
    next();
  };
}

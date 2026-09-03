import type { RequestHandler } from "express";
import { getMyPage } from "./user.service.js";

export const getMyPageController: RequestHandler = async (request, response) => {
  response.status(200).json(await getMyPage(request.auth!.userId));
};

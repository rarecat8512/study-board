import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { getMyPageController } from "./user.controller.js";

export function createUserRouter() {
  const router = Router();
  router.get("/me", authenticate, getMyPageController);
  return router;
}

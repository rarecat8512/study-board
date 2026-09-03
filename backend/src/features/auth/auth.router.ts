import { Router } from "express";
import { validateBody } from "../../middleware/validate.js";
import { authenticate } from "../../middleware/authenticate.js";
import type { EmailService } from "../email/email.service.js";
import {
  createRegisterController,
  changePasswordController,
  deleteAccountController,
  getCurrentUserController,
  loginController,
  logoutController,
  refreshController,
  verifyEmailController
} from "./auth.controller.js";
import { changePasswordSchema, deleteAccountSchema, loginSchema, registerSchema, verifyEmailSchema } from "./auth.schema.js";

export function createAuthRouter(emailService: EmailService) {
  const router = Router();

  router.post("/register", validateBody(registerSchema), createRegisterController(emailService));
  router.post("/verify-email", validateBody(verifyEmailSchema), verifyEmailController);
  router.post("/login", validateBody(loginSchema), loginController);
  router.post("/refresh", refreshController);
  router.post("/logout", logoutController);
  router.get("/me", authenticate, getCurrentUserController);
  router.post("/change-password", authenticate, validateBody(changePasswordSchema), changePasswordController);
  router.delete("/account", authenticate, validateBody(deleteAccountSchema), deleteAccountController);

  return router;
}

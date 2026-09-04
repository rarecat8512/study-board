import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import swaggerUi from "swagger-ui-express";
import { env } from "./config/env.js";
import { ConsoleEmailService } from "./features/email/console-email.service.js";
import { BrevoEmailService } from "./features/email/brevo-email.service.js";
import type { EmailService } from "./features/email/email.service.js";
import { createAuthRouter } from "./features/auth/auth.router.js";
import { createPostRouter } from "./features/posts/post.router.js";
import { createUserRouter } from "./features/users/user.router.js";
import { errorHandler } from "./middleware/error-handler.js";
import { notFoundHandler } from "./middleware/not-found-handler.js";
import { openApiDocument } from "./docs/openapi.js";

type CreateAppOptions = {
  emailService?: EmailService;
};

function createDefaultEmailService() {
  if (env.BREVO_API_KEY && env.BREVO_SENDER_EMAIL && env.BREVO_SENDER_NAME) {
    return new BrevoEmailService({ apiKey: env.BREVO_API_KEY, senderEmail: env.BREVO_SENDER_EMAIL, senderName: env.BREVO_SENDER_NAME });
  }
  return new ConsoleEmailService();
}

export function createApp(options: CreateAppOptions = {}) {
  const app = express();
  const emailService = options.emailService ?? createDefaultEmailService();

  app.disable("x-powered-by");
  app.use((request, response, next) => {
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("X-Frame-Options", "DENY");
    response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    if (request.path.startsWith("/api/auth")) {
      response.setHeader("Cache-Control", "no-store");
    }
    if (env.NODE_ENV === "production" && env.COOKIE_SECURE) {
      response.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }
    next();
  });

  app.use(
    cors({
      origin: env.FRONTEND_URL,
      credentials: true
    })
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());

  app.get("/health", (_request, response) => {
    response.status(200).json({ status: "ok" });
  });

  app.get("/openapi.json", (_request, response) => response.json(openApiDocument));
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openApiDocument, {
    customSiteTitle: "Study Board API Docs",
    swaggerOptions: { persistAuthorization: true }
  }));

  app.use("/api/auth", createAuthRouter(emailService));
  app.use("/api/posts", createPostRouter());
  app.use("/api/users", createUserRouter());
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export const app = createApp();

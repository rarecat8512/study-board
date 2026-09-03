import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { AppError } from "../errors/app-error.js";
import { prisma } from "../lib/prisma.js";

type AccessTokenPayload = jwt.JwtPayload & {
  type: "access";
  sessionId: string;
};

function unauthorized() {
  return new AppError(401, "UNAUTHORIZED", "로그인이 필요합니다.");
}

export const authenticate: RequestHandler = async (request, _response, next) => {
  const authorization = request.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    throw unauthorized();
  }

  const token = authorization.slice("Bearer ".length).trim();

  if (!token) {
    throw unauthorized();
  }

  let payload: AccessTokenPayload;

  try {
    const verified = jwt.verify(token, env.JWT_ACCESS_SECRET);

    if (
      typeof verified === "string" ||
      verified.type !== "access" ||
      typeof verified.sessionId !== "string" ||
      typeof verified.sub !== "string"
    ) {
      throw unauthorized();
    }

    payload = verified as AccessTokenPayload;
  } catch {
    throw unauthorized();
  }

  const userId = Number(payload.sub);

  if (!Number.isSafeInteger(userId) || userId <= 0) {
    throw unauthorized();
  }

  const session = await prisma.authSession.findUnique({
    where: { id: payload.sessionId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          deletedAt: true
        }
      }
    }
  });

  if (
    !session ||
    session.userId !== userId ||
    session.revokedAt ||
    session.absoluteExpiresAt <= new Date() ||
    session.user.deletedAt ||
    !session.user.email ||
    !session.user.name
  ) {
    throw unauthorized();
  }

  request.auth = {
    userId: session.user.id,
    sessionId: session.id,
    email: session.user.email,
    name: session.user.name
  };

  next();
};

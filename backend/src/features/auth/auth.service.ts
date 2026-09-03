import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { createHash, randomBytes } from "node:crypto";
import { env } from "../../config/env.js";
import { AppError } from "../../errors/app-error.js";
import { prisma } from "../../lib/prisma.js";
import type { EmailService } from "../email/email.service.js";
import type { ChangePasswordInput, DeleteAccountInput, LoginInput, RegisterInput, VerifyEmailInput } from "./auth.schema.js";

const EMAIL_VERIFICATION_TTL_MS = 30 * 60 * 1000;
const BCRYPT_ROUNDS = 12;
// 존재하지 않는 이메일도 bcrypt 비교를 수행해 응답 시간 차이를 줄인다.
const DUMMY_PASSWORD_HASH = "$2b$12$eRf0sARhKjS2gQPTeBbW6u5kPEEKqOyXGuq6OeuL8O9Sji0TV2naa";
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const AUTH_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function createAccessToken(userId: number, sessionId: string) {
  return jwt.sign(
    {
      type: "access",
      sessionId
    },
    env.JWT_ACCESS_SECRET,
    {
      subject: String(userId),
      expiresIn: ACCESS_TOKEN_TTL_SECONDS
    }
  );
}

function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}

export async function registerUser(input: RegisterInput, emailService: EmailService) {
  const existingUser = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true }
  });

  if (existingUser) {
    throw new AppError(409, "EMAIL_ALREADY_EXISTS", "이미 사용 중인 이메일입니다.");
  }

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  const verificationToken = randomBytes(32).toString("base64url");
  const tokenHash = hashToken(verificationToken);
  const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS);

  try {
    const user = await prisma.$transaction(async (transaction) => {
      const createdUser = await transaction.user.create({
        data: {
          email: input.email,
          passwordHash,
          name: input.name
        },
        select: {
          id: true,
          email: true,
          name: true
        }
      });

      await transaction.emailVerification.create({
        data: {
          userId: createdUser.id,
          tokenHash,
          expiresAt
        }
      });

      return createdUser;
    });

    const verificationUrl = new URL("/verify-email", env.APP_URL);
    verificationUrl.searchParams.set("token", verificationToken);

    try {
      await emailService.sendEmailVerification({
        email: user.email!,
        name: user.name!,
        verificationUrl: verificationUrl.toString()
      });
    } catch (error) {
      await prisma.user.deleteMany({ where: { id: user.id, emailVerifiedAt: null } });
      console.error("Email verification delivery failed", error);
      throw new AppError(
        502,
        "EMAIL_DELIVERY_FAILED",
        "인증 메일을 보내지 못했습니다. 잠시 후 다시 시도해주세요."
      );
    }

    return user;
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new AppError(409, "EMAIL_ALREADY_EXISTS", "이미 사용 중인 이메일입니다.");
    }

    throw error;
  }
}

export async function verifyEmail(input: VerifyEmailInput) {
  const tokenHash = hashToken(input.token);
  const now = new Date();

  return prisma.$transaction(async (transaction) => {
    const verification = await transaction.emailVerification.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        userId: true,
        expiresAt: true,
        usedAt: true
      }
    });

    if (!verification || verification.usedAt || verification.expiresAt <= now) {
      throw new AppError(
        400,
        "INVALID_OR_EXPIRED_VERIFICATION_TOKEN",
        "유효하지 않거나 만료된 인증 링크입니다."
      );
    }

    // 조건부 갱신으로 동시에 들어온 두 요청이 같은 토큰을 사용하는 것을 막는다.
    const claimedToken = await transaction.emailVerification.updateMany({
      where: {
        id: verification.id,
        usedAt: null,
        expiresAt: { gt: now }
      },
      data: { usedAt: now }
    });

    if (claimedToken.count !== 1) {
      throw new AppError(
        400,
        "INVALID_OR_EXPIRED_VERIFICATION_TOKEN",
        "유효하지 않거나 만료된 인증 링크입니다."
      );
    }

    const user = await transaction.user.update({
      where: { id: verification.userId },
      data: { emailVerifiedAt: now },
      select: { id: true, email: true, name: true, emailVerifiedAt: true }
    });

    return user;
  });
}

export async function loginUser(input: LoginInput) {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    select: {
      id: true,
      email: true,
      name: true,
      passwordHash: true,
      emailVerifiedAt: true,
      deletedAt: true
    }
  });

  const passwordMatches = await bcrypt.compare(
    input.password,
    user?.passwordHash ?? DUMMY_PASSWORD_HASH
  );

  if (!user || !passwordMatches || user.deletedAt) {
    throw new AppError(401, "INVALID_CREDENTIALS", "이메일 또는 비밀번호가 올바르지 않습니다.");
  }

  if (!user.emailVerifiedAt) {
    throw new AppError(403, "EMAIL_NOT_VERIFIED", "이메일 인증을 먼저 완료해주세요.");
  }

  const now = new Date();
  const absoluteExpiresAt = new Date(now.getTime() + AUTH_SESSION_TTL_MS);
  const refreshToken = randomBytes(48).toString("base64url");

  const session = await prisma.authSession.create({
    data: {
      userId: user.id,
      absoluteExpiresAt,
      lastUsedAt: now,
      refreshTokens: {
        create: {
          tokenHash: hashToken(refreshToken),
          expiresAt: absoluteExpiresAt
        }
      }
    },
    select: { id: true }
  });

  const accessToken = createAccessToken(user.id, session.id);

  return {
    accessToken,
    refreshToken,
    refreshTokenExpiresAt: absoluteExpiresAt,
    user: {
      id: user.id,
      email: user.email,
      name: user.name
    }
  };
}

export async function rotateRefreshToken(rawRefreshToken: string) {
  const now = new Date();
  const storedToken = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(rawRefreshToken) },
    include: {
      session: {
        include: {
          user: {
            select: { id: true, email: true, name: true, deletedAt: true }
          }
        }
      }
    }
  });

  if (!storedToken) {
    throw new AppError(401, "INVALID_REFRESH_TOKEN", "로그인이 만료되었습니다.");
  }

  const sessionExpired = storedToken.session.absoluteExpiresAt <= now;
  const sessionUnavailable =
    Boolean(storedToken.session.revokedAt) ||
    sessionExpired ||
    Boolean(storedToken.session.user.deletedAt);

  if (storedToken.usedAt || storedToken.revokedAt) {
    // 사용 완료된 토큰의 재등장은 탈취 신호로 보고 해당 기기 세션 전체를 폐기한다.
    await prisma.$transaction([
      prisma.authSession.updateMany({
        where: { id: storedToken.sessionId, revokedAt: null },
        data: { revokedAt: now }
      }),
      prisma.refreshToken.updateMany({
        where: { sessionId: storedToken.sessionId, revokedAt: null },
        data: { revokedAt: now }
      })
    ]);

    throw new AppError(
      401,
      "REFRESH_TOKEN_REUSE_DETECTED",
      "보안을 위해 다시 로그인해주세요."
    );
  }

  if (storedToken.expiresAt <= now || sessionUnavailable) {
    await prisma.$transaction([
      prisma.authSession.updateMany({
        where: { id: storedToken.sessionId, revokedAt: null },
        data: { revokedAt: now }
      }),
      prisma.refreshToken.updateMany({
        where: { sessionId: storedToken.sessionId, revokedAt: null },
        data: { revokedAt: now }
      })
    ]);

    throw new AppError(401, "INVALID_REFRESH_TOKEN", "로그인이 만료되었습니다.");
  }

  const nextRefreshToken = randomBytes(48).toString("base64url");
  const rotated = await prisma.$transaction(async (transaction) => {
    const claimed = await transaction.refreshToken.updateMany({
      where: {
        id: storedToken.id,
        usedAt: null,
        revokedAt: null,
        expiresAt: { gt: now }
      },
      data: { usedAt: now }
    });

    if (claimed.count !== 1) {
      await transaction.authSession.updateMany({
        where: { id: storedToken.sessionId, revokedAt: null },
        data: { revokedAt: now }
      });
      await transaction.refreshToken.updateMany({
        where: { sessionId: storedToken.sessionId, revokedAt: null },
        data: { revokedAt: now }
      });
      return false;
    }

    await transaction.refreshToken.create({
      data: {
        sessionId: storedToken.sessionId,
        tokenHash: hashToken(nextRefreshToken),
        expiresAt: storedToken.session.absoluteExpiresAt
      }
    });
    await transaction.authSession.update({
      where: { id: storedToken.sessionId },
      data: { lastUsedAt: now }
    });

    return true;
  });

  if (!rotated) {
    throw new AppError(
      401,
      "REFRESH_TOKEN_REUSE_DETECTED",
      "보안을 위해 다시 로그인해주세요."
    );
  }

  return {
    accessToken: createAccessToken(storedToken.session.user.id, storedToken.sessionId),
    refreshToken: nextRefreshToken,
    refreshTokenExpiresAt: storedToken.session.absoluteExpiresAt,
    user: {
      id: storedToken.session.user.id,
      email: storedToken.session.user.email,
      name: storedToken.session.user.name
    }
  };
}

export async function revokeAuthSession(rawRefreshToken: string | undefined) {
  if (!rawRefreshToken) {
    return;
  }

  const storedToken = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(rawRefreshToken) },
    select: { sessionId: true }
  });

  if (!storedToken) {
    return;
  }

  const now = new Date();
  await prisma.$transaction([
    prisma.authSession.updateMany({
      where: { id: storedToken.sessionId, revokedAt: null },
      data: { revokedAt: now }
    }),
    prisma.refreshToken.updateMany({
      where: { sessionId: storedToken.sessionId, revokedAt: null },
      data: { revokedAt: now }
    })
  ]);
}

async function verifyCurrentPassword(userId: number, currentPassword: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, passwordHash: true }
  });
  const matches = await bcrypt.compare(currentPassword, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
  if (!user || !matches) {
    throw new AppError(401, "CURRENT_PASSWORD_INCORRECT", "현재 비밀번호가 올바르지 않습니다.");
  }
  return user;
}

export async function changePassword(userId: number, input: ChangePasswordInput) {
  const user = await verifyCurrentPassword(userId, input.currentPassword);
  if (await bcrypt.compare(input.newPassword, user.passwordHash!)) {
    throw new AppError(400, "PASSWORD_UNCHANGED", "현재 비밀번호와 다른 비밀번호를 사용해주세요.");
  }

  const passwordHash = await bcrypt.hash(input.newPassword, BCRYPT_ROUNDS);
  const now = new Date();
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { passwordHash } }),
    prisma.authSession.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: now } }),
    prisma.refreshToken.updateMany({
      where: { session: { userId }, revokedAt: null },
      data: { revokedAt: now }
    })
  ]);
}

export async function deleteAccount(userId: number, input: DeleteAccountInput) {
  await verifyCurrentPassword(userId, input.currentPassword);
  await prisma.user.delete({ where: { id: userId } });
}

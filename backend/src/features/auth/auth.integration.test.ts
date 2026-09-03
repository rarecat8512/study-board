import bcrypt from "bcrypt";
import { createHash } from "node:crypto";
import jwt from "jsonwebtoken";
import request from "supertest";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { createApp } from "../../app.js";
import { env } from "../../config/env.js";
import { prisma } from "../../lib/prisma.js";
import type {
  EmailService,
  SendEmailVerificationInput
} from "../email/email.service.js";

const TEST_EMAIL = "register-test@example.com";

class FakeEmailService implements EmailService {
  sent: SendEmailVerificationInput[] = [];

  async sendEmailVerification(input: SendEmailVerificationInput) {
    this.sent.push(input);
  }
}

class FailingEmailService implements EmailService {
  async sendEmailVerification() {
    throw new Error("provider unavailable");
  }
}

async function cleanTestUser() {
  await prisma.comment.deleteMany({
    where: { post: { title: "탈퇴 보존 게시글" }, parentId: { not: null } }
  });
  await prisma.comment.deleteMany({ where: { post: { title: "탈퇴 보존 게시글" } } });
  await prisma.post.deleteMany({ where: { title: "탈퇴 보존 게시글" } });
  await prisma.user.deleteMany({
    where: { email: TEST_EMAIL }
  });
}

async function registerAndGetVerificationToken(app: ReturnType<typeof createApp>, emailService: FakeEmailService) {
  await request(app).post("/api/auth/register").send({
    email: TEST_EMAIL,
    password: "safe-password-123",
    name: "테스트 사용자"
  });

  const verificationUrl = new URL(emailService.sent[0]!.verificationUrl);
  return verificationUrl.searchParams.get("token")!;
}

afterEach(cleanTestUser);

afterAll(async () => {
  await cleanTestUser();
  await prisma.$disconnect();
});

async function createAccountManagementUser() {
  const user = await prisma.user.create({
    data: {
      email: TEST_EMAIL,
      passwordHash: await bcrypt.hash("safe-password-123", 4),
      name: "테스트 사용자",
      emailVerifiedAt: new Date()
    }
  });
  const app = createApp({ emailService: new FakeEmailService() });
  const login = await request(app).post("/api/auth/login").send({
    email: TEST_EMAIL,
    password: "safe-password-123"
  });
  return { app, user, accessToken: login.body.accessToken as string };
}

describe("POST /api/auth/change-password", () => {
  it("requires the current password, changes the hash, and revokes every session", async () => {
    const { app, user, accessToken } = await createAccountManagementUser();
    await request(app).post("/api/auth/login").send({ email: TEST_EMAIL, password: "safe-password-123" });

    const wrong = await request(app)
      .post("/api/auth/change-password")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ currentPassword: "wrong-password", newPassword: "new-safe-password-456", newPasswordConfirm: "new-safe-password-456" });
    expect(wrong.status).toBe(401);
    expect(wrong.body.code).toBe("CURRENT_PASSWORD_INCORRECT");

    const response = await request(app)
      .post("/api/auth/change-password")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ currentPassword: "safe-password-123", newPassword: "new-safe-password-456", newPasswordConfirm: "new-safe-password-456" });
    expect(response.status).toBe(200);
    expect(response.headers["set-cookie"]?.[0]).toContain("Expires=Thu, 01 Jan 1970 00:00:00 GMT");

    const sessions = await prisma.authSession.findMany({ where: { userId: user.id } });
    expect(sessions).toHaveLength(2);
    expect(sessions.every((session) => session.revokedAt !== null)).toBe(true);
    expect((await request(app).post("/api/auth/login").send({ email: TEST_EMAIL, password: "safe-password-123" })).status).toBe(401);
    expect((await request(app).post("/api/auth/login").send({ email: TEST_EMAIL, password: "new-safe-password-456" })).status).toBe(200);
  });
});

describe("DELETE /api/auth/account", () => {
  it("hard-deletes personal data while preserving authored content anonymously", async () => {
    const { app, user, accessToken } = await createAccountManagementUser();
    const post = await prisma.post.create({
      data: { userId: user.id, title: "탈퇴 보존 게시글", content: "탈퇴 후에도 남을 내용" }
    });
    const comment = await prisma.comment.create({
      data: { userId: user.id, postId: post.id, content: "탈퇴 후에도 남을 댓글" }
    });

    const wrong = await request(app)
      .delete("/api/auth/account")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ currentPassword: "wrong-password" });
    expect(wrong.status).toBe(401);

    const response = await request(app)
      .delete("/api/auth/account")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ currentPassword: "safe-password-123" });
    expect(response.status).toBe(200);
    expect(await prisma.user.findUnique({ where: { id: user.id } })).toBeNull();
    expect((await prisma.post.findUniqueOrThrow({ where: { id: post.id } })).userId).toBeNull();
    expect((await prisma.comment.findUniqueOrThrow({ where: { id: comment.id } })).userId).toBeNull();

    const detail = await request(app).get(`/api/posts/${post.id}`);
    expect(detail.body.post.author).toEqual({ id: null, name: "탈퇴한 사용자" });
    expect(detail.body.post.content).toBe("탈퇴 후에도 남을 내용");
    expect(detail.body.post.comments[0].author).toEqual({ id: null, name: "탈퇴한 사용자" });
    expect(detail.body.post.comments[0].content).toBe("탈퇴 후에도 남을 댓글");
  });
});

describe("POST /api/auth/register", () => {
  it("removes the pending user when verification email delivery fails", async () => {
    const app = createApp({ emailService: new FailingEmailService() });
    const response = await request(app).post("/api/auth/register").send({
      email: TEST_EMAIL,
      password: "safe-password-123",
      name: "테스트 사용자"
    });

    expect(response.status).toBe(502);
    expect(response.body.code).toBe("EMAIL_DELIVERY_FAILED");
    expect(await prisma.user.findUnique({ where: { email: TEST_EMAIL } })).toBeNull();
  });

  it("rejects invalid input before writing to the database", async () => {
    const emailService = new FakeEmailService();
    const app = createApp({ emailService });

    const response = await request(app).post("/api/auth/register").send({
      email: "not-an-email",
      password: "short",
      name: " "
    });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("VALIDATION_ERROR");
    expect(emailService.sent).toHaveLength(0);
  });

  it("stores a bcrypt password hash and sends a one-time verification link", async () => {
    const emailService = new FakeEmailService();
    const app = createApp({ emailService });
    const plainPassword = "safe-password-123";

    const response = await request(app).post("/api/auth/register").send({
      email: `  ${TEST_EMAIL.toUpperCase()}  `,
      password: plainPassword,
      name: "테스트 사용자"
    });

    expect(response.status).toBe(201);
    expect(response.body.user.email).toBe(TEST_EMAIL);
    expect(emailService.sent).toHaveLength(1);

    const user = await prisma.user.findUniqueOrThrow({
      where: { email: TEST_EMAIL },
      include: { emailVerifications: true }
    });

    expect(user.passwordHash).not.toBe(plainPassword);
    expect(await bcrypt.compare(plainPassword, user.passwordHash!)).toBe(true);
    expect(user.emailVerifiedAt).toBeNull();
    expect(user.emailVerifications).toHaveLength(1);

    const verificationUrl = new URL(emailService.sent[0]!.verificationUrl);
    const token = verificationUrl.searchParams.get("token");
    const tokenHash = createHash("sha256").update(token!).digest("hex");

    expect(token).toBeTruthy();
    expect(tokenHash).toBe(user.emailVerifications[0]!.tokenHash);
    expect(user.emailVerifications[0]!.tokenHash).not.toBe(token);
  });

  it("rejects a duplicate email", async () => {
    const emailService = new FakeEmailService();
    const app = createApp({ emailService });
    const body = {
      email: TEST_EMAIL,
      password: "safe-password-123",
      name: "테스트 사용자"
    };

    const firstResponse = await request(app).post("/api/auth/register").send(body);
    const secondResponse = await request(app).post("/api/auth/register").send(body);

    expect(firstResponse.status).toBe(201);
    expect(secondResponse.status).toBe(409);
    expect(secondResponse.body.code).toBe("EMAIL_ALREADY_EXISTS");
  });
});

describe("POST /api/auth/verify-email", () => {
  it("verifies the user and consumes the token", async () => {
    const emailService = new FakeEmailService();
    const app = createApp({ emailService });
    const token = await registerAndGetVerificationToken(app, emailService);

    const response = await request(app).post("/api/auth/verify-email").send({ token });

    expect(response.status).toBe(200);
    expect(response.body.message).toBe("이메일 인증이 완료되었습니다.");

    const user = await prisma.user.findUniqueOrThrow({
      where: { email: TEST_EMAIL },
      include: { emailVerifications: true }
    });

    expect(user.emailVerifiedAt).not.toBeNull();
    expect(user.emailVerifications[0]!.usedAt).not.toBeNull();
  });

  it("rejects a token that has already been used", async () => {
    const emailService = new FakeEmailService();
    const app = createApp({ emailService });
    const token = await registerAndGetVerificationToken(app, emailService);

    const firstResponse = await request(app).post("/api/auth/verify-email").send({ token });
    const secondResponse = await request(app).post("/api/auth/verify-email").send({ token });

    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(400);
    expect(secondResponse.body.code).toBe("INVALID_OR_EXPIRED_VERIFICATION_TOKEN");
  });

  it("rejects an expired token", async () => {
    const emailService = new FakeEmailService();
    const app = createApp({ emailService });
    const token = await registerAndGetVerificationToken(app, emailService);
    const tokenHash = createHash("sha256").update(token).digest("hex");

    await prisma.emailVerification.update({
      where: { tokenHash },
      data: { expiresAt: new Date(Date.now() - 1_000) }
    });

    const response = await request(app).post("/api/auth/verify-email").send({ token });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("INVALID_OR_EXPIRED_VERIFICATION_TOKEN");
  });

  it("rejects a token that does not exist", async () => {
    const emailService = new FakeEmailService();
    const app = createApp({ emailService });

    const response = await request(app).post("/api/auth/verify-email").send({
      token: "not-a-real-token"
    });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("INVALID_OR_EXPIRED_VERIFICATION_TOKEN");
  });
});

describe("POST /api/auth/login", () => {
  async function createLoginUser(verified = true) {
    return prisma.user.create({
      data: {
        email: TEST_EMAIL,
        passwordHash: await bcrypt.hash("safe-password-123", 4),
        name: "테스트 사용자",
        emailVerifiedAt: verified ? new Date() : null
      }
    });
  }

  it("returns an access token and stores a hashed refresh token", async () => {
    const user = await createLoginUser();
    const app = createApp({ emailService: new FakeEmailService() });

    const response = await request(app).post("/api/auth/login").send({
      email: `  ${TEST_EMAIL.toUpperCase()}  `,
      password: "safe-password-123"
    });

    expect(response.status).toBe(200);
    expect(response.body.expiresIn).toBe(900);
    expect(response.body.user.email).toBe(TEST_EMAIL);

    const accessPayload = jwt.verify(response.body.accessToken, env.JWT_ACCESS_SECRET);
    expect(accessPayload).toMatchObject({ sub: String(user.id), type: "access" });

    const cookie = response.headers["set-cookie"]?.[0];
    expect(cookie).toContain("refreshToken=");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Path=/api/auth");

    const rawRefreshToken = cookie!.split(";")[0]!.split("=")[1]!;
    const session = await prisma.authSession.findFirstOrThrow({
      where: { userId: user.id },
      include: { refreshTokens: true }
    });

    expect(session.revokedAt).toBeNull();
    expect(session.refreshTokens).toHaveLength(1);
    expect(session.refreshTokens[0]!.tokenHash).toBe(
      createHash("sha256").update(rawRefreshToken).digest("hex")
    );
    expect(session.refreshTokens[0]!.tokenHash).not.toBe(rawRefreshToken);
  });

  it("uses the same error for an unknown email and an incorrect password", async () => {
    await createLoginUser();
    const app = createApp({ emailService: new FakeEmailService() });

    const wrongPassword = await request(app).post("/api/auth/login").send({
      email: TEST_EMAIL,
      password: "wrong-password"
    });
    const unknownEmail = await request(app).post("/api/auth/login").send({
      email: "unknown@example.com",
      password: "wrong-password"
    });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body.code).toBe("INVALID_CREDENTIALS");
    expect(unknownEmail.body.code).toBe("INVALID_CREDENTIALS");
    expect(await prisma.authSession.count()).toBe(0);
  });

  it("rejects a user whose email has not been verified", async () => {
    await createLoginUser(false);
    const app = createApp({ emailService: new FakeEmailService() });

    const response = await request(app).post("/api/auth/login").send({
      email: TEST_EMAIL,
      password: "safe-password-123"
    });

    expect(response.status).toBe(403);
    expect(response.body.code).toBe("EMAIL_NOT_VERIFIED");
    expect(response.headers["set-cookie"]).toBeUndefined();
  });
});

describe("POST /api/auth/refresh", () => {
  async function loginAndGetRefreshCookie() {
    await prisma.user.create({
      data: {
        email: TEST_EMAIL,
        passwordHash: await bcrypt.hash("safe-password-123", 4),
        name: "테스트 사용자",
        emailVerifiedAt: new Date()
      }
    });
    const app = createApp({ emailService: new FakeEmailService() });
    const loginResponse = await request(app).post("/api/auth/login").send({
      email: TEST_EMAIL,
      password: "safe-password-123"
    });
    const cookie = loginResponse.headers["set-cookie"]?.[0]!.split(";")[0]!;

    return { app, cookie };
  }

  it("rotates the refresh token and returns a new access token", async () => {
    const { app, cookie: originalCookie } = await loginAndGetRefreshCookie();

    const response = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", originalCookie);

    expect(response.status).toBe(200);
    expect(response.body.user.email).toBe(TEST_EMAIL);
    expect(jwt.verify(response.body.accessToken, env.JWT_ACCESS_SECRET)).toMatchObject({
      type: "access"
    });

    const nextCookie = response.headers["set-cookie"]?.[0]!.split(";")[0]!;
    expect(nextCookie).not.toBe(originalCookie);

    const tokens = await prisma.refreshToken.findMany({ orderBy: { createdAt: "asc" } });
    expect(tokens).toHaveLength(2);
    expect(tokens[0]!.usedAt).not.toBeNull();
    expect(tokens[1]!.usedAt).toBeNull();

    const nextRawToken = nextCookie.split("=")[1]!;
    expect(tokens[1]!.tokenHash).toBe(
      createHash("sha256").update(nextRawToken).digest("hex")
    );
  });

  it("revokes the whole session when an already-used token reappears", async () => {
    const { app, cookie: originalCookie } = await loginAndGetRefreshCookie();
    const firstRefresh = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", originalCookie);
    const rotatedCookie = firstRefresh.headers["set-cookie"]?.[0]!.split(";")[0]!;

    const reuseResponse = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", originalCookie);
    const rotatedTokenResponse = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", rotatedCookie);

    expect(reuseResponse.status).toBe(401);
    expect(reuseResponse.body.code).toBe("REFRESH_TOKEN_REUSE_DETECTED");
    expect(rotatedTokenResponse.status).toBe(401);

    const session = await prisma.authSession.findFirstOrThrow({
      where: { user: { email: TEST_EMAIL } },
      include: { refreshTokens: true }
    });
    expect(session.revokedAt).not.toBeNull();
    expect(session.refreshTokens.every((token) => token.revokedAt !== null)).toBe(true);
  });

  it("rejects a refresh request without a cookie", async () => {
    const app = createApp({ emailService: new FakeEmailService() });

    const response = await request(app).post("/api/auth/refresh");

    expect(response.status).toBe(401);
    expect(response.body.code).toBe("REFRESH_TOKEN_REQUIRED");
  });
});

describe("POST /api/auth/logout", () => {
  async function loginAndGetRefreshCookie() {
    const user = await prisma.user.create({
      data: {
        email: TEST_EMAIL,
        passwordHash: await bcrypt.hash("safe-password-123", 4),
        name: "테스트 사용자",
        emailVerifiedAt: new Date()
      }
    });
    const app = createApp({ emailService: new FakeEmailService() });
    const loginResponse = await request(app).post("/api/auth/login").send({
      email: TEST_EMAIL,
      password: "safe-password-123"
    });
    const cookie = loginResponse.headers["set-cookie"]?.[0]!.split(";")[0]!;

    return { app, cookie, user };
  }

  it("revokes the current session and clears the refresh cookie", async () => {
    const { app, cookie, user } = await loginAndGetRefreshCookie();

    const response = await request(app).post("/api/auth/logout").set("Cookie", cookie);

    expect(response.status).toBe(204);
    const clearedCookie = response.headers["set-cookie"]?.[0];
    expect(clearedCookie).toContain("refreshToken=");
    expect(clearedCookie).toContain("Expires=Thu, 01 Jan 1970 00:00:00 GMT");

    const session = await prisma.authSession.findFirstOrThrow({
      where: { userId: user.id },
      include: { refreshTokens: true }
    });
    expect(session.revokedAt).not.toBeNull();
    expect(session.refreshTokens.every((token) => token.revokedAt !== null)).toBe(true);
  });

  it("is idempotent when there is no refresh cookie", async () => {
    const app = createApp({ emailService: new FakeEmailService() });

    const response = await request(app).post("/api/auth/logout");

    expect(response.status).toBe(204);
  });
});

describe("GET /api/auth/me", () => {
  async function loginUserForProtectedRoute() {
    const user = await prisma.user.create({
      data: {
        email: TEST_EMAIL,
        passwordHash: await bcrypt.hash("safe-password-123", 4),
        name: "테스트 사용자",
        emailVerifiedAt: new Date()
      }
    });
    const app = createApp({ emailService: new FakeEmailService() });
    const loginResponse = await request(app).post("/api/auth/login").send({
      email: TEST_EMAIL,
      password: "safe-password-123"
    });

    return {
      app,
      user,
      accessToken: loginResponse.body.accessToken as string,
      refreshCookie: loginResponse.headers["set-cookie"]?.[0]!.split(";")[0]!
    };
  }

  it("returns the current user for a valid access token", async () => {
    const { app, user, accessToken } = await loginUserForProtectedRoute();

    const response = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.user).toEqual({
      id: user.id,
      email: TEST_EMAIL,
      name: "테스트 사용자"
    });
  });

  it("rejects a missing or invalid access token", async () => {
    const app = createApp({ emailService: new FakeEmailService() });

    const missingToken = await request(app).get("/api/auth/me");
    const invalidToken = await request(app)
      .get("/api/auth/me")
      .set("Authorization", "Bearer invalid-token");

    expect(missingToken.status).toBe(401);
    expect(invalidToken.status).toBe(401);
    expect(missingToken.body.code).toBe("UNAUTHORIZED");
    expect(invalidToken.body.code).toBe("UNAUTHORIZED");
  });

  it("rejects an access token immediately after its session is logged out", async () => {
    const { app, accessToken, refreshCookie } = await loginUserForProtectedRoute();

    await request(app).post("/api/auth/logout").set("Cookie", refreshCookie);
    const response = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(401);
    expect(response.body.code).toBe("UNAUTHORIZED");
  });
});

import bcrypt from "bcrypt";
import request from "supertest";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { createApp } from "../../app.js";
import { prisma } from "../../lib/prisma.js";

const MY_PAGE_EMAIL = "my-page-test@example.com";

async function cleanMyPageUser() {
  await prisma.comment.deleteMany({ where: { parentId: { not: null }, author: { email: MY_PAGE_EMAIL } } });
  await prisma.comment.deleteMany({ where: { author: { email: MY_PAGE_EMAIL } } });
  await prisma.post.deleteMany({ where: { author: { email: MY_PAGE_EMAIL } } });
  await prisma.user.deleteMany({ where: { email: MY_PAGE_EMAIL } });
}

async function loginMyPageUser() {
  const user = await prisma.user.create({
    data: {
      email: MY_PAGE_EMAIL,
      passwordHash: await bcrypt.hash("safe-password-123", 4),
      name: "마이페이지 테스트",
      emailVerifiedAt: new Date()
    }
  });
  const app = createApp();
  const login = await request(app).post("/api/auth/login").send({
    email: MY_PAGE_EMAIL,
    password: "safe-password-123"
  });
  return { app, user, accessToken: login.body.accessToken as string };
}

afterEach(cleanMyPageUser);
afterAll(async () => {
  await cleanMyPageUser();
  await prisma.$disconnect();
});

describe("GET /api/users/me", () => {
  it("rejects an unauthenticated request", async () => {
    const response = await request(createApp()).get("/api/users/me");
    expect(response.status).toBe(401);
    expect(response.body.code).toBe("UNAUTHORIZED");
  });

  it("returns only the authenticated user's activity and masks deleted content", async () => {
    const { app, user, accessToken } = await loginMyPageUser();
    const post = await prisma.post.create({
      data: { userId: user.id, title: "내 게시글", content: "내 게시글 내용" }
    });
    const deletedPost = await prisma.post.create({
      data: { userId: user.id, title: "삭제 전 비밀 제목", content: "삭제 전 비밀 내용", deletedAt: new Date() }
    });
    await prisma.comment.create({
      data: { userId: user.id, postId: post.id, content: "내 댓글", deletedAt: new Date() }
    });

    const response = await request(app)
      .get("/api/users/me")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.user).toMatchObject({ id: user.id, email: MY_PAGE_EMAIL, name: "마이페이지 테스트" });
    expect(response.body.counts).toEqual({ posts: 2, comments: 1 });
    expect(response.body.posts.find((item: { id: number }) => item.id === deletedPost.id)).toMatchObject({
      title: "삭제된 게시물입니다.",
      content: "삭제된 게시물입니다.",
      isDeleted: true
    });
    expect(response.body.comments[0]).toMatchObject({ content: "삭제된 댓글입니다.", isDeleted: true });
    expect(JSON.stringify(response.body)).not.toContain("삭제 전 비밀");
  });
});

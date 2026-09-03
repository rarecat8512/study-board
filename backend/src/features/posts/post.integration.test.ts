import bcrypt from "bcrypt";
import request from "supertest";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { createApp } from "../../app.js";
import { prisma } from "../../lib/prisma.js";

const POST_TEST_EMAIL = "post-create-test@example.com";
const POST_OTHER_EMAIL = "post-other-test@example.com";
const TEST_EMAILS = [POST_TEST_EMAIL, POST_OTHER_EMAIL];

async function cleanTestUser() {
  await prisma.comment.deleteMany({
    where: { parentId: { not: null }, post: { author: { email: { in: TEST_EMAILS } } } }
  });
  await prisma.comment.deleteMany({
    where: { parentId: null, post: { author: { email: { in: TEST_EMAILS } } } }
  });
  await prisma.post.deleteMany({ where: { author: { email: { in: TEST_EMAILS } } } });
  await prisma.user.deleteMany({ where: { email: { in: TEST_EMAILS } } });
}

async function loginTestUser(email = POST_TEST_EMAIL, name = "게시글 테스트") {
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: await bcrypt.hash("safe-password-123", 4),
      name,
      emailVerifiedAt: new Date()
    }
  });
  const app = createApp();
  const loginResponse = await request(app).post("/api/auth/login").send({
    email,
    password: "safe-password-123"
  });

  return { app, user, accessToken: loginResponse.body.accessToken as string };
}

afterEach(cleanTestUser);

afterAll(async () => {
  await cleanTestUser();
  await prisma.$disconnect();
});

describe("POST /api/posts", () => {
  it("rejects an unauthenticated request", async () => {
    const app = createApp();

    const response = await request(app).post("/api/posts").send({
      title: "테스트 글",
      content: "테스트 내용"
    });

    expect(response.status).toBe(401);
    expect(response.body.code).toBe("UNAUTHORIZED");
  });

  it("rejects an empty title or content", async () => {
    const { app, accessToken } = await loginTestUser();

    const response = await request(app)
      .post("/api/posts")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ title: "   ", content: "   " });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("VALIDATION_ERROR");
    expect(await prisma.post.count()).toBe(0);
  });

  it("creates a post using only the authenticated user as its author", async () => {
    const { app, user, accessToken } = await loginTestUser();

    const response = await request(app)
      .post("/api/posts")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        title: "  첫 번째 게시글  ",
        content: "게시글 작성 API를 학습하고 있습니다.",
        userId: 999_999
      });

    expect(response.status).toBe(201);
    expect(response.body.post.title).toBe("첫 번째 게시글");
    expect(response.body.post.author).toEqual({ id: user.id, name: "게시글 테스트" });

    const storedPost = await prisma.post.findUniqueOrThrow({
      where: { id: response.body.post.id }
    });
    expect(storedPost.userId).toBe(user.id);
    expect(storedPost.content).toBe("게시글 작성 API를 학습하고 있습니다.");
  });
});

describe("GET /api/posts", () => {
  async function createPostsForList() {
    const user = await prisma.user.create({
      data: {
        email: POST_TEST_EMAIL,
        passwordHash: await bcrypt.hash("safe-password-123", 4),
        name: "목록 테스트",
        emailVerifiedAt: new Date()
      }
    });

    const oldest = await prisma.post.create({
      data: { userId: user.id, title: "첫 글", content: "첫 내용" }
    });
    const deleted = await prisma.post.create({
      data: {
        userId: user.id,
        title: "삭제 전 제목",
        content: "삭제 전 내용",
        deletedAt: new Date()
      }
    });
    const newest = await prisma.post.create({
      data: { userId: user.id, title: "최근 글", content: "최근 내용" }
    });

    return { oldest, deleted, newest };
  }

  it("returns numbered pages in newest-first order", async () => {
    const { deleted, newest } = await createPostsForList();
    const app = createApp();

    const response = await request(app).get("/api/posts?page=1&limit=2");

    expect(response.status).toBe(200);
    expect(response.body.posts.map((post: { id: number }) => post.id)).toEqual([
      newest.id,
      deleted.id
    ]);
    expect(response.body.pagination).toEqual({
      page: 1,
      limit: 2,
      totalItems: 3,
      totalPages: 2
    });
  });

  it("masks the title and content of a soft-deleted post", async () => {
    const { deleted } = await createPostsForList();
    const app = createApp();

    const response = await request(app).get("/api/posts?page=1&limit=10");
    const deletedPost = response.body.posts.find(
      (post: { id: number }) => post.id === deleted.id
    );

    expect(deletedPost).toMatchObject({
      title: "삭제된 게시물입니다.",
      content: "삭제된 게시물입니다.",
      isDeleted: true
    });
    expect(JSON.stringify(deletedPost)).not.toContain("삭제 전 제목");
    expect(JSON.stringify(deletedPost)).not.toContain("삭제 전 내용");
  });

  it("rejects an invalid page number", async () => {
    const app = createApp();

    const response = await request(app).get("/api/posts?page=0");

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("VALIDATION_ERROR");
  });

  it("searches active posts by title or content without exposing deleted originals", async () => {
    const { newest } = await createPostsForList();
    const app = createApp();

    const titleSearch = await request(app).get("/api/posts?q=최근");
    expect(titleSearch.status).toBe(200);
    expect(titleSearch.body.posts.map((post: { id: number }) => post.id)).toEqual([newest.id]);

    const deletedOriginalSearch = await request(app).get("/api/posts?q=삭제 전 제목");
    expect(deletedOriginalSearch.status).toBe(200);
    expect(deletedOriginalSearch.body.posts).toEqual([]);
    expect(deletedOriginalSearch.body.pagination.totalItems).toBe(0);
  });

  it("moves an out-of-range page to the last available page", async () => {
    const { oldest } = await createPostsForList();
    const app = createApp();

    const response = await request(app).get("/api/posts?page=999&limit=2");

    expect(response.status).toBe(200);
    expect(response.body.pagination.page).toBe(2);
    expect(response.body.posts.map((post: { id: number }) => post.id)).toEqual([oldest.id]);
  });
});

describe("GET /api/posts/:postId", () => {
  async function createPostWithComments(deletedAt: Date | null = null) {
    const user = await prisma.user.create({
      data: {
        email: POST_TEST_EMAIL,
        passwordHash: await bcrypt.hash("safe-password-123", 4),
        name: "상세 테스트",
        emailVerifiedAt: new Date()
      }
    });
    const post = await prisma.post.create({
      data: {
        userId: user.id,
        title: "상세 게시글",
        content: "상세 게시글의 전체 내용입니다.",
        deletedAt
      }
    });
    const comment = await prisma.comment.create({
      data: {
        userId: user.id,
        postId: post.id,
        content: "기존 댓글"
      }
    });
    await prisma.comment.create({
      data: {
        userId: user.id,
        postId: post.id,
        parentId: comment.id,
        content: "기존 대댓글"
      }
    });

    return { post };
  }

  it("returns the full post with one-level comments", async () => {
    const { post } = await createPostWithComments();
    const app = createApp();

    const response = await request(app).get(`/api/posts/${post.id}`);

    expect(response.status).toBe(200);
    expect(response.body.post).toMatchObject({
      id: post.id,
      title: "상세 게시글",
      content: "상세 게시글의 전체 내용입니다.",
      isDeleted: false,
      canComment: true
    });
    expect(response.body.post.comments[0].content).toBe("기존 댓글");
    expect(response.body.post.comments[0].replies[0].content).toBe("기존 대댓글");
  });

  it("masks a deleted post while preserving its existing comments", async () => {
    const { post } = await createPostWithComments(new Date());
    const app = createApp();

    const response = await request(app).get(`/api/posts/${post.id}`);

    expect(response.status).toBe(200);
    expect(response.body.post).toMatchObject({
      title: "삭제된 게시물입니다.",
      content: "삭제된 게시물입니다.",
      isDeleted: true,
      canComment: false
    });
    expect(response.body.post.comments[0].content).toBe("기존 댓글");
    expect(JSON.stringify(response.body.post)).not.toContain("상세 게시글의 전체 내용입니다.");
  });

  it("returns 404 for a post that does not exist", async () => {
    const app = createApp();

    const response = await request(app).get("/api/posts/999999999");

    expect(response.status).toBe(404);
    expect(response.body.code).toBe("POST_NOT_FOUND");
  });
});

describe("POST /api/posts/:postId/comments", () => {
  async function createCommentTestPost(deletedAt: Date | null = null) {
    const { app, user, accessToken } = await loginTestUser();
    const post = await prisma.post.create({
      data: {
        userId: user.id,
        title: "댓글 테스트 게시글",
        content: "댓글을 작성할 게시글입니다.",
        deletedAt
      }
    });

    return { app, user, accessToken, post };
  }

  it("creates a top-level comment for an authenticated user", async () => {
    const { app, user, accessToken, post } = await createCommentTestPost();

    const response = await request(app)
      .post(`/api/posts/${post.id}/comments`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ content: "첫 번째 댓글입니다." });

    expect(response.status).toBe(201);
    expect(response.body.comment).toMatchObject({
      content: "첫 번째 댓글입니다.",
      parentId: null,
      author: { id: user.id, name: "게시글 테스트" }
    });
  });

  it("creates only one level of replies", async () => {
    const { app, user, accessToken, post } = await createCommentTestPost();
    const parent = await prisma.comment.create({
      data: { userId: user.id, postId: post.id, content: "부모 댓글" }
    });
    const replyResponse = await request(app)
      .post(`/api/posts/${post.id}/comments`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ content: "대댓글", parentId: parent.id });
    const nestedReplyResponse = await request(app)
      .post(`/api/posts/${post.id}/comments`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ content: "대대댓글", parentId: replyResponse.body.comment.id });

    expect(replyResponse.status).toBe(201);
    expect(replyResponse.body.comment.parentId).toBe(parent.id);
    expect(nestedReplyResponse.status).toBe(400);
    expect(nestedReplyResponse.body.code).toBe("REPLY_DEPTH_EXCEEDED");
  });

  it("rejects a parent comment from another post", async () => {
    const { app, user, accessToken, post } = await createCommentTestPost();
    const otherPost = await prisma.post.create({
      data: { userId: user.id, title: "다른 글", content: "다른 내용" }
    });
    const otherComment = await prisma.comment.create({
      data: { userId: user.id, postId: otherPost.id, content: "다른 글 댓글" }
    });

    const response = await request(app)
      .post(`/api/posts/${post.id}/comments`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ content: "잘못된 대댓글", parentId: otherComment.id });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("INVALID_PARENT_COMMENT");
  });

  it("rejects comments on a soft-deleted post", async () => {
    const { app, accessToken, post } = await createCommentTestPost(new Date());

    const response = await request(app)
      .post(`/api/posts/${post.id}/comments`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ content: "작성할 수 없는 댓글" });

    expect(response.status).toBe(409);
    expect(response.body.code).toBe("POST_DELETED");
    expect(await prisma.comment.count({ where: { postId: post.id } })).toBe(0);
  });
});

describe("PATCH and DELETE /api/posts/:postId", () => {
  it("allows only the author to update a post", async () => {
    const { app, user, accessToken } = await loginTestUser();
    const post = await prisma.post.create({ data: { userId: user.id, title: "수정 전", content: "기존 내용" } });

    const response = await request(app)
      .patch(`/api/posts/${post.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ title: "수정 후" });

    expect(response.status).toBe(200);
    expect(response.body.post).toMatchObject({ title: "수정 후", content: "기존 내용" });

    const other = await loginTestUser(POST_OTHER_EMAIL, "다른 사용자");
    const forbidden = await request(other.app)
      .patch(`/api/posts/${post.id}`)
      .set("Authorization", `Bearer ${other.accessToken}`)
      .send({ title: "가로챈 수정" });
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.code).toBe("POST_FORBIDDEN");
  });

  it("soft-deletes a post without erasing its original text or comments", async () => {
    const { app, user, accessToken } = await loginTestUser();
    const post = await prisma.post.create({ data: { userId: user.id, title: "보존할 제목", content: "보존할 내용" } });
    await prisma.comment.create({ data: { userId: user.id, postId: post.id, content: "남을 댓글" } });

    const response = await request(app)
      .delete(`/api/posts/${post.id}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    const stored = await prisma.post.findUniqueOrThrow({ where: { id: post.id } });
    expect(stored).toMatchObject({ title: "보존할 제목", content: "보존할 내용" });
    expect(stored.deletedAt).not.toBeNull();

    const detail = await request(app).get(`/api/posts/${post.id}`);
    expect(detail.body.post).toMatchObject({ title: "삭제된 게시물입니다.", isDeleted: true, canComment: false });
    expect(detail.body.post.comments[0].content).toBe("남을 댓글");
  });

  it("rejects deletion by another user and changes to an already deleted post", async () => {
    const owner = await loginTestUser();
    const post = await prisma.post.create({ data: { userId: owner.user.id, title: "권한 글", content: "내용" } });
    const other = await loginTestUser(POST_OTHER_EMAIL, "다른 사용자");

    const forbidden = await request(other.app)
      .delete(`/api/posts/${post.id}`)
      .set("Authorization", `Bearer ${other.accessToken}`);
    expect(forbidden.status).toBe(403);

    await prisma.post.update({ where: { id: post.id }, data: { deletedAt: new Date() } });
    const updateDeleted = await request(owner.app)
      .patch(`/api/posts/${post.id}`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ title: "수정 불가" });
    expect(updateDeleted.status).toBe(409);
    expect(updateDeleted.body.code).toBe("POST_DELETED");
  });
});

describe("PATCH and DELETE /api/posts/:postId/comments/:commentId", () => {
  async function createCommentForManagement() {
    const owner = await loginTestUser();
    const post = await prisma.post.create({
      data: { userId: owner.user.id, title: "댓글 관리 글", content: "내용" }
    });
    const comment = await prisma.comment.create({
      data: { userId: owner.user.id, postId: post.id, content: "수정 전 댓글" }
    });
    return { ...owner, post, comment };
  }

  it("allows the author to update a comment", async () => {
    const { app, accessToken, post, comment } = await createCommentForManagement();
    const response = await request(app)
      .patch(`/api/posts/${post.id}/comments/${comment.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ content: "수정된 댓글" });

    expect(response.status).toBe(200);
    expect(response.body.comment.content).toBe("수정된 댓글");
    expect((await prisma.comment.findUniqueOrThrow({ where: { id: comment.id } })).content).toBe("수정된 댓글");
  });

  it("rejects another user's update and deletion", async () => {
    const owner = await createCommentForManagement();
    const other = await loginTestUser(POST_OTHER_EMAIL, "다른 사용자");

    const update = await request(other.app)
      .patch(`/api/posts/${owner.post.id}/comments/${owner.comment.id}`)
      .set("Authorization", `Bearer ${other.accessToken}`)
      .send({ content: "권한 없는 수정" });
    const deletion = await request(other.app)
      .delete(`/api/posts/${owner.post.id}/comments/${owner.comment.id}`)
      .set("Authorization", `Bearer ${other.accessToken}`);

    expect(update.status).toBe(403);
    expect(update.body.code).toBe("COMMENT_FORBIDDEN");
    expect(deletion.status).toBe(403);
    expect(deletion.body.code).toBe("COMMENT_FORBIDDEN");
  });

  it("soft-deletes a parent comment while preserving its text and reply", async () => {
    const owner = await createCommentForManagement();
    const reply = await prisma.comment.create({
      data: {
        userId: owner.user.id,
        postId: owner.post.id,
        parentId: owner.comment.id,
        content: "남아 있는 대댓글"
      }
    });

    const response = await request(owner.app)
      .delete(`/api/posts/${owner.post.id}/comments/${owner.comment.id}`)
      .set("Authorization", `Bearer ${owner.accessToken}`);
    expect(response.status).toBe(200);

    const stored = await prisma.comment.findUniqueOrThrow({ where: { id: owner.comment.id } });
    expect(stored.content).toBe("수정 전 댓글");
    expect(stored.deletedAt).not.toBeNull();
    expect(await prisma.comment.findUnique({ where: { id: reply.id } })).not.toBeNull();

    const detail = await request(owner.app).get(`/api/posts/${owner.post.id}`);
    expect(detail.body.post.comments[0].content).toBe("삭제된 댓글입니다.");
    expect(detail.body.post.comments[0].replies[0].content).toBe("남아 있는 대댓글");

    const secondDelete = await request(owner.app)
      .delete(`/api/posts/${owner.post.id}/comments/${owner.comment.id}`)
      .set("Authorization", `Bearer ${owner.accessToken}`);
    expect(secondDelete.status).toBe(409);
    expect(secondDelete.body.code).toBe("COMMENT_DELETED");
  });
});

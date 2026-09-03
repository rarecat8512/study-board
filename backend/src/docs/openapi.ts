const errorResponses = {
  "400": { description: "입력값 오류", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
  "401": { description: "인증 필요 또는 인증 실패", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
  "403": { description: "권한 없음", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } }
};

const jsonBody = (schema: object) => ({ required: true, content: { "application/json": { schema } } });
const bearer = [{ bearerAuth: [] }];

export const openApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "Study Board API",
    version: "1.0.0",
    description: "Frontend to FullStack 학습 게시판의 Express REST API 문서입니다. 보호된 API는 우측 상단 Authorize에 액세스 토큰을 입력해 호출할 수 있습니다."
  },
  servers: [{ url: "/", description: "현재 API 서버" }],
  tags: [
    { name: "Auth", description: "회원가입, 이메일 인증과 JWT 세션" },
    { name: "Users", description: "로그인 사용자의 정보와 활동" },
    { name: "Posts", description: "게시글 CRUD와 검색·페이징" },
    { name: "Comments", description: "댓글과 1단계 대댓글 CRUD" }
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT", description: "로그인 응답의 accessToken" }
    },
    parameters: {
      PostId: { name: "postId", in: "path", required: true, schema: { type: "integer", minimum: 1 } },
      CommentId: { name: "commentId", in: "path", required: true, schema: { type: "integer", minimum: 1 } }
    },
    schemas: {
      Error: {
        type: "object",
        required: ["code", "message"],
        properties: { code: { type: "string", example: "VALIDATION_ERROR" }, message: { type: "string", example: "입력값을 확인해 주세요." }, fields: { type: "object", additionalProperties: true } }
      },
      User: {
        type: "object",
        required: ["id", "email", "name"],
        properties: { id: { type: "integer", example: 1 }, email: { type: "string", format: "email", example: "user@example.com" }, name: { type: "string", example: "학습자" } }
      },
      Author: {
        type: "object",
        required: ["id", "name"],
        properties: { id: { type: ["integer", "null"], example: 1 }, name: { type: "string", example: "학습자" } }
      },
      Comment: {
        type: "object",
        required: ["id", "content", "createdAt", "isDeleted", "author"],
        properties: {
          id: { type: "integer" }, content: { type: "string" }, parentId: { type: ["integer", "null"] }, createdAt: { type: "string", format: "date-time" }, updatedAt: { type: "string", format: "date-time" }, isDeleted: { type: "boolean" }, author: { $ref: "#/components/schemas/Author" }, replies: { type: "array", items: { $ref: "#/components/schemas/Comment" } }
        }
      },
      Post: {
        type: "object",
        required: ["id", "title", "content", "createdAt", "isDeleted", "author"],
        properties: {
          id: { type: "integer" }, title: { type: "string" }, content: { type: "string" }, createdAt: { type: "string", format: "date-time" }, updatedAt: { type: "string", format: "date-time" }, isDeleted: { type: "boolean" }, canComment: { type: "boolean" }, author: { $ref: "#/components/schemas/Author" }, comments: { type: "array", items: { $ref: "#/components/schemas/Comment" } }
        }
      },
      Pagination: {
        type: "object",
        required: ["page", "limit", "totalItems", "totalPages"],
        properties: { page: { type: "integer" }, limit: { type: "integer" }, totalItems: { type: "integer" }, totalPages: { type: "integer" } }
      }
    }
  },
  paths: {
    "/health": {
      get: { summary: "서버 상태 확인", responses: { "200": { description: "정상", content: { "application/json": { example: { status: "ok" } } } } } }
    },
    "/api/auth/register": {
      post: {
        tags: ["Auth"], summary: "회원가입 및 인증 메일 발송",
        requestBody: jsonBody({ type: "object", required: ["email", "password", "name"], properties: { email: { type: "string", format: "email" }, password: { type: "string", format: "password", minLength: 8 }, name: { type: "string", minLength: 2, maxLength: 50 } } }),
        responses: { "201": { description: "가입 접수", content: { "application/json": { schema: { type: "object", properties: { message: { type: "string" }, user: { $ref: "#/components/schemas/User" } } } } } }, "409": { description: "이메일 중복" }, "502": { description: "인증 메일 발송 실패" }, ...errorResponses }
      }
    },
    "/api/auth/verify-email": {
      post: { tags: ["Auth"], summary: "이메일 인증", requestBody: jsonBody({ type: "object", required: ["token"], properties: { token: { type: "string" } } }), responses: { "200": { description: "인증 완료" }, ...errorResponses } }
    },
    "/api/auth/login": {
      post: {
        tags: ["Auth"], summary: "로그인", description: "액세스 토큰을 JSON으로 반환하고 리프레시 토큰을 HttpOnly 쿠키로 설정합니다.",
        requestBody: jsonBody({ type: "object", required: ["email", "password"], properties: { email: { type: "string", format: "email" }, password: { type: "string", format: "password" } } }),
        responses: { "200": { description: "로그인 성공", content: { "application/json": { schema: { type: "object", properties: { accessToken: { type: "string" }, expiresIn: { type: "integer", example: 900 }, user: { $ref: "#/components/schemas/User" } } } } } }, ...errorResponses }
      }
    },
    "/api/auth/refresh": {
      post: { tags: ["Auth"], summary: "토큰 회전", description: "HttpOnly 리프레시 토큰 쿠키를 사용합니다.", responses: { "200": { description: "새 액세스 토큰과 회전된 쿠키" }, "401": { description: "리프레시 토큰 만료·재사용·누락" } } }
    },
    "/api/auth/logout": {
      post: { tags: ["Auth"], summary: "현재 세션 로그아웃", responses: { "204": { description: "로그아웃 완료" } } }
    },
    "/api/auth/me": {
      get: { tags: ["Auth"], summary: "현재 로그인 사용자", security: bearer, responses: { "200": { description: "사용자", content: { "application/json": { schema: { type: "object", properties: { user: { $ref: "#/components/schemas/User" } } } } } }, ...errorResponses } }
    },
    "/api/auth/change-password": {
      post: { tags: ["Auth"], summary: "비밀번호 변경 및 전체 세션 폐기", security: bearer, requestBody: jsonBody({ type: "object", required: ["currentPassword", "newPassword", "newPasswordConfirm"], properties: { currentPassword: { type: "string", format: "password" }, newPassword: { type: "string", format: "password", minLength: 8 }, newPasswordConfirm: { type: "string", format: "password" } } }), responses: { "200": { description: "변경 완료" }, ...errorResponses } }
    },
    "/api/auth/account": {
      delete: { tags: ["Auth"], summary: "회원 탈퇴", description: "개인정보를 영구 삭제하고 작성 콘텐츠의 작성자를 익명화합니다.", security: bearer, requestBody: jsonBody({ type: "object", required: ["currentPassword"], properties: { currentPassword: { type: "string", format: "password" } } }), responses: { "200": { description: "탈퇴 완료" }, ...errorResponses } }
    },
    "/api/users/me": {
      get: { tags: ["Users"], summary: "마이페이지 정보와 최근 활동", security: bearer, responses: { "200": { description: "사용자, 활동 개수, 최근 게시글·댓글" }, ...errorResponses } }
    },
    "/api/posts": {
      get: {
        tags: ["Posts"], summary: "게시글 목록·검색·페이징", parameters: [
          { name: "page", in: "query", schema: { type: "integer", minimum: 1, default: 1 } }, { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 50, default: 10 } }, { name: "q", in: "query", schema: { type: "string", maxLength: 100 } }
        ], responses: { "200": { description: "목록", content: { "application/json": { schema: { type: "object", properties: { posts: { type: "array", items: { $ref: "#/components/schemas/Post" } }, pagination: { $ref: "#/components/schemas/Pagination" } } } } } }, "400": errorResponses["400"] }
      },
      post: { tags: ["Posts"], summary: "게시글 작성", security: bearer, requestBody: jsonBody({ type: "object", required: ["title", "content"], properties: { title: { type: "string", maxLength: 100 }, content: { type: "string", maxLength: 10000 } } }), responses: { "201": { description: "작성 완료" }, ...errorResponses } }
    },
    "/api/posts/{postId}": {
      get: { tags: ["Posts"], summary: "게시글 상세와 댓글 조회", parameters: [{ $ref: "#/components/parameters/PostId" }], responses: { "200": { description: "상세", content: { "application/json": { schema: { type: "object", properties: { post: { $ref: "#/components/schemas/Post" } } } } } }, "404": { description: "게시글 없음" }, "400": errorResponses["400"] } },
      patch: { tags: ["Posts"], summary: "본인 게시글 수정", security: bearer, parameters: [{ $ref: "#/components/parameters/PostId" }], requestBody: jsonBody({ type: "object", minProperties: 1, properties: { title: { type: "string", maxLength: 100 }, content: { type: "string", maxLength: 10000 } } }), responses: { "200": { description: "수정 완료" }, "404": { description: "게시글 없음" }, "409": { description: "삭제된 게시글" }, ...errorResponses } },
      delete: { tags: ["Posts"], summary: "본인 게시글 소프트 삭제", security: bearer, parameters: [{ $ref: "#/components/parameters/PostId" }], responses: { "200": { description: "삭제 완료" }, "404": { description: "게시글 없음" }, "409": { description: "이미 삭제됨" }, ...errorResponses } }
    },
    "/api/posts/{postId}/comments": {
      post: { tags: ["Comments"], summary: "댓글 또는 1단계 대댓글 작성", security: bearer, parameters: [{ $ref: "#/components/parameters/PostId" }], requestBody: jsonBody({ type: "object", required: ["content"], properties: { content: { type: "string", maxLength: 1000 }, parentId: { type: "integer", minimum: 1, description: "생략하면 댓글, 입력하면 대댓글" } } }), responses: { "201": { description: "작성 완료" }, "404": { description: "게시글 없음" }, "409": { description: "삭제된 게시글" }, ...errorResponses } }
    },
    "/api/posts/{postId}/comments/{commentId}": {
      patch: { tags: ["Comments"], summary: "본인 댓글·대댓글 수정", security: bearer, parameters: [{ $ref: "#/components/parameters/PostId" }, { $ref: "#/components/parameters/CommentId" }], requestBody: jsonBody({ type: "object", required: ["content"], properties: { content: { type: "string", maxLength: 1000 } } }), responses: { "200": { description: "수정 완료" }, "404": { description: "댓글 없음" }, "409": { description: "삭제된 댓글" }, ...errorResponses } },
      delete: { tags: ["Comments"], summary: "본인 댓글·대댓글 소프트 삭제", security: bearer, parameters: [{ $ref: "#/components/parameters/PostId" }, { $ref: "#/components/parameters/CommentId" }], responses: { "200": { description: "삭제 완료" }, "404": { description: "댓글 없음" }, "409": { description: "이미 삭제됨" }, ...errorResponses } }
    }
  }
} as const;

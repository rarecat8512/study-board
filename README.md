# Study Board

Next.js부터 Express, Prisma, MySQL, JWT 인증까지 직접 연결하며 학습한 풀스택 게시판입니다.

## 주요 기능

- Brevo를 통한 이메일 회원가입 및 일회용 인증 링크
- bcrypt 비밀번호 해시와 현재 비밀번호 재확인
- 메모리 액세스 토큰 + HttpOnly 리프레시 토큰
- 리프레시 토큰 회전과 재사용 탐지
- 비밀번호 변경 시 모든 기기 세션 무효화
- 게시글 작성·조회·검색·수정·소프트 삭제
- 댓글과 1단계 대댓글 작성·수정·소프트 삭제
- 작성자 권한 검사와 마이페이지
- 회원 탈퇴 시 개인정보 영구 삭제와 콘텐츠 익명 보존
- 반응형 UI, 로딩·오류·404 상태
- Swagger UI와 OpenAPI 3.1 문서

## 기술 구성

| 영역 | 기술 |
| --- | --- |
| Frontend | Next.js 16 App Router, React 19, TypeScript |
| Backend | Express 5, TypeScript, Zod |
| Database | MySQL 8.4, Prisma 7 |
| Auth | JWT Access Token, opaque Refresh Token, bcrypt |
| Infra | Docker Compose, npm workspaces |
| Test | Vitest, Supertest |

## Docker 구성

Docker 이미지는 역할별로 분리하고 Compose가 전체 실행 순서를 관리합니다.

```text
Browser → Frontend(Next.js:3000) → Backend(Express:4000) → MySQL(3306)
                                      ↑
                              Migrate(일회성 작업)
```

- `frontend/Dockerfile`: Next.js를 운영용 standalone 형태로 빌드하고 3000번 포트에서 실행합니다. 브라우저가 사용할 API 주소는 이미지 빌드 인수 `NEXT_PUBLIC_API_URL`로 주입합니다.
- `backend/Dockerfile`: Prisma Client와 TypeScript 서버를 빌드합니다. 최종 실행 이미지는 개발 도구를 제외하고 4000번 포트에서 Express를 실행합니다.
- `migrate`: 백엔드 이미지의 별도 단계를 사용해 `prisma migrate deploy`를 한 번 실행한 후 종료합니다. 새 스키마가 적용되어야 백엔드가 시작됩니다.
- `mysql`: 데이터를 `mysql_data` 볼륨에 보존하며 헬스 체크로 실제 연결 가능 상태를 확인합니다.
- `docker-compose.yml`: 네트워크, 포트, 환경 변수, 볼륨, 헬스 체크와 `mysql → migrate → backend → frontend` 실행 의존성을 관리합니다.

`backend/.env`는 Compose가 실행 시 읽지만 Docker 이미지에는 복사되지 않습니다. 따라서 JWT 비밀값과 Brevo API 키가 이미지 레이어에 포함되지 않습니다.

## 핵심 설계 결정

### 인증 토큰

- 액세스 토큰은 브라우저 메모리에만 저장합니다.
- 리프레시 토큰은 JavaScript가 읽을 수 없는 HttpOnly 쿠키에 저장합니다.
- 리프레시 토큰은 사용할 때마다 교체하고, 사용 완료 토큰이 다시 나타나면 해당 세션을 폐기합니다.
- 여러 요청의 토큰이 동시에 만료되면 프론트엔드는 하나의 재발급 요청을 공유합니다.

### 프론트엔드 상태와 API 처리

- 전역 로그인 상태는 별도 서버 상태 라이브러리 없이 React Context로 관리합니다. 이 프로젝트에서 공유할 전역 상태가 사용자와 토큰으로 작기 때문입니다.
- 액세스 토큰과 사용자 정보는 `AuthProvider`의 메모리에 두고, 새로고침하면 HttpOnly 쿠키의 리프레시 토큰으로 세션을 복구합니다.
- 인증 API가 `401`을 반환하면 액세스 토큰을 한 번 재발급한 후 원래 요청을 다시 보냅니다. 재발급도 실패하면 메모리의 로그인 상태를 제거합니다.
- API 주소 생성, 공개 요청, JSON 응답 해석, 서버 오류 메시지 변환은 `frontend/app/lib/api.ts`에 모아 화면별 중복을 줄였습니다.
- 화면에서 예상 가능한 API 오류는 각 폼 가까이에 안내하고, 예상하지 못한 렌더링 오류는 App Router의 `error.tsx`가 처리합니다.

### 소프트 삭제

- 게시글과 댓글은 `deletedAt`만 기록하고 원문은 DB에 보존합니다.
- API 응답에서는 원문을 삭제 안내 문구로 치환합니다.
- 삭제된 게시글의 기존 댓글은 유지하지만 새 댓글 작성은 차단합니다.
- 부모 댓글이 삭제되어도 대댓글은 유지됩니다.

### 회원 탈퇴

- 사용자 행은 복구를 전제로 하지 않고 즉시 삭제합니다.
- `Post.userId`와 `Comment.userId`는 `ON DELETE SET NULL` 관계이므로 콘텐츠는 남습니다.
- 화면에는 삭제된 사용자의 정보 대신 `탈퇴한 사용자`가 표시됩니다.
- 인증 세션, 리프레시 토큰, 인증·재설정 토큰은 사용자와 함께 삭제됩니다.

## 데이터 관계

```text
User 1 ── N Post
User 1 ── N Comment
Post 1 ── N Comment
Comment 1 ── N Comment (한 단계 대댓글)
User 1 ── N AuthSession 1 ── N RefreshToken
```

회원 탈퇴 이후 Post와 Comment의 `userId`는 `NULL`이 될 수 있습니다.

## 로컬 실행 방법

### 1. 환경 변수 준비

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
```

개발용 JWT 시크릿은 예시 값을 그대로 사용하지 말고 충분히 긴 임의 문자열로 변경하세요.

### 2. 패키지와 MySQL 준비

```bash
npm install
docker compose up -d mysql
npm run prisma:generate --workspace backend
cd backend && npx prisma migrate deploy && cd ..
```

### 3. 서버 실행

터미널 두 개에서 각각 실행합니다.

```bash
npm run dev:backend
npm run dev:frontend
```

- Frontend: <http://localhost:3000>
- Backend health check: <http://localhost:4000/health>
- Swagger UI: <http://localhost:4000/api-docs>
- OpenAPI JSON: <http://localhost:4000/openapi.json>

`BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME`을 설정하면 실제 인증 메일을 발송합니다. 세 항목을 설정하지 않은 로컬 개발 환경에서는 콘솔 이메일 구현을 사용합니다.

### Docker로 전체 실행

`backend/.env`를 준비한 뒤 다음 한 줄로 MySQL, 마이그레이션, 백엔드와 프론트엔드를 함께 빌드하고 실행합니다.

```bash
docker compose up -d --build
```

상태와 로그를 확인하거나 서비스를 종료할 때는 다음 명령을 사용합니다.

```bash
docker compose ps
docker compose logs -f backend frontend
docker compose down
```

`docker compose down`은 컨테이너와 네트워크만 제거하며 MySQL 볼륨은 보존합니다. 데이터까지 지우는 `docker compose down -v`는 초기화가 필요할 때만 사용합니다.

## 검사 명령

```bash
npm run typecheck
npm test --workspace backend
npm run build
```

## 주요 API

| Method | Endpoint | 설명 |
| --- | --- | --- |
| POST | `/api/auth/register` | 회원가입 및 인증 메일 생성 |
| POST | `/api/auth/verify-email` | 이메일 인증 |
| POST | `/api/auth/login` | 로그인 |
| POST | `/api/auth/refresh` | 토큰 회전 |
| POST | `/api/auth/logout` | 현재 세션 로그아웃 |
| POST | `/api/auth/change-password` | 비밀번호 변경 및 전체 세션 폐기 |
| DELETE | `/api/auth/account` | 개인정보 영구 삭제 |
| GET | `/api/users/me` | 내 정보와 활동 조회 |
| GET/POST | `/api/posts` | 목록·검색 / 작성 |
| GET/PATCH/DELETE | `/api/posts/:postId` | 상세 / 수정 / 소프트 삭제 |
| POST | `/api/posts/:postId/comments` | 댓글·대댓글 작성 |
| PATCH/DELETE | `/api/posts/:postId/comments/:commentId` | 댓글 수정 / 소프트 삭제 |

## 운영 전 확인 사항

- HTTPS가 적용된 환경에서만 운영합니다.
- 운영용 MySQL 계정과 JWT 시크릿을 별도로 발급합니다.
- Brevo 발신 도메인이 없다면 무료 이메일 발신 주소의 전달률과 발신 주소 치환 여부를 확인합니다.
- 로그인·회원가입 API에 인프라 또는 게이트웨이의 요청 속도 제한을 적용합니다.
- 데이터베이스 백업·로그 보존·개인정보 처리 정책을 서비스 요구사항에 맞게 설정합니다.

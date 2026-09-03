FROM node:22-alpine AS dependencies
WORKDIR /app

COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN npm ci

FROM dependencies AS build
ENV DATABASE_URL=mysql://build:build@localhost:3306/build
ENV SHADOW_DATABASE_URL=mysql://build:build@localhost:3306/build_shadow
COPY backend backend
RUN npm run prisma:generate --workspace backend \
  && npm run build --workspace backend

# Compose가 데이터베이스 스키마를 먼저 갱신할 때 사용하는 일회성 단계입니다.
FROM build AS migration
CMD ["npm", "run", "prisma:deploy", "--workspace", "backend"]

FROM dependencies AS production-dependencies
RUN npm prune --omit=dev

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=production-dependencies /app/node_modules ./node_modules
COPY --from=build /app/backend/dist ./backend/dist
COPY --from=build /app/backend/package.json ./backend/package.json

WORKDIR /app/backend
EXPOSE 4000
CMD ["node", "dist/server.js"]

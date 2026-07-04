// drizzle-kit 설정 — 스키마에서 마이그레이션 생성/적용.
//   npx drizzle-kit generate   → db/migrations 에 SQL 생성
//   npx drizzle-kit push       → Neon 에 직접 반영(초기 개발 시)
// DATABASE_URL 이 환경에 있어야 한다(.env.local 로드 후 실행).
import type { Config } from "drizzle-kit";

export default {
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
} satisfies Config;

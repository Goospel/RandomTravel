// 세션 타입 확장 — JWT 콜백에서 실어 준 user.id 를 타입에 반영(M10).
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: { id: string } & DefaultSession["user"];
  }
}

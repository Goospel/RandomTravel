// M10 Auth.js v5 설정 — 구글·카카오 OAuth 로그인.
// provider 인자 없이 두면 Auth.js 가 env(AUTH_GOOGLE_ID/SECRET, AUTH_KAKAO_ID/SECRET,
// AUTH_SECRET)를 자동으로 읽는다. 세션은 JWT 전략(서버리스에서 요청마다 DB 조회 회피);
// 사용자·계정 영속화는 Drizzle 어댑터가 담당한다.

import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Kakao from "next-auth/providers/kakao";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/db";
import { accounts, sessions, users, verificationTokens } from "@/db/schema";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  session: { strategy: "jwt" },
  providers: [Google, Kakao],
  callbacks: {
    // JWT 전략이라 세션에 user.id 가 기본 노출 안 됨 — token.sub(=로그인 시 DB user.id)를
    // 세션에 실어 준다. API 라우트에서 소유자 판별에 쓴다.
    session({ session, token }) {
      if (session.user && token.sub) session.user.id = token.sub;
      return session;
    },
  },
});

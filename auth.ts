// M10 Auth.js v5 설정 — 구글·카카오 OAuth 로그인.
// provider 인자 없이 두면 Auth.js 가 env(AUTH_GOOGLE_ID/SECRET, AUTH_KAKAO_ID/SECRET,
// AUTH_SECRET)를 자동으로 읽는다. 세션은 JWT 전략(서버리스에서 요청마다 DB 조회 회피);
// 사용자·계정 영속화는 Drizzle 어댑터가 담당한다.

import NextAuth from "next-auth";
import type { Provider } from "next-auth/providers";
import Google from "next-auth/providers/google";
import Kakao from "next-auth/providers/kakao";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/db";
import { accounts, sessions, users, verificationTokens } from "@/db/schema";

// env(클라이언트 ID)가 있는 provider만 켠다 — 크레덴셜 없는 provider 버튼이
// 떠서 눌러도 실패하는 상황을 막는다(예: 카카오 셋업 전 배포).
const providers: Provider[] = [];
if (process.env.AUTH_GOOGLE_ID) providers.push(Google);
if (process.env.AUTH_KAKAO_ID) providers.push(Kakao);

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  session: { strategy: "jwt" },
  providers,
  // Vercel Preview 배포는 도메인이 배포마다 달라(travelanywhere-kr-git-…-goospel.vercel.app)
  // 구글 콘솔 "승인된 리디렉션 URI"에 미리 등록할 수 없다 → Preview에서 로그인하면
  // redirect_uri 가 그 Preview 도메인으로 조립돼 구글이 400 redirect_uri_mismatch 를 낸다.
  // AUTH_REDIRECT_PROXY_URL(프로덕션·Preview 양쪽 env 에 동일값 필요)이 있으면 Auth.js 가
  // OAuth 콜백을 이 안정적인 프로덕션 URL 로 프록시하고(원래 Preview URL 은 state 에 보존),
  // 프로덕션 콜백이 state 검증 후 원래 Preview 로 되돌린다 → 콘솔엔 프로덕션 콜백만 등록하면 된다.
  // 값 미설정(로컬 등)이면 undefined → 프록시 비활성(기존 동작 그대로).
  redirectProxyUrl: process.env.AUTH_REDIRECT_PROXY_URL,
  callbacks: {
    // JWT 전략이라 세션에 user.id 가 기본 노출 안 됨 — token.sub(=로그인 시 DB user.id)를
    // 세션에 실어 준다. API 라우트에서 소유자 판별에 쓴다.
    session({ session, token }) {
      if (session.user && token.sub) session.user.id = token.sub;
      return session;
    },
  },
});

"use client";

// Auth.js 세션 컨텍스트를 클라이언트 트리에 제공(M10). JWT 전략이라 세션은
// /api/auth/session 에서 받아온다. 서버 레이아웃에서 이 클라이언트 래퍼로 감싼다.

import { SessionProvider } from "next-auth/react";

export function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}

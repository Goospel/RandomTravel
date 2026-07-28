"use client";

// 로그인/로그아웃 UI (M10). 비로그인: '로그인' 버튼 → Auth.js 제공자 선택(구글/카카오).
// 로그인: 표시이름·아바타 + '로그아웃'. 세션은 useSession(SessionProvider) 로 반응형.

import { useSession, signIn, signOut } from "next-auth/react";
import { Icon } from "@/components/icons";
import { pillButton } from "@/components/InstallButton";

export function AuthButtons() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <div className="h-8 w-20 animate-pulse rounded-full bg-g-surface-2" aria-hidden />
    );
  }

  if (session?.user) {
    const label = session.user.name ?? session.user.email ?? "여행자";
    return (
      <div className="flex items-center gap-2">
        {session.user.image ? (
          // 외부 OAuth 아바타 — 도메인 불특정이라 next/image 대신 img.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={session.user.image}
            alt=""
            className="h-7 w-7 rounded-full"
            referrerPolicy="no-referrer"
          />
        ) : null}
        <span className="max-w-[8rem] truncate text-[13px] text-g-text-2">{label}</span>
        <button type="button" onClick={() => signOut()} className={pillButton}>
          로그아웃
        </button>
      </div>
    );
  }

  return (
    <button type="button" onClick={() => signIn()} className={pillButton}>
      <Icon name="user" size={14} />
      로그인
    </button>
  );
}

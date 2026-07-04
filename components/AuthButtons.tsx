"use client";

// 로그인/로그아웃 UI (M10). 비로그인: '로그인' 버튼 → Auth.js 제공자 선택(구글/카카오).
// 로그인: 표시이름·아바타 + '로그아웃'. 세션은 useSession(SessionProvider) 로 반응형.

import { useSession, signIn, signOut } from "next-auth/react";

export function AuthButtons() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <div
        className="h-8 w-20 animate-pulse rounded-full bg-zinc-100 dark:bg-zinc-800"
        aria-hidden
      />
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
        <span className="max-w-[8rem] truncate text-sm text-zinc-600 dark:text-zinc-300">
          {label}
        </span>
        <button
          type="button"
          onClick={() => signOut()}
          className="rounded-full border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-600 transition-colors hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-500"
        >
          로그아웃
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => signIn()}
      className="rounded-full border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-600 transition-colors hover:border-indigo-300 hover:text-indigo-600 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-indigo-700 dark:hover:text-indigo-400"
    >
      로그인
    </button>
  );
}

"use client";

// 🎫 심사용 로그인 폼(§14.1). Credentials 프로바이더로 로그인한 뒤 홈으로 보낸다.
//
// redirect:false 로 받는 이유 — 기본(redirect:true)이면 실패가 Auth.js 에러 페이지로
//   튕겨서 한국어 안내를 못 보여준다. 성공 시엔 라우터 push 대신 하드 이동으로
//   세션을 새로 읽게 한다(SessionProvider 가 확실히 로그인 상태로 다시 뜬다).

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Icon } from "@/components/icons";

// 입력 필드 = 카드 안 인셋(designGuide 모양표) — 흰 카드 위에서 한 단 눌린 면으로 보이게
// surface-3 + radius 14. 포커스 표시는 전역 `:focus-visible`(--g-primary 아웃라인)이 담당한다.
const FIELD =
  "w-full rounded-[14px] border border-g-border bg-g-surface-3 px-3.5 py-2.5 text-[14px] leading-[1.4] text-g-text";
// 그룹 라벨 규격 — 11/700 · uppercase · 0.1em · 흰 면 위라 --g-text-3(designGuide 타이포표).
const LABEL =
  "text-[11px] font-bold uppercase leading-[1.3] tracking-[0.1em] text-g-text-3";

export function DemoLoginForm() {
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await signIn("credentials", { id, password, redirect: false });
      if (res?.error) {
        setError("아이디나 비밀번호가 맞지 않아요.");
        setPending(false);
        return;
      }
      window.location.href = "/";
    } catch {
      setError("로그인에 실패했어요. 잠시 뒤 다시 시도해 주세요.");
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="demo-id" className={LABEL}>
          아이디
        </label>
        <input
          id="demo-id"
          name="id"
          type="text"
          autoComplete="username"
          value={id}
          onChange={(e) => setId(e.target.value)}
          className={FIELD}
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="demo-password" className={LABEL}>
          비밀번호
        </label>
        <input
          id="demo-password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={FIELD}
          required
        />
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-[14px] bg-g-error-soft px-3.5 py-2.5 text-[13px] leading-[1.6] text-g-error-text"
        >
          {error}
        </p>
      ) : null}

      {/* 이 화면의 주 버튼 — 홈 CTA 와 같은 모양(h-60 · radius 20 스퀘어클)이라 심사위원이
          처음 보는 화면도 같은 제품으로 읽힌다.
          ⚠️ 면은 --g-primary 가 아니라 --g-primary-deep 이다 — 밝은 잉크(--g-on-primary)를
          얹으므로 primary 위(4.59:1)면 대비가 모자란다(designGuide 「대비 함정 1」, 7.2:1).
          틴티드 섀도는 주홍 주 CTA 전용 예외라 여기엔 붙이지 않는다(정적 요소 그림자 금지).
          hover 가 deep 보다 한 톤 밝은 --g-primary-hover 인 건 의도다(6.3:1로 여전히 통과) —
          --g-primary 로 "고치면" 다시 4.59:1 로 떨어진다. */}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-[60px] w-full items-center justify-center gap-2.5 rounded-[20px] bg-g-primary-deep text-[17px] font-bold tracking-[-0.01em] text-g-on-primary [corner-shape:squircle] hover:bg-g-primary-hover disabled:cursor-default disabled:opacity-60"
      >
        <Icon name="key" size={18} />
        {pending ? "확인 중이에요" : "로그인"}
      </button>
    </form>
  );
}

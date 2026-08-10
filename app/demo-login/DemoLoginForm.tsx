"use client";

// 🎫 심사용 로그인 폼(§14.1). Credentials 프로바이더로 로그인한 뒤 홈으로 보낸다.
//
// redirect:false 로 받는 이유 — 기본(redirect:true)이면 실패가 Auth.js 에러 페이지로
//   튕겨서 한국어 안내를 못 보여준다. 성공 시엔 라우터 push 대신 하드 이동으로
//   세션을 새로 읽게 한다(SessionProvider 가 확실히 로그인 상태로 다시 뜬다).

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Icon } from "@/components/icons";

const FIELD =
  "w-full rounded-lg border border-g-border bg-g-surface px-3 py-2.5 text-[14px] leading-[1.4] text-g-text";
const LABEL = "text-[11px] font-bold leading-[1.3] tracking-[0.12em] text-g-text-2 uppercase";

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
          className="rounded-lg bg-g-error-soft px-3 py-2.5 text-[13px] leading-[1.6] text-g-error-text"
        >
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-[52px] w-full items-center justify-center gap-2 rounded-md bg-g-primary text-[16px] font-medium text-g-on-primary hover:bg-g-primary-hover disabled:cursor-default disabled:opacity-60"
      >
        <Icon name="key" size={16} />
        {pending ? "확인 중이에요" : "로그인"}
      </button>
    </form>
  );
}

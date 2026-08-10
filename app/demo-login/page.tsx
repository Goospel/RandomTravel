// 🎫 심사용 로그인(§14.1 테스트 계정). **어디에서도 링크하지 않는 비공개 경로** —
// 주소는 제출 양식에만 적는다. 검색 노출도 막는다(robots noindex).
//
// env(DEMO_LOGIN_ID·DEMO_LOGIN_PASSWORD)가 없으면 프로바이더 자체가 꺼져 있으므로
//   폼 대신 안내만 그린다 — 눌러도 안 되는 폼을 띄우지 않는다(auth.ts 게이트와 같은 취지).

import type { Metadata } from "next";
import { demoLoginEnabled } from "@/lib/demoLogin";
import { Icon } from "@/components/icons";
import { DemoLoginForm } from "./DemoLoginForm";

export const metadata: Metadata = {
  title: "심사용 로그인 — 어디든",
  robots: { index: false, follow: false },
};

// 기본값이면 정적 프리렌더라 env 판정이 **빌드 시각**에 굳는다 — 심사 직전 Vercel 에 env 를
//   넣거나 심사 후 빼도 재배포 전까지 화면이 안 따라온다. 요청마다 읽게 고정한다.
export const dynamic = "force-dynamic";

export default function DemoLoginPage() {
  const enabled = demoLoginEnabled(process.env);

  return (
    <main className="mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-center gap-3 px-4 py-10 sm:px-5">
      <header className="flex flex-col gap-2">
        <h1 className="flex items-center gap-2 font-display text-[24px] font-bold leading-[1.2] tracking-[-0.03em]">
          <Icon name="lock" size={22} className="text-g-primary" />
          심사용 로그인
        </h1>
        <p className="text-[14px] leading-[1.6] text-g-text-2">
          {enabled
            ? "받으신 아이디와 비밀번호로 들어오시면, 기록이 채워진 계정으로 서비스를 둘러보실 수 있어요."
            : "심사 기간에만 열리는 경로입니다."}
        </p>
      </header>

      {enabled ? (
        <section className="rounded-2xl border border-g-border bg-g-surface p-5">
          <DemoLoginForm />
        </section>
      ) : null}
    </main>
  );
}

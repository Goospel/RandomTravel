// 익명 수집 고지 1장(M26 · §12.4 — 수집 시작 시점부터 고지). 정적 페이지.
//
// 톤은 법무 문서가 아니라 designGuide 의 해요체 — 실제로 읽히는 게 목적이다.
// ⚠️ 여기 적힌 내용과 POST /api/events 가 실제로 받는 필드(§12.5)는 **같아야 한다** —
//   스키마를 늘리면 이 문서도 같이 고친다(안 고치면 고지가 곧 거짓이 된다).

import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/icons";

export const metadata: Metadata = {
  title: "수집 안내 — 어디든",
  description: "어디든이 모으는 익명 사용 기록이 무엇이고 왜 모으는지 안내합니다.",
};

// 문서형 페이지라 장식을 더하지 않는다 — 카드 규격(16px)만 designGuide 에 맞춘다.
const CARD = "rounded-2xl border border-g-border bg-g-surface p-5";
const H2 = "font-display text-[16px] font-bold leading-[1.35] tracking-[-0.02em]";
const P = "mt-2 text-[14px] leading-[1.7] text-g-text-2";

export default function PrivacyPage() {
  return (
    <main className="mx-auto flex w-full max-w-[720px] flex-1 flex-col gap-3.5 px-4 py-7 sm:px-5">
      <header className="flex flex-col gap-2">
        <Link
          href="/"
          className="inline-flex w-fit items-center gap-1.5 text-[13px] font-medium text-g-primary hover:text-g-primary-hover"
        >
          <Icon name="arrowLeft" size={14} />
          뽑기로 돌아가기
        </Link>
        <h1 className="flex items-center gap-2 font-display text-[24px] font-bold leading-[1.2] tracking-[-0.03em] sm:text-[32px] sm:leading-[1.15]">
          <Icon name="lock" size={26} className="text-g-primary" />
          수집 안내
        </h1>
        <p className="text-[15px] leading-[1.6] text-g-text-2">
          어디든은 <b className="font-bold text-g-text">로그인 없이도</b> 쓸 수 있고, 누구인지
          알 수 있는 정보는 모으지 않아요.
        </p>
      </header>

      <section className={CARD}>
        <h2 className={H2}>무엇을 모으나요</h2>
        <p className={P}>
          여행지를 뽑거나, 찜하거나, 길찾기를 열거나, 다녀왔다고 표시할 때 아래 정보가 서버에
          한 줄 기록돼요.
        </p>
        <ul className="mt-3 flex flex-col gap-1.5 text-[14px] leading-[1.6] text-g-text-2">
          {[
            ["어떤 행동", "뽑기 · 다시 뽑기 · 찜 · 길찾기 · 다녀옴"],
            ["뽑기 방식", "순수 랜덤인지 조건을 걸었는지"],
            ["여행지 정보", "시·도, 종류, 여행지 번호"],
            ["임시 번호", "브라우저가 만든 무작위 번호"],
            ["시각", "그 행동이 일어난 시각"],
          ].map(([k, v]) => (
            <li key={k} className="flex gap-2">
              <span className="w-[76px] flex-none font-bold text-g-text">{k}</span>
              <span className="flex-1">{v}</span>
            </li>
          ))}
        </ul>
        <p className={P}>
          이름·이메일·전화번호·정확한 위치는 <b className="font-bold text-g-text">모으지 않아요</b>.
          로그인을 하더라도 이 기록은 계정과 연결되지 않아요 — 계정과 이어 붙일 수 있는 항목
          자체를 저장 구조에서 뺐어요.
        </p>
      </section>

      <section className={CARD}>
        <h2 className={H2}>왜 모으나요</h2>
        <p className={P}>
          추천이 실제로 전국에 고르게 퍼지는지 확인하려고요. 결과는 개인이 아니라 합계로만 보고,{" "}
          <Link href="/impact" className="underline underline-offset-2 hover:text-g-primary">
            임팩트 대시보드
          </Link>
          에 그대로 공개해요.
        </p>
      </section>

      <section className={CARD}>
        <h2 className={H2}>임시 번호는 뭔가요</h2>
        <p className={P}>
          같은 브라우저에서 온 기록을 묶어 세기 위한 무작위 번호예요. 개인 정보에서 만든 값이
          아니라 누구인지 되짚을 수 없고, 브라우저 저장소를 지우면 사라져요.
        </p>
      </section>

      <section className={CARD}>
        <h2 className={H2}>내 기기에만 남는 것</h2>
        <p className={P}>
          찜·다녀온 곳·최근 본 곳 목록은 기본적으로 이 기기의 브라우저 저장소에만 있어요.
          로그인하면 기기 간에 같이 보이도록 계정에 저장되고, 이건 위의 익명 기록과 별개예요.
        </p>
      </section>

      <section className={CARD}>
        <h2 className={H2}>문의</h2>
        <p className={P}>
          궁금한 점이나 삭제 요청은{" "}
          <a
            href="https://github.com/Goospel/RandomTravel/issues"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-g-primary"
          >
            GitHub 이슈
          </a>
          로 남겨 주세요. 개인 제작 서비스라 이곳이 유일한 창구예요.
        </p>
      </section>
    </main>
  );
}

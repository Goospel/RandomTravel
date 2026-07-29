import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { DM_Sans } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { Providers } from "@/components/Providers";

// Genesis 타이포 — display(숫자·제목) General Sans / body(본문·UI) DM Sans.
// ⚠️ 둘 다 한글 글리프가 없다 → 실제 한글은 폴백("Apple SD Gothic Neo"·"Malgun Gothic")이
//    렌더한다. 의도된 동작이다(Pretendard 등 추가 금지 — 사용자 결정).
// General Sans 는 Fontshare 만 배포해 next/font/google 로 못 받는다 → woff2 를
// public/fonts 에 셀프호스팅하고 next/font/local 로 연결(외부 요청 0).
const generalSans = localFont({
  src: [
    { path: "../public/fonts/GeneralSans-400.woff2", weight: "400", style: "normal" },
    { path: "../public/fonts/GeneralSans-500.woff2", weight: "500", style: "normal" },
    { path: "../public/fonts/GeneralSans-600.woff2", weight: "600", style: "normal" },
    { path: "../public/fonts/GeneralSans-700.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-general-sans",
  display: "swap",
});

const dmSans = DM_Sans({
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "어디든 — 랜덤 국내 여행지 추천",
  description:
    "버튼 하나로 오늘 떠날 국내 여행지를 무작위로 뽑아주는 웹앱 — 유명세 대신 전국 어디든 같은 출발선.",
  applicationName: "어디든",
  // Next 가 app/manifest.ts 를 감지해 <link rel="manifest"> 를 자동 주입한다.
  appleWebApp: { capable: true, title: "어디든", statusBarStyle: "default" },
  // 아이콘은 파일 기반 자동 감지에 맡긴다: app/icon.png(파비콘)·app/apple-icon.png(애플 터치).
  // metadata.icons 를 명시하면 그 자동 감지가 무시되므로 여기서 지정하지 않는다.
};

// themeColor 는 Next 15+ 에서 viewport 로 분리됨(상태바 틴트). 다크/라이트 각각 지정.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#6366f1" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0b0e" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      // next/font 변수(--font-general-sans·--font-dm-sans)를 <html> 에 심는다 —
      // globals.css 의 --g-display/--g-body 가 이 변수를 1순위 패밀리로 참조한다.
      className={`${generalSans.variable} ${dmSans.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-g-bg font-body text-g-text">
        <Providers>{children}</Providers>
        {/* 데이터 출처 표시 — 운영계정 전환 조건(공사 요청 2026-07-28). 모든 페이지 공통.
            표기 문안은 공사 회신 2026-07-29 지침을 따른다: "ⓒ한국관광공사"(또는 "ⓒ한국관광콘텐츠랩")로 적고
            "TourAPI"로는 출처를 표기하지 않는다. */}
        <footer className="border-t border-g-border px-4 py-5 text-center text-[11px] leading-[1.7] text-g-text-2">
          <p>
            관광 정보{" "}
            <a
              href="https://api.visitkorea.or.kr"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-g-primary"
            >
              ⓒ한국관광공사
            </a>{" "}
            · 날씨{" "}
            <a
              href="https://www.data.go.kr/data/15084084/openapi.do"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-g-primary"
            >
              기상청 단기예보 조회서비스
            </a>
          </p>
          <p className="mt-[5px]">
            공공데이터를 활용한 개인 제작 서비스이며, 데이터 제공기관과 무관합니다.
          </p>
          {/* 📈 M26 — 임팩트 대시보드(§7.15)·익명 수집 안내(§12.4) 진입점. 홈 정면 노출은 후속. */}
          <p className="mt-[7px] flex items-center justify-center gap-2">
            <Link href="/impact" className="underline underline-offset-2 hover:text-g-primary">
              임팩트 대시보드
            </Link>
            <span aria-hidden>·</span>
            <Link href="/privacy" className="underline underline-offset-2 hover:text-g-primary">
              수집 안내
            </Link>
          </p>
        </footer>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}

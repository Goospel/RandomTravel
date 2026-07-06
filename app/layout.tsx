import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { Providers } from "@/components/Providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "어디든 — 랜덤 국내 여행지 추천",
  description: "버튼 하나로 오늘 떠날 국내 여행지를 무작위로 뽑아주는 웹앱.",
  applicationName: "어디든",
  // Next 가 app/manifest.ts 를 감지해 <link rel="manifest"> 를 자동 주입한다.
  appleWebApp: { capable: true, title: "어디든", statusBarStyle: "default" },
  // 아이콘은 파일 기반 자동 감지에 맡긴다: app/icon.png(파비콘)·app/apple-icon.png(애플 터치).
  // metadata.icons 를 명시하면 그 자동 감지가 무시되므로 여기서 지정하지 않는다.
};

// themeColor 는 Next 15+ 에서 viewport 로 분리됨(상태바 틴트). 다크/라이트 각각 지정.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#059669" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}

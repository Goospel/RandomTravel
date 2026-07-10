import type { MetadataRoute } from "next";

// PWA 웹 매니페스트 (M9, plan.md §11 M9). Next 가 /manifest.webmanifest 로 서빙하고
// <link rel="manifest"> 를 자동 주입한다. 아이콘은 public/ 의 PNG(주사위 🎲 브랜드).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "어디든 — 랜덤 국내 여행지 추천",
    short_name: "어디든",
    description:
      "버튼 하나로 오늘 떠날 국내 여행지를 무작위로 뽑아주는 웹앱 — 유명세 대신 전국 어디든 같은 출발선.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#059669",
    lang: "ko",
    orientation: "portrait",
    categories: ["travel", "lifestyle"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}

"use client";

import { useEffect } from "react";

// 서비스워커 등록 (M9 PWA). dev 는 HMR 과 SW 가 충돌하므로 프로덕션에서만 등록한다.
// 렌더는 없음 — 마운트 시 부작용으로 등록만.
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" ||
      typeof navigator === "undefined" ||
      !("serviceWorker" in navigator)
    ) {
      return;
    }
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // 등록 실패는 앱 동작에 치명적이지 않으므로 조용히 무시
    });
  }, []);
  return null;
}

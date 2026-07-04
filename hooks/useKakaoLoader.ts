"use client";

// 카카오 지도 JS SDK 를 브라우저에 1회 로드 (M8, plan.md §7.1).
// autoload=false 로 받아 kakao.maps.load 로 수동 초기화한다. 키는 도메인 제한으로
// 보호되는 공개 키(NEXT_PUBLIC_). 여러 컴포넌트가 마운트돼도 스크립트는 한 번만 삽입.

import { useEffect, useState } from "react";
import { kakaoSdkUrl } from "@/lib/mapView";

export type KakaoStatus = "loading" | "ready" | "error" | "no-key";

const SCRIPT_ID = "kakao-maps-sdk";

export function useKakaoLoader(): KakaoStatus {
  const [status, setStatus] = useState<KakaoStatus>("loading");

  useEffect(() => {
    // SDK 로드 상태는 브라우저에서만 판정 가능(window·스크립트 load 의존)해 effect 에서
    // setState 한다. 하이드레이션(useTravelStore)과 같은 정당한 패턴이라 규칙만 끈다.
    /* eslint-disable react-hooks/set-state-in-effect */
    const key = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY;
    if (!key) {
      setStatus("no-key");
      return;
    }
    // 이미 완전히 로드됨(생성자 준비 완료) — 재마운트 시 즉시 준비.
    if (window.kakao?.maps?.LatLng) {
      setStatus("ready");
      return;
    }

    // 스크립트 load 이후 maps.load 로 초기화가 끝나야 'ready'.
    const init = () => {
      if (!window.kakao) {
        setStatus("error");
        return;
      }
      window.kakao.maps.load(() => setStatus("ready"));
    };
    const onError = () => setStatus("error");

    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      // 다른 마운트가 이미 삽입 — 로드 완료를 기다린다.
      if (window.kakao) init();
      else {
        existing.addEventListener("load", init, { once: true });
        existing.addEventListener("error", onError, { once: true });
      }
      return;
    }

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = kakaoSdkUrl(key);
    script.async = true;
    script.addEventListener("load", init, { once: true });
    script.addEventListener("error", onError, { once: true });
    document.head.appendChild(script);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  return status;
}

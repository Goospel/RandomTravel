"use client";

// 카카오 지도 JS SDK 를 브라우저에 1회 로드 (M8, plan.md §7.1).
// autoload=false 로 받아 kakao.maps.load 로 수동 초기화한다. 키는 도메인 제한으로
// 보호되는 공개 키(NEXT_PUBLIC_). 여러 컴포넌트가 마운트돼도 스크립트는 한 번만 삽입.
//
// 로드 결과(ready/error)를 모듈 스코프에 캐시한다 — 한 번 load/error 를 낸 <script>
// 는 그 이벤트를 재발화하지 않으므로, /map 을 떠났다 재진입해 훅이 재마운트되면
// 남은 <script> 에 리스너를 다시 걸어도 영영 안 불린다(무한 '로딩' 스피너 함정).
// 캐시된 결과로 재마운트 시 상태를 즉시 복원해 이 함정을 막는다.

import { useEffect, useState } from "react";
import { kakaoSdkUrl } from "@/lib/mapView";

export type KakaoStatus = "loading" | "ready" | "error" | "no-key";

const SCRIPT_ID = "kakao-maps-sdk";

type SdkPhase = "idle" | "loading" | "ready" | "error";
let sdkPhase: SdkPhase = "idle";
// 로딩 완료를 기다리는 대기자들(동시에 여러 훅이 기다릴 수 있음).
const waiters = new Set<(s: "ready" | "error") => void>();

function settle(phase: "ready" | "error") {
  sdkPhase = phase;
  const pending = [...waiters];
  waiters.clear();
  for (const w of pending) w(phase);
}

export function useKakaoLoader(): KakaoStatus {
  const [status, setStatus] = useState<KakaoStatus>("loading");

  useEffect(() => {
    // SDK 로드 상태는 브라우저에서만 판정 가능해 effect 에서 setState 한다
    // (하이드레이션과 같은 정당한 패턴이라 규칙만 끈다).
    /* eslint-disable react-hooks/set-state-in-effect */
    const key = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY;
    if (!key) {
      setStatus("no-key");
      return;
    }
    // 이미 완전히 준비됨(생성자 사용 가능).
    if (sdkPhase === "ready" || window.kakao?.maps?.LatLng) {
      sdkPhase = "ready";
      setStatus("ready");
      return;
    }
    // 이전 로드가 실패로 확정 — 재발화 못 하는 <script> 대신 캐시로 에러 복원.
    if (sdkPhase === "error") {
      setStatus("error");
      return;
    }

    // 로딩 중이거나 아직 시작 전 — 완료를 기다린다.
    let active = true;
    const onSettle = (phase: "ready" | "error") => {
      if (active) setStatus(phase);
    };
    waiters.add(onSettle);

    const init = () => {
      if (!window.kakao) {
        settle("error");
        return;
      }
      window.kakao.maps.load(() => settle("ready"));
    };

    // 로딩 시작은 최초 1회만(sdkPhase idle). "loading" 이면 다른 훅이 이미 시작한
    // 것이라 waiters 로만 기다린다.
    if (sdkPhase === "idle") {
      sdkPhase = "loading";
      const existing = document.getElementById(
        SCRIPT_ID,
      ) as HTMLScriptElement | null;
      if (existing) {
        if (window.kakao) init();
        else {
          existing.addEventListener("load", init, { once: true });
          existing.addEventListener("error", () => settle("error"), {
            once: true,
          });
        }
      } else {
        const script = document.createElement("script");
        script.id = SCRIPT_ID;
        script.src = kakaoSdkUrl(key);
        script.async = true;
        script.addEventListener("load", init, { once: true });
        script.addEventListener("error", () => settle("error"), { once: true });
        document.head.appendChild(script);
      }
    }

    return () => {
      active = false;
      waiters.delete(onSettle);
    };
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  return status;
}

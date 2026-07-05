"use client";

// 💬 뽑기 결과 카톡 공유(M13, plan.md §7.5) — 카카오 JS SDK 로드/초기화 + 공유 실행.
// 순수 템플릿·평문은 lib/kakaoShare, 여기선 SDK 배선과 폴백만 담당.
// useKakaoLoader 와 같은 모듈 싱글턴 로딩 패턴(스크립트 1회 주입, 결과 캐시).

import { useCallback, useRef } from "react";
import { KAKAO_JS_SDK } from "@/lib/mapView";
import { buildShareFeed, shareText, type ShareContext } from "@/lib/kakaoShare";
import type { Place } from "@/types/tour";

// window.Kakao(JS SDK) 최소 타입.
interface KakaoSdk {
  init: (key: string) => void;
  isInitialized: () => boolean;
  Share: { sendDefault: (settings: unknown) => void };
}
declare global {
  interface Window {
    Kakao?: KakaoSdk;
  }
}

const SCRIPT_ID = "kakao-js-sdk";
type Phase = "idle" | "loading" | "ready" | "error";
let phase: Phase = "idle";
let loadPromise: Promise<boolean> | null = null;

// kakao.min.js 를 1회만 주입하고 로드 결과를 캐시. 여러 번 눌러도 스크립트는 하나.
function loadSdk(): Promise<boolean> {
  if (phase === "ready") return Promise.resolve(true);
  if (phase === "error") return Promise.resolve(false);
  if (loadPromise) return loadPromise;

  loadPromise = new Promise<boolean>((resolve) => {
    if (typeof window === "undefined") {
      resolve(false);
      return;
    }
    if (window.Kakao) {
      phase = "ready";
      resolve(true);
      return;
    }
    const onLoad = () => {
      phase = "ready";
      resolve(true);
    };
    const onErr = () => {
      phase = "error";
      resolve(false);
    };
    const existing = document.getElementById(
      SCRIPT_ID,
    ) as HTMLScriptElement | null;
    if (existing) {
      if (window.Kakao) {
        phase = "ready";
        resolve(true);
      } else {
        existing.addEventListener("load", onLoad, { once: true });
        existing.addEventListener("error", onErr, { once: true });
      }
      return;
    }
    phase = "loading";
    const s = document.createElement("script");
    s.id = SCRIPT_ID;
    s.src = KAKAO_JS_SDK.src;
    s.integrity = KAKAO_JS_SDK.integrity;
    s.crossOrigin = "anonymous";
    s.async = true;
    s.addEventListener("load", onLoad, { once: true });
    s.addEventListener("error", onErr, { once: true });
    document.head.appendChild(s);
  });
  return loadPromise;
}

/** 공유 결과 — 호출부가 안내 문구를 고르는 데 쓴다. */
export type ShareResult = "kakao" | "shared" | "copied" | "failed";

export function useKakaoShare(): {
  share: (place: Place, ctx: ShareContext) => Promise<ShareResult>;
} {
  const busyRef = useRef(false); // 진행 중 중복 클릭 무시

  const share = useCallback(
    async (place: Place, ctx: ShareContext): Promise<ShareResult> => {
      if (busyRef.current) return "failed";
      busyRef.current = true;
      try {
        // 1) 카카오 피드 카드(기본 경로)
        const key = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY;
        if (key) {
          const ok = await loadSdk();
          if (ok && window.Kakao) {
            try {
              if (!window.Kakao.isInitialized()) window.Kakao.init(key);
              window.Kakao.Share.sendDefault(buildShareFeed(place, ctx));
              return "kakao";
            } catch {
              // 도메인 미등록·SDK 오류 → 폴백으로
            }
          }
        }
        // 2) Web Share(모바일 공유시트 — 카톡 포함). 취소/실패는 조용히 종료.
        const text = shareText(place, ctx.appUrl);
        if (typeof navigator !== "undefined" && navigator.share) {
          try {
            await navigator.share({ text });
            return "shared";
          } catch {
            return "failed"; // 사용자가 시트를 닫음 등 — 클립보드로 덮어쓰지 않음
          }
        }
        // 3) 클립보드 복사(데스크톱 폴백)
        if (
          typeof navigator !== "undefined" &&
          navigator.clipboard?.writeText
        ) {
          try {
            await navigator.clipboard.writeText(text);
            return "copied";
          } catch {
            return "failed";
          }
        }
        return "failed";
      } finally {
        busyRef.current = false;
      }
    },
    [],
  );

  return { share };
}

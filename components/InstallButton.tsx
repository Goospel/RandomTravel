"use client";

// 📲 PWA 설치 유도 버튼(M9 보강). 순수 판정은 lib/pwaInstall,
// 여기선 브라우저 이벤트(beforeinstallprompt·appinstalled) 배선만 한다.
// - 안드로이드/데스크톱 Chromium: 캡처한 프롬프트로 네이티브 설치 창을 띄운다.
// - iOS Safari: 프롬프트 이벤트가 없어 "공유 → 홈 화면에 추가"를 팝오버로 안내.
// - 이미 설치(standalone)면 렌더하지 않는다.

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { installMode, isIOS } from "@/lib/pwaInstall";

// beforeinstallprompt 는 표준 lib.dom 타입에 없어 최소 형태만 선언한다.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// 브라우저 환경값(standalone·iOS)은 외부 시스템 상태 → useSyncExternalStore 로 구독한다.
// (effect 안 동기 setState 를 피하고 SSR 도 안전: 서버 스냅샷은 false.)
const STANDALONE_QUERY = "(display-mode: standalone)";

// 이미 홈 화면 앱(standalone)으로 실행 중인가 — Chromium: display-mode, iOS: navigator.standalone.
function subscribeStandalone(onChange: () => void) {
  const mq = window.matchMedia(STANDALONE_QUERY);
  mq.addEventListener("change", onChange);
  window.addEventListener("appinstalled", onChange);
  return () => {
    mq.removeEventListener("change", onChange);
    window.removeEventListener("appinstalled", onChange);
  };
}
function getStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia?.(STANDALONE_QUERY).matches === true ||
    nav.standalone === true
  );
}

// iOS 판정은 마운트 후 바뀌지 않는 고정값 → 구독은 no-op, 스냅샷만 읽는다.
const noopSubscribe = () => () => {};
function getIsIOS(): boolean {
  return isIOS(navigator.userAgent, {
    platform: navigator.platform,
    maxTouchPoints: navigator.maxTouchPoints,
  });
}

export function InstallButton() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  );
  const [guideOpen, setGuideOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const standalone = useSyncExternalStore(
    subscribeStandalone,
    getStandalone,
    () => false, // SSR/최초 렌더: 설치 안 된 것으로 간주
  );
  const ios = useSyncExternalStore(noopSubscribe, getIsIOS, () => false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault(); // 브라우저 기본 미니인포바 억제 — 우리 버튼으로 유도
      setDeferred(e as BeforeInstallPromptEvent);
    };
    // 설치되면 프롬프트가 소멸 → deferred 를 비우면 버튼이 자연히 사라진다.
    const onInstalled = () => setDeferred(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  // 안내 팝오버가 열렸을 때만 바깥 클릭으로 닫는다(리스너는 열림 동안만 산다).
  useEffect(() => {
    if (!guideOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setGuideOpen(false);
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [guideOpen]);

  const mode = installMode({
    standalone,
    hasPrompt: deferred !== null,
    isIOS: ios,
  });
  if (mode === "hidden") return null;

  async function handleClick() {
    if (mode === "ios-guide") {
      setGuideOpen((v) => !v);
      return;
    }
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice; // 수락/거절 무관 — 프롬프트 이벤트는 1회용이라 비운다
    setDeferred(null);
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={handleClick}
        aria-label="이 앱을 홈 화면에 설치"
        aria-expanded={mode === "ios-guide" ? guideOpen : undefined}
        className="rounded-full border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-600 transition-colors hover:border-emerald-300 hover:text-emerald-600 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-emerald-700 dark:hover:text-emerald-400"
      >
        📲 앱 설치
      </button>

      {mode === "ios-guide" && guideOpen && (
        <div
          role="dialog"
          aria-label="홈 화면에 추가하는 방법"
          className="absolute right-0 top-full z-20 mt-2 w-60 rounded-2xl border border-zinc-200 bg-white p-3.5 text-left text-xs leading-relaxed text-zinc-600 shadow-lg dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
        >
          <p className="font-semibold text-zinc-800 dark:text-zinc-100">
            홈 화면에 추가하기
          </p>
          <p className="mt-1.5">
            사파리 하단의 <ShareIcon /> <b>공유</b> 버튼을 누른 뒤{" "}
            <b>‘홈 화면에 추가’</b>를 선택하면 앱처럼 쓸 수 있어요.
          </p>
        </div>
      )}
    </div>
  );
}

// iOS 공유 아이콘(네모 상자 + 위로 향한 화살표) — 인라인 SVG.
function ShareIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className="mx-0.5 inline-block h-3.5 w-3.5 -translate-y-px align-middle"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3v12" />
      <path d="M8 7l4-4 4 4" />
      <path d="M6 12v7a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-7" />
    </svg>
  );
}

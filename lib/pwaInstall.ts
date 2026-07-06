// 📲 PWA 설치 유도(M9 보강)의 순수 로직 — DOM·이벤트 없이 단위 테스트 가능.
// 브라우저 배선(beforeinstallprompt 캡처·prompt 호출·리스너)은 components/InstallButton.

/** 설치 버튼의 표시 상태. hidden 이면 버튼을 그리지 않는다. */
export type InstallMode = "hidden" | "installable" | "ios-guide";

/** installMode 판정에 필요한 환경 신호(컴포넌트가 브라우저에서 수집해 넘긴다). */
export interface InstallEnv {
  /** 이미 설치돼 standalone(홈 화면 앱)으로 실행 중 → 버튼 불필요 */
  standalone: boolean;
  /** beforeinstallprompt 이벤트를 캡처해 대기 중(안드로이드/데스크톱 Chromium) */
  hasPrompt: boolean;
  /** iOS(Safari) — beforeinstallprompt 미지원이라 수동 안내가 필요 */
  isIOS: boolean;
}

/**
 * 환경 신호로 설치 버튼의 표시 상태를 정한다.
 * 우선순위: 이미 설치 > 네이티브 프롬프트 > iOS 수동 안내 > 숨김.
 */
export function installMode(env: InstallEnv): InstallMode {
  if (env.standalone) return "hidden"; // 이미 설치됨 — 유도 불필요(최우선)
  if (env.hasPrompt) return "installable"; // 네이티브 설치 창을 띄울 수 있음
  if (env.isIOS) return "ios-guide"; // iOS Safari — 공유→홈 화면 추가 안내
  return "hidden"; // 그 외: 미지원이거나 아직 프롬프트 이벤트 전
}

/**
 * UA(+플랫폼 신호)로 iOS 기기인지 판정.
 * iPadOS 13+ 는 데스크톱 Safari(Macintosh) UA 로 위장하므로,
 * 플랫폼이 MacIntel 이고 멀티터치가 있으면 iPad 로 간주한다.
 */
export function isIOS(
  ua: string,
  opts: { platform?: string; maxTouchPoints?: number } = {},
): boolean {
  if (/iP(hone|ad|od)/i.test(ua)) return true;
  if (opts.platform === "MacIntel" && (opts.maxTouchPoints ?? 0) > 1) {
    return true;
  }
  return false;
}

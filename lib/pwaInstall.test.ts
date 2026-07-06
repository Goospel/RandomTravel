import { describe, it, expect } from "vitest";
import { installMode, isIOS, type InstallEnv } from "@/lib/pwaInstall";

// 📲 PWA 설치 유도(M9 보강)의 순수 로직 테스트.
// installMode: 환경 신호 → 버튼 표시 상태. isIOS: UA/플랫폼 → iOS 판정.

// installMode 케이스를 짧게 쓰기 위한 헬퍼 — 기본값 위에 관심 필드만 덮어쓴다.
function env(over: Partial<InstallEnv>): InstallEnv {
  return { standalone: false, hasPrompt: false, isIOS: false, ...over };
}

describe("installMode", () => {
  it("이미 설치(standalone)면 버튼을 숨긴다", () => {
    expect(installMode(env({ standalone: true }))).toBe("hidden");
  });

  it("standalone 은 최우선 — 프롬프트/ iOS 가 함께 있어도 숨긴다", () => {
    expect(
      installMode(env({ standalone: true, hasPrompt: true, isIOS: true })),
    ).toBe("hidden");
  });

  it("프롬프트를 캡처했으면 네이티브 설치(installable)", () => {
    expect(installMode(env({ hasPrompt: true }))).toBe("installable");
  });

  it("프롬프트가 있으면 iOS 여도 네이티브 설치를 우선한다", () => {
    expect(installMode(env({ hasPrompt: true, isIOS: true }))).toBe(
      "installable",
    );
  });

  it("프롬프트가 없고 iOS 면 수동 안내(ios-guide)", () => {
    expect(installMode(env({ isIOS: true }))).toBe("ios-guide");
  });

  it("설치 불가/미지원(아무 신호 없음)이면 숨긴다", () => {
    expect(installMode(env({}))).toBe("hidden");
  });
});

describe("isIOS", () => {
  const IPHONE =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
  const IPAD_OLD =
    "Mozilla/5.0 (iPad; CPU OS 12_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.0 Mobile/15E148 Safari/604.1";
  const IPOD =
    "Mozilla/5.0 (iPod touch; CPU iPhone OS 12_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148";
  // iPadOS 13+ 는 데스크톱 Safari(Macintosh) UA 로 위장한다.
  const MAC_UA =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";
  const ANDROID =
    "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36";
  const WINDOWS =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36";

  it("iPhone UA 는 iOS", () => {
    expect(isIOS(IPHONE)).toBe(true);
  });

  it("구형 iPad UA 는 iOS", () => {
    expect(isIOS(IPAD_OLD)).toBe(true);
  });

  it("iPod touch UA 는 iOS", () => {
    expect(isIOS(IPOD)).toBe(true);
  });

  it("iPadOS 13+ 데스크톱 위장(MacIntel + 멀티터치)은 iOS 로 본다", () => {
    expect(isIOS(MAC_UA, { platform: "MacIntel", maxTouchPoints: 5 })).toBe(
      true,
    );
  });

  it("진짜 맥 데스크톱(터치 없음)은 iOS 아님", () => {
    expect(isIOS(MAC_UA, { platform: "MacIntel", maxTouchPoints: 0 })).toBe(
      false,
    );
  });

  it("안드로이드 Chrome 은 iOS 아님", () => {
    expect(isIOS(ANDROID, { platform: "Linux armv8l", maxTouchPoints: 5 })).toBe(
      false,
    );
  });

  it("윈도우 데스크톱은 iOS 아님", () => {
    expect(isIOS(WINDOWS, { platform: "Win32", maxTouchPoints: 0 })).toBe(false);
  });
});

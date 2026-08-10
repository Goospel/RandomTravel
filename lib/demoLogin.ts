// 🎫 심사용 데모 로그인(§14.1 테스트 계정) — 서비스 로그인은 구글·카카오 OAuth 뿐이라
// 제출용으로 넘길 ID/PW 가 없다. 앱스토어 심사용 데모 계정과 같은 관례로 Credentials
// 프로바이더를 하나 더 두되, **두 env 가 모두 있을 때만** 켠다(auth.ts 의 OAuth 게이트 패턴).
//
// ⚠️ 서버 전용 — node:crypto 를 들이므로 클라이언트 컴포넌트에서 import 하지 않는다.
//    (/demo-login 폼은 next-auth/react 의 signIn 만 쓰고 이 모듈을 보지 않는다.)

import { timingSafeEqual } from "node:crypto";

/** 데모 계정의 user.id — env 가 아니라 코드 상수다(시드 스크립트와 공유해야 하므로). */
export const DEMO_USER_ID = "379a330b-5466-4a61-8e7d-69ec5ed00f41";

/** 로그인 성공 시 세션에 실리는 고정 신원. 이메일은 실제로 닿지 않는 예약 도메인. */
export const DEMO_USER = {
  id: DEMO_USER_ID,
  name: "심사용 계정",
  email: "demo@travelanywhere.local",
} as const;

export interface DemoEnv {
  DEMO_LOGIN_ID?: string;
  DEMO_LOGIN_PASSWORD?: string;
  // 인덱스 시그니처가 있어야 process.env(ProcessEnv)를 그대로 넘길 수 있다 —
  //   없으면 "공통 속성 없음"(TS2559 weak type)으로 거부된다.
  [key: string]: string | undefined;
}

/** 데모 로그인을 켤지 — 두 env 가 모두 비어 있지 않을 때만. 비우는 게 곧 끄는 방법. */
export function demoLoginEnabled(env: DemoEnv): boolean {
  return Boolean(env.DEMO_LOGIN_ID && env.DEMO_LOGIN_PASSWORD);
}

/** utf8 바이트 길이가 같을 때만 timingSafeEqual — 길이 누출은 데모 계정 수준에서 수용한다. */
function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/**
 * 입력 자격이 env 값과 일치하는지. env 가 꺼져 있으면 입력과 무관하게 false —
 * "빈 env + 빈 입력"이 우연히 통과하는 구멍을 막는다.
 */
export function checkDemoCredentials(
  input: { id?: unknown; password?: unknown },
  env: DemoEnv,
): boolean {
  if (!demoLoginEnabled(env)) return false;
  const { id, password } = input;
  if (typeof id !== "string" || typeof password !== "string") return false;
  // id 는 비밀이 아니라 평범한 비교, 비밀번호만 타이밍세이프.
  return id === env.DEMO_LOGIN_ID && safeEqual(password, env.DEMO_LOGIN_PASSWORD!);
}

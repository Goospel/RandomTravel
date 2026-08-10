import { describe, it, expect } from "vitest";
import {
  DEMO_USER,
  DEMO_USER_ID,
  demoLoginEnabled,
  checkDemoCredentials,
} from "@/lib/demoLogin";

const ENV = { DEMO_LOGIN_ID: "reviewer", DEMO_LOGIN_PASSWORD: "s3cret-password" };

describe("demoLoginEnabled — 두 env 가 모두 있을 때만 켜진다", () => {
  it("둘 다 있으면 true", () => {
    expect(demoLoginEnabled(ENV)).toBe(true);
  });

  it("한쪽만 있으면 false", () => {
    expect(demoLoginEnabled({ DEMO_LOGIN_ID: "reviewer" })).toBe(false);
    expect(demoLoginEnabled({ DEMO_LOGIN_PASSWORD: "pw" })).toBe(false);
  });

  it("둘 다 없으면 false", () => {
    expect(demoLoginEnabled({})).toBe(false);
  });

  it("빈 문자열은 '없음'으로 본다 — env 를 비워 두는 게 곧 끄는 방법", () => {
    expect(demoLoginEnabled({ DEMO_LOGIN_ID: "", DEMO_LOGIN_PASSWORD: "pw" })).toBe(false);
    expect(demoLoginEnabled({ DEMO_LOGIN_ID: "reviewer", DEMO_LOGIN_PASSWORD: "" })).toBe(
      false,
    );
  });
});

describe("checkDemoCredentials — 자격 비교", () => {
  it("id·비밀번호가 모두 맞으면 true", () => {
    expect(checkDemoCredentials({ id: "reviewer", password: "s3cret-password" }, ENV)).toBe(
      true,
    );
  });

  it("비밀번호가 틀리면 false (같은 길이)", () => {
    expect(checkDemoCredentials({ id: "reviewer", password: "s3cret-passworD" }, ENV)).toBe(
      false,
    );
  });

  it("비밀번호 길이가 다르면 false — 길이 불일치에서 즉시 탈락", () => {
    expect(checkDemoCredentials({ id: "reviewer", password: "s3cret" }, ENV)).toBe(false);
    expect(
      checkDemoCredentials({ id: "reviewer", password: "s3cret-password-more" }, ENV),
    ).toBe(false);
  });

  it("id 가 틀리면 false", () => {
    expect(checkDemoCredentials({ id: "judge", password: "s3cret-password" }, ENV)).toBe(
      false,
    );
  });

  it("빈 입력은 false — env 가 비어 있어도 '빈 값으로 로그인'이 되면 안 된다", () => {
    expect(checkDemoCredentials({ id: "", password: "" }, ENV)).toBe(false);
    expect(checkDemoCredentials({ id: "", password: "" }, {})).toBe(false);
  });

  it("env 가 꺼져 있으면 무엇을 넣어도 false", () => {
    expect(
      checkDemoCredentials({ id: "reviewer", password: "s3cret-password" }, {
        DEMO_LOGIN_ID: "reviewer",
      }),
    ).toBe(false);
  });

  it("문자열이 아닌 입력은 false (폼 대신 JSON 을 직접 던지는 경우)", () => {
    expect(checkDemoCredentials({ id: undefined, password: "s3cret-password" }, ENV)).toBe(
      false,
    );
    expect(checkDemoCredentials({ id: "reviewer", password: null }, ENV)).toBe(false);
    expect(checkDemoCredentials({ id: ["reviewer"], password: "s3cret-password" }, ENV)).toBe(
      false,
    );
  });

  it("유니코드 비밀번호도 정확히 비교한다 — 바이트 길이가 아니라 값이 기준", () => {
    const uni = { DEMO_LOGIN_ID: "심사원", DEMO_LOGIN_PASSWORD: "비밀번호🔑" };
    expect(checkDemoCredentials({ id: "심사원", password: "비밀번호🔑" }, uni)).toBe(true);
    expect(checkDemoCredentials({ id: "심사원", password: "비밀번호🔒" }, uni)).toBe(false);
    // 같은 문자 수라도 바이트 길이가 다른 조합(ASCII 5자 vs 한글 5자)에서 던지지 않고 false.
    expect(checkDemoCredentials({ id: "심사원", password: "abcde" }, uni)).toBe(false);
  });
});

describe("DEMO_USER — 고정 신원", () => {
  it("id 는 코드에 박힌 UUID 상수(시드 스크립트와 공유)", () => {
    expect(DEMO_USER.id).toBe(DEMO_USER_ID);
    expect(DEMO_USER_ID).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it("표시 이름·이메일이 고정돼 있다", () => {
    expect(DEMO_USER.name).toBe("심사용 계정");
    expect(DEMO_USER.email).toBe("demo@travelanywhere.local");
  });
});

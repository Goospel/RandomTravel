import { describe, it, expect } from "vitest";
import { retryOnce, isTimeout, API_TIMEOUT_MS } from "@/lib/apiFetch";

/** 호출 횟수를 세는 가짜 작업 — 네트워크 목이 아니라 순수 함수 주입(테스트 방침 유지). */
function counted<T>(results: (() => T)[]) {
  let calls = 0;
  const fn = async () => {
    const r = results[calls] ?? results[results.length - 1];
    calls++;
    return r();
  };
  return { fn, calls: () => calls };
}

const ok = (v: string) => () => v;
const boom = (msg: string) => (): string => {
  throw new Error(msg);
};

describe("retryOnce — 1회 재시도 정책 (§6.5)", () => {
  it("첫 시도가 성공하면 그 값을 반환하고 재시도하지 않는다", async () => {
    const { fn, calls } = counted([ok("첫판")]);
    await expect(retryOnce(fn)).resolves.toBe("첫판");
    expect(calls()).toBe(1); // 성공인데 2회 호출하면 쿼터 낭비(§5.6)
  });

  it("첫 시도가 실패하면 1회 재시도해 그 값을 반환한다", async () => {
    const { fn, calls } = counted([boom("일시 장애"), ok("둘째판")]);
    await expect(retryOnce(fn)).resolves.toBe("둘째판");
    expect(calls()).toBe(2);
  });

  it("둘 다 실패하면 두 번째 오류를 던지고 3회째는 시도하지 않는다", async () => {
    const { fn, calls } = counted([boom("1차"), boom("2차"), ok("있으면 안 됨")]);
    await expect(retryOnce(fn)).rejects.toThrow("2차");
    expect(calls()).toBe(2); // 무한 재시도 방지
  });

  it("시도마다 fn 을 새로 호출한다 — 결과 재사용 금지(타임아웃 signal 은 시도별로 새로 만들어야 함)", async () => {
    const seen: number[] = [];
    let n = 0;
    const fn = async () => {
      const id = ++n;
      seen.push(id);
      if (id === 1) throw new Error("첫판 실패");
      return id;
    };
    await expect(retryOnce(fn)).resolves.toBe(2);
    expect(seen).toEqual([1, 2]); // 같은 Promise 를 재사용했다면 [1] 뿐이다
  });
});

describe("retryOnce — 재시도 여부 판정 주입", () => {
  it("shouldRetry 가 false 를 주면 재시도하지 않고 첫 오류를 그대로 던진다", async () => {
    const { fn, calls } = counted([boom("1차"), ok("있으면 안 됨")]);
    await expect(retryOnce(fn, () => false)).rejects.toThrow("1차");
    expect(calls()).toBe(1);
  });

  it("shouldRetry 에 실제 오류 객체가 전달된다", async () => {
    const { fn } = counted([boom("판정용"), ok("두번째")]);
    const seen: unknown[] = [];
    await retryOnce(fn, (e) => {
      seen.push(e);
      return true;
    });
    expect((seen[0] as Error).message).toBe("판정용");
  });

  it("기본값은 재시도한다(판정 미주입 = 기존 동작)", async () => {
    const { fn, calls } = counted([boom("1차"), ok("둘째판")]);
    await expect(retryOnce(fn)).resolves.toBe("둘째판");
    expect(calls()).toBe(2);
  });
});

describe("isTimeout — 느린 상류는 재시도해도 또 기다린다(꼬리 2배 방지)", () => {
  it("AbortSignal.timeout 이 던지는 TimeoutError 를 알아본다", () => {
    const e = new DOMException("aborted due to timeout", "TimeoutError");
    expect(isTimeout(e)).toBe(true);
  });

  it("연결 실패·기타 오류는 재시도 대상이라 false", () => {
    expect(isTimeout(new Error("ECONNRESET"))).toBe(false);
    expect(isTimeout(new DOMException("aborted", "AbortError"))).toBe(false);
    expect(isTimeout(null)).toBe(false);
    expect(isTimeout("TimeoutError")).toBe(false); // 문자열은 오류가 아니다
  });
});

describe("API_TIMEOUT_MS", () => {
  it("plan §6.5 확정값 8초", () => {
    expect(API_TIMEOUT_MS).toBe(8000);
  });
});

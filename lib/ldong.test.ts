import { describe, it, expect } from "vitest";
import { ldongToAreaCode } from "@/lib/ldong";

describe("ldongToAreaCode — 법정동 코드 → 앱 areaCode (§6.9A 공용 헬퍼)", () => {
  it("일반 시·도 코드를 그대로 변환", () => {
    expect(ldongToAreaCode("11")).toBe(1); // 서울
    expect(ldongToAreaCode("41")).toBe(31); // 경기
    expect(ldongToAreaCode("50")).toBe(39); // 제주
  });

  it("행정구역 개편 신코드 — 51 강원 · 52 전북", () => {
    expect(ldongToAreaCode("51")).toBe(32);
    expect(ldongToAreaCode("52")).toBe(37);
  });

  it("폐지 구코드도 계속 변환한다(과거 데이터 방어)", () => {
    expect(ldongToAreaCode("29")).toBe(5); // 구 광주
    expect(ldongToAreaCode("42")).toBe(32); // 구 강원
    expect(ldongToAreaCode("45")).toBe(37); // 구 전북
    expect(ldongToAreaCode("46")).toBe(38); // 구 전남
  });

  it("전남광주 통합 12 — 광주권 5개 구는 광주(5), 그 외는 전남(38)", () => {
    expect(ldongToAreaCode("12", "210")).toBe(5);
    expect(ldongToAreaCode("12", "330")).toBe(5);
    expect(ldongToAreaCode("12", "850")).toBe(38); // 완도군
    expect(ldongToAreaCode("12", "710")).toBe(38);
  });

  it("12인데 시군구 코드가 없으면 가를 수 없어 null(호출부 폴백)", () => {
    expect(ldongToAreaCode("12")).toBeNull();
  });

  it("세종 특례 — 시도 코드가 5자리 36110 (실측 2026-07-27)", () => {
    expect(ldongToAreaCode("36110")).toBe(8);
    expect(ldongToAreaCode("36110", "36110")).toBe(8);
  });

  it("미지·빈 코드는 null", () => {
    expect(ldongToAreaCode("99")).toBeNull();
    expect(ldongToAreaCode("")).toBeNull();
    expect(ldongToAreaCode(undefined)).toBeNull();
  });
});

import { describe, it, expect } from "vitest";
import {
  parseAreaCodes,
  parseContentTypeIds,
  buildRandomQuery,
} from "@/lib/query";

describe("parseAreaCodes — 화이트리스트·정수·양수·중복제거", () => {
  it("유효 지역 코드만 통과", () => {
    expect(parseAreaCodes("32,39")).toEqual([32, 39]);
  });
  it("존재하지 않는 코드 제거", () => {
    expect(parseAreaCodes("999")).toEqual([]);
    expect(parseAreaCodes("32,999,39")).toEqual([32, 39]);
  });
  it("음수·소수·비숫자 제거", () => {
    expect(parseAreaCodes("-5,3.5,abc,32")).toEqual([32]);
  });
  it("중복 제거(첫 등장 순서 유지)", () => {
    expect(parseAreaCodes("32,32,39,32")).toEqual([32, 39]);
  });
  it("공백 허용", () => {
    expect(parseAreaCodes(" 32 , 39 ")).toEqual([32, 39]);
  });
  it("빈 입력·null → 빈 배열", () => {
    expect(parseAreaCodes(null)).toEqual([]);
    expect(parseAreaCodes("")).toEqual([]);
    expect(parseAreaCodes(" , ,")).toEqual([]);
  });
});

describe("parseContentTypeIds — 타입 코드 화이트리스트", () => {
  it("유효 타입 코드만 통과", () => {
    expect(parseContentTypeIds("39,12")).toEqual([39, 12]);
  });
  it("존재하지 않는 타입 제거", () => {
    expect(parseContentTypeIds("99")).toEqual([]);
    expect(parseContentTypeIds("39,99,12")).toEqual([39, 12]);
  });
});

describe("buildRandomQuery — '조건 0개 = 완전 랜덤' 불변식(§2)", () => {
  it("순수 모드는 선택이 있어도 항상 파라미터 없음", () => {
    expect(buildRandomQuery("pure", new Set([32]), new Set([39]))).toBe("");
  });
  it("조건 모드 + 선택 0개 = 파라미터 없음(= 완전 랜덤)", () => {
    expect(buildRandomQuery("filtered", new Set(), new Set())).toBe("");
  });
  it("조건 모드 + 선택 있음 = 해당 파라미터", () => {
    const p = new URLSearchParams(
      buildRandomQuery("filtered", new Set([32, 39]), new Set([39])),
    );
    expect(p.get("areas")).toBe("32,39");
    expect(p.get("types")).toBe("39");
  });
  it("한쪽만 선택하면 그쪽 파라미터만", () => {
    const p = new URLSearchParams(
      buildRandomQuery("filtered", new Set([1]), new Set()),
    );
    expect(p.get("areas")).toBe("1");
    expect(p.has("types")).toBe(false);
  });
  it("왕복: build → parse 가 선택을 그대로 보존", () => {
    const p = new URLSearchParams(
      buildRandomQuery("filtered", new Set([32, 39]), new Set([39])),
    );
    expect(parseAreaCodes(p.get("areas"))).toEqual([32, 39]);
    expect(parseContentTypeIds(p.get("types"))).toEqual([39]);
  });
});

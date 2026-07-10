import { describe, it, expect } from "vitest";
import {
  parseAreaCodes,
  parseContentTypeIds,
  parseBool,
  buildRandomQuery,
  parseLatLng,
  buildNearbyQuery,
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

describe("parseBool — 추가 조건 플래그(🌊 바다·🦀 제철)", () => {
  it("1·true·yes·on 은 true(대소문자·공백 무시)", () => {
    for (const v of ["1", "true", "TRUE", " yes ", "on"]) {
      expect(parseBool(v)).toBe(true);
    }
  });
  it("0·false·빈값·null 은 false", () => {
    for (const v of ["0", "false", "", "aaa"]) expect(parseBool(v)).toBe(false);
    expect(parseBool(null)).toBe(false);
  });
});

describe("buildRandomQuery — 🌊 바다·🦀 제철 옵션", () => {
  it("seaside/seasonal 을 켜면 seaside=1·seasonal=1 파라미터", () => {
    const p = new URLSearchParams(
      buildRandomQuery("filtered", new Set(), new Set(), {
        seaside: true,
        seasonal: true,
      }),
    );
    expect(p.get("seaside")).toBe("1");
    expect(p.get("seasonal")).toBe("1");
  });
  it("추가 조건만 켜도 완전 랜덤이 아님(파라미터 존재)", () => {
    // 지역·테마 0개여도 바다/제철 자체가 '조건'이라 빈 문자열이 아니다
    expect(
      buildRandomQuery("filtered", new Set(), new Set(), { seaside: true }),
    ).toBe("seaside=1");
  });
  it("끈 옵션은 파라미터에 넣지 않는다", () => {
    const p = new URLSearchParams(
      buildRandomQuery("filtered", new Set([1]), new Set(), { seasonal: true }),
    );
    expect(p.has("seaside")).toBe(false);
    expect(p.get("seasonal")).toBe("1");
    expect(p.get("areas")).toBe("1");
  });
  it("바다 ON이면 선택된 테마를 URL에 싣지 않는다(서버가 관광지12로 고정·무시)", () => {
    const p = new URLSearchParams(
      buildRandomQuery("filtered", new Set([32]), new Set([39, 32]), {
        seaside: true,
      }),
    );
    expect(p.has("types")).toBe(false); // 테마 생략
    expect(p.get("areas")).toBe("32"); // 지역은 유지(바다도 지역 사용)
    expect(p.get("seaside")).toBe("1");
  });
  it("바다 OFF면 테마를 정상 전송(회귀)", () => {
    const p = new URLSearchParams(
      buildRandomQuery("filtered", new Set(), new Set([39]), {
        seasonal: true,
      }),
    );
    expect(p.get("types")).toBe("39");
  });
  it("순수 모드는 추가 조건이 켜져도 항상 빈 문자열", () => {
    expect(
      buildRandomQuery("pure", new Set(), new Set(), {
        seaside: true,
        seasonal: true,
        festival: true,
        noRain: true,
        quiet: true,
      }),
    ).toBe("");
  });
  it("🎪 축제는 festivalOnly=1 파라미터", () => {
    const p = new URLSearchParams(
      buildRandomQuery("filtered", new Set(), new Set(), { festival: true }),
    );
    expect(p.get("festivalOnly")).toBe("1");
  });
  it("☔ 날씨는 noRain=1 파라미터", () => {
    const p = new URLSearchParams(
      buildRandomQuery("filtered", new Set(), new Set(), { noRain: true }),
    );
    expect(p.get("noRain")).toBe("1");
  });
  it("☔ 는 지역과 조합 가능(지역+noRain 둘 다 실림)", () => {
    const p = new URLSearchParams(
      buildRandomQuery("filtered", new Set([32]), new Set(), { noRain: true }),
    );
    expect(p.get("areas")).toBe("32");
    expect(p.get("noRain")).toBe("1");
  });
  it("🍃 한적은 quiet=1 파라미터", () => {
    const p = new URLSearchParams(
      buildRandomQuery("filtered", new Set(), new Set(), { quiet: true }),
    );
    expect(p.get("quiet")).toBe("1");
  });
  it("🍃 만 켜도 완전 랜덤 아님(quiet=1)", () => {
    expect(
      buildRandomQuery("filtered", new Set(), new Set(), { quiet: true }),
    ).toBe("quiet=1");
  });
  it("🍃 는 지역과 조합 가능(지역+quiet 둘 다 실림)", () => {
    const p = new URLSearchParams(
      buildRandomQuery("filtered", new Set([32]), new Set(), { quiet: true }),
    );
    expect(p.get("areas")).toBe("32");
    expect(p.get("quiet")).toBe("1");
  });
  it("quiet 미지정이면 quiet 파라미터 없음(불변식)", () => {
    const p = new URLSearchParams(
      buildRandomQuery("filtered", new Set([1]), new Set()),
    );
    expect(p.has("quiet")).toBe(false);
  });
});

describe("parseLatLng — 📍 주변에서 뽑기 앵커 좌표 파싱(M14)", () => {
  it("정상 '위도,경도'", () => {
    expect(parseLatLng("37.5665,126.978")).toEqual({
      lat: 37.5665,
      lng: 126.978,
    });
  });
  it("공백 허용", () => {
    expect(parseLatLng(" 33.489 , 126.4983 ")).toEqual({
      lat: 33.489,
      lng: 126.4983,
    });
  });
  it("한국 범위 밖(위도/경도) → null", () => {
    expect(parseLatLng("0,0")).toBeNull(); // 원점
    expect(parseLatLng("50,126")).toBeNull(); // 위도 너무 큼
    expect(parseLatLng("37,150")).toBeNull(); // 경도 너무 큼
    expect(parseLatLng("30,126")).toBeNull(); // 위도 너무 작음(제주 남쪽 밖)
  });
  it("비수치·형식 오류 → null", () => {
    expect(parseLatLng("abc,126")).toBeNull();
    expect(parseLatLng("37")).toBeNull(); // 경도 누락
    expect(parseLatLng("37,126,5")).toBeNull(); // 부분 3개
    expect(parseLatLng("Infinity,126")).toBeNull();
  });
  it("빈 입력·null → null", () => {
    expect(parseLatLng(null)).toBeNull();
    expect(parseLatLng("")).toBeNull();
    expect(parseLatLng(" , ")).toBeNull();
  });
});

describe("buildNearbyQuery — near= 좌표 쿼리 조립(M14)", () => {
  it("near=위도,경도", () => {
    expect(buildNearbyQuery(37.5665, 126.978)).toBe("near=37.5665%2C126.978");
  });
  it("왕복: build → parse 가 좌표를 보존", () => {
    const p = new URLSearchParams(buildNearbyQuery(35.1796, 129.0756));
    expect(parseLatLng(p.get("near"))).toEqual({ lat: 35.1796, lng: 129.0756 });
  });
});

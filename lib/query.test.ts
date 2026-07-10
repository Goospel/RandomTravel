import { describe, it, expect } from "vitest";
import {
  parseAreaCodes,
  parseContentTypeIds,
  parseBool,
  buildRandomQuery,
  parseLatLng,
  buildNearbyQuery,
  parseDateYmd,
  parseContentIds,
  buildCourseQuery,
  buildEmptySpotQuery,
  parseSigunguCodes,
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

// ─── 📅 방문 시점 칩(M19, §6.8) ─────────────────────────────────────
describe("parseDateYmd — 8자리·실존·범위(오늘 ≤ date ≤ 오늘+29)", () => {
  const NOW = new Date("2026-07-10T03:00:00Z"); // KST 7/10 정오
  it("오늘·오늘+29 경계는 통과", () => {
    expect(parseDateYmd("20260710", NOW)).toBe("20260710"); // 오늘
    expect(parseDateYmd("20260808", NOW)).toBe("20260808"); // 오늘+29
    expect(parseDateYmd(" 20260712 ", NOW)).toBe("20260712"); // 공백 허용
  });
  it("범위 밖(어제·오늘+30)은 null(무시)", () => {
    expect(parseDateYmd("20260709", NOW)).toBeNull(); // 어제
    expect(parseDateYmd("20260809", NOW)).toBeNull(); // 오늘+30
  });
  it("형식·실존 위반은 null", () => {
    expect(parseDateYmd("2026071", NOW)).toBeNull(); // 7자리
    expect(parseDateYmd("2026-07-12", NOW)).toBeNull(); // 하이픈
    expect(parseDateYmd("20260230", NOW)).toBeNull(); // 2월 30일(실존 아님)
    expect(parseDateYmd("abcdefgh", NOW)).toBeNull();
  });
  it("null·빈값은 null", () => {
    expect(parseDateYmd(null, NOW)).toBeNull();
    expect(parseDateYmd("", NOW)).toBeNull();
  });
});

// ─── 🧭 반나절 코스(M20, §7.10) ─────────────────────────────────────
describe("parseContentIds — 코스 exclude(contentId 숫자 문자열·중복제거·상한)", () => {
  it("숫자 문자열만 통과(순서 유지)", () => {
    expect(parseContentIds("126508,2733967")).toEqual(["126508", "2733967"]);
  });
  it("공백 허용", () => {
    expect(parseContentIds(" 126508 , 2733967 ")).toEqual(["126508", "2733967"]);
  });
  it("숫자 아닌 토큰 제거(음수·소수·문자·빈칸)", () => {
    expect(parseContentIds("-5,3.5,abc,126508")).toEqual(["126508"]);
    expect(parseContentIds("12a,34")).toEqual(["34"]);
  });
  it("중복 제거(첫 등장 순서)", () => {
    expect(parseContentIds("12,12,34,12")).toEqual(["12", "34"]);
  });
  it("상한 초과분은 자름(기본 12)", () => {
    const raw = Array.from({ length: 20 }, (_, i) => String(i + 1)).join(",");
    expect(parseContentIds(raw)).toHaveLength(12);
    expect(parseContentIds("1,2,3,4,5", 2)).toEqual(["1", "2"]);
  });
  it("null·빈값 → 빈 배열", () => {
    expect(parseContentIds(null)).toEqual([]);
    expect(parseContentIds("")).toEqual([]);
    expect(parseContentIds(" , ,")).toEqual([]);
  });
});

describe("buildCourseQuery — near 필수 + slot/exclude/date(미래만)", () => {
  const LAT = 37.5665;
  const LNG = 126.978;
  const TODAY = "20260710";
  it("near 는 항상 실린다(좌표만)", () => {
    const p = new URLSearchParams(buildCourseQuery(LAT, LNG));
    expect(p.get("near")).toBe("37.5665,126.978");
    expect(p.has("slot")).toBe(false);
    expect(p.has("exclude")).toBe(false);
  });
  it("slot 지정 시 재뽑기 경로(slot 실림)", () => {
    const p = new URLSearchParams(buildCourseQuery(LAT, LNG, { slot: "cafe" }));
    expect(p.get("slot")).toBe("cafe");
  });
  it("exclude 를 콤마로 join", () => {
    const p = new URLSearchParams(
      buildCourseQuery(LAT, LNG, { exclude: ["126508", "2733967"] }),
    );
    expect(p.get("exclude")).toBe("126508,2733967");
  });
  it("exclude 비면 파라미터 없음", () => {
    const p = new URLSearchParams(buildCourseQuery(LAT, LNG, { exclude: [] }));
    expect(p.has("exclude")).toBe(false);
  });
  it("미래 기준일만 date 방출(buildRandomQuery 동형)", () => {
    const future = new URLSearchParams(
      buildCourseQuery(LAT, LNG, { dateYmd: "20260712", todayYmd: TODAY }),
    );
    expect(future.get("date")).toBe("20260712");
    const today = new URLSearchParams(
      buildCourseQuery(LAT, LNG, { dateYmd: TODAY, todayYmd: TODAY }),
    );
    expect(today.has("date")).toBe(false); // 오늘 = 무변 → 생략
    const past = new URLSearchParams(
      buildCourseQuery(LAT, LNG, { dateYmd: "20260709", todayYmd: TODAY }),
    );
    expect(past.has("date")).toBe(false);
  });
  it("왕복: near → parseLatLng, exclude → parseContentIds 보존", () => {
    const p = new URLSearchParams(
      buildCourseQuery(35.1796, 129.0756, { exclude: ["1", "2"] }),
    );
    expect(parseLatLng(p.get("near"))).toEqual({ lat: 35.1796, lng: 129.0756 });
    expect(parseContentIds(p.get("exclude"))).toEqual(["1", "2"]);
  });
});

describe("buildRandomQuery — 📅 date 방출/오늘 생략/date≠오늘 시 noRain 미방출", () => {
  const TODAY = "20260710";
  it("미래 기준일은 date 방출", () => {
    expect(
      buildRandomQuery("filtered", new Set(), new Set(), {
        dateYmd: "20260712",
        todayYmd: TODAY,
      }),
    ).toBe("date=20260712");
  });
  it("오늘 선택은 date 생략(기준일=오늘과 동일 → 파라미터 없음)", () => {
    expect(
      buildRandomQuery("filtered", new Set(), new Set(), {
        dateYmd: TODAY,
        todayYmd: TODAY,
      }),
    ).toBe("");
  });
  it("과거(자정 통과 stale) ymd 도 오늘로 취급 → 생략", () => {
    expect(
      buildRandomQuery("filtered", new Set(), new Set(), {
        dateYmd: "20260709",
        todayYmd: TODAY,
      }),
    ).toBe("");
  });
  it("미래 기준일 + noRain → ☔ 미방출(미래엔 현재 관측 불가)", () => {
    const q = buildRandomQuery("filtered", new Set(), new Set(), {
      noRain: true,
      dateYmd: "20260712",
      todayYmd: TODAY,
    });
    const p = new URLSearchParams(q);
    expect(p.get("date")).toBe("20260712");
    expect(p.has("noRain")).toBe(false); // 잠금 — 전송 안 함
  });
  it("오늘 기준일 + noRain → ☔ 정상 방출(오늘 전용)", () => {
    expect(
      buildRandomQuery("filtered", new Set(), new Set(), {
        noRain: true,
        dateYmd: TODAY,
        todayYmd: TODAY,
      }),
    ).toBe("noRain=1");
  });
  it("date 없이 noRain → 방출(기존 회귀)", () => {
    expect(
      buildRandomQuery("filtered", new Set(), new Set(), {
        noRain: true,
        todayYmd: TODAY,
      }),
    ).toBe("noRain=1");
  });
  it("미래 기준일 + quiet(원격 아님) → date·quiet 둘 다", () => {
    const p = new URLSearchParams(
      buildRandomQuery("filtered", new Set(), new Set(), {
        quiet: true,
        dateYmd: "20260712",
        todayYmd: TODAY,
      }),
    );
    expect(p.get("date")).toBe("20260712");
    expect(p.get("quiet")).toBe("1");
  });
  it("순수 모드는 date 가 있어도 빈 문자열", () => {
    expect(
      buildRandomQuery("pure", new Set(), new Set(), {
        dateYmd: "20260712",
        todayYmd: TODAY,
      }),
    ).toBe("");
  });

  // 🔭 §7.11 회귀 불변식 — buildRandomQuery 에 emptySpot/exclude 가 절대 새지 않는다.
  //   (🔭 버튼은 기본 pure 모드에서 눌리므로 여기 새면 조용히 일반 뽑기로 강등되는 무성 실패.)
  it("buildRandomQuery 출력에 emptySpot·exclude 미포함(회귀 가드)", () => {
    const filtered = buildRandomQuery("filtered", new Set([1]), new Set([12]), {
      quiet: true,
      seaside: true,
    });
    expect(filtered).not.toContain("emptySpot");
    expect(filtered).not.toContain("exclude");
    // pure 모드는 여전히 "" (조건 0개 = 완전 랜덤 불변식)
    expect(buildRandomQuery("pure", new Set([1]), new Set([12]))).toBe("");
  });
});

describe("buildEmptySpotQuery — 🔭 emptySpot=1 + 정렬 exclude CSV(§7.11)", () => {
  it("빈 exclude 면 emptySpot=1 만(방문 0 사용자)", () => {
    expect(buildEmptySpotQuery([])).toBe("emptySpot=1");
  });

  it("exclude 는 정렬 CSV — 입력 순서 무관 동일 출력(쿼리 결정성=캐시 히트)", () => {
    const a = buildEmptySpotQuery(["39", "1", "32010"]);
    const b = buildEmptySpotQuery(["32010", "39", "1"]);
    expect(a).toBe(b);
    const p = new URLSearchParams(a);
    expect(p.get("emptySpot")).toBe("1");
    expect(p.get("exclude")).toBe("1,32010,39"); // 문자열 sort(동일 길이 아님 주의: '1'<'32010'<'39')
  });

  it("Set 입력도 정렬돼 결정적", () => {
    const q = buildEmptySpotQuery(new Set(["11010", "11020", "11005"]));
    expect(new URLSearchParams(q).get("exclude")).toBe("11005,11010,11020");
  });

  it("왕복: build → parseSigunguCodes 가 코드를 보존", () => {
    const valid = new Set(["11010", "11020", "26110"]);
    const q = buildEmptySpotQuery(["26110", "11010"]);
    const parsed = parseSigunguCodes(new URLSearchParams(q).get("exclude"), valid);
    expect(new Set(parsed)).toEqual(new Set(["11010", "26110"]));
  });
});

describe("parseSigunguCodes — 문자열 화이트리스트(통계청 code, §7.11)", () => {
  const valid = new Set(["11010", "11020", "26110", "42750"]);

  it("화이트리스트 안 코드만 통과(밖은 조용히 제거)", () => {
    expect(parseSigunguCodes("11010,99999,26110", valid)).toEqual(["11010", "26110"]);
  });

  it("중복 제거(첫 등장 순서 유지)", () => {
    expect(parseSigunguCodes("26110,11010,26110", valid)).toEqual(["26110", "11010"]);
  });

  it("공백 허용·null/빈 문자열 → []", () => {
    expect(parseSigunguCodes(" 11010 , 26110 ", valid)).toEqual(["11010", "26110"]);
    expect(parseSigunguCodes(null, valid)).toEqual([]);
    expect(parseSigunguCodes("", valid)).toEqual([]);
  });

  it("문자열 축 — 숫자 변환 안 함(선행 0·비정규 숫자 문자열도 화이트리스트 정확 매칭만)", () => {
    // '011010'(선행 0)은 '11010'과 다른 문자열 → 화이트리스트 불일치로 제거.
    expect(parseSigunguCodes("011010", valid)).toEqual([]);
    // 화이트리스트에 없는 순수 숫자도 제거(parseCodeList 처럼 임의 통과 아님).
    expect(parseSigunguCodes("12345", valid)).toEqual([]);
  });
});

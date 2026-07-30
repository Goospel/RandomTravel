import { describe, it, expect } from "vitest";
import { sigunguCenterLatLng, homeRangeSigunguSet } from "@/lib/homeRange";
import { HOME_RANGE_KM } from "@/lib/constants";
import { KOREA_SIGUNGU } from "@/lib/koreaMap";

// 실데이터(지도 조각 250개) 기반 — 좌표는 조각 정점평균의 역투영이라 실제 청사 위치와
// 수 km 오차가 있다. 그래서 하드코딩 값 대조가 아니라 **성질**(포함/제외·단조성)로 검증한다.
const JONGNO = "11010"; // 서울 종로구
const JONGNO_LDONG = "11110"; // 법정동(종로구 전용 — emptySpot.test 와 같은 축)
const SUWON = "31011"; // 수원시장안구 — 서울에서 ~30km
const GANGNEUNG = "32030"; // 강릉시 — 서울에서 ~165km
const BUSAN = "21010"; // 부산 중구 — 서울에서 ~325km
const JEJU = "39010"; // 제주시 — 바다 건너

describe("sigunguCenterLatLng — 지도 조각 중심의 역투영(§7.17B)", () => {
  it("종로구 중심은 서울 근방 좌표", () => {
    const c = sigunguCenterLatLng(JONGNO);
    expect(c).not.toBeNull();
    expect(c!.lat).toBeGreaterThan(37.4);
    expect(c!.lat).toBeLessThan(37.8);
    expect(c!.lng).toBeGreaterThan(126.7);
    expect(c!.lng).toBeLessThan(127.3);
  });

  it("250개 전부 대한민국 범위 안(투영 파라미터 회귀 가드)", () => {
    for (const sg of KOREA_SIGUNGU) {
      const c = sigunguCenterLatLng(sg.code);
      expect(c, sg.name).not.toBeNull();
      expect(c!.lat, sg.name).toBeGreaterThanOrEqual(33);
      expect(c!.lat, sg.name).toBeLessThanOrEqual(39);
      expect(c!.lng, sg.name).toBeGreaterThanOrEqual(124);
      expect(c!.lng, sg.name).toBeLessThanOrEqual(132);
    }
  });

  it("남북·동서 순서가 보존된다(역투영 부호 뒤집힘 가드)", () => {
    // 부산은 서울보다 남쪽(위도↓)이고 동쪽(경도↑).
    const seoul = sigunguCenterLatLng(JONGNO)!;
    const busan = sigunguCenterLatLng(BUSAN)!;
    expect(busan.lat).toBeLessThan(seoul.lat);
    expect(busan.lng).toBeGreaterThan(seoul.lng);
  });

  it("없는 코드는 null", () => {
    expect(sigunguCenterLatLng("99999")).toBeNull();
    expect(sigunguCenterLatLng("")).toBeNull();
  });
});

describe("homeRangeSigunguSet — 거주지 반경 내 시·군·구(§7.17B)", () => {
  it("가볍게(70km): 수원 포함 · 강릉·부산 제외", () => {
    const set = homeRangeSigunguSet(JONGNO, HOME_RANGE_KM.light, null);
    expect(set.has(SUWON)).toBe(true);
    expect(set.has(GANGNEUNG)).toBe(false);
    expect(set.has(BUSAN)).toBe(false);
  });

  it("당일치기(200km): 강릉 포함 · 부산·제주 제외", () => {
    const set = homeRangeSigunguSet(JONGNO, HOME_RANGE_KM.dayTrip, null);
    expect(set.has(GANGNEUNG)).toBe(true);
    expect(set.has(BUSAN)).toBe(false);
    expect(set.has(JEJU)).toBe(false);
  });

  it("자기 동네는 포함한다(§7.17C — 제외하지 않는다)", () => {
    expect(homeRangeSigunguSet(JONGNO, HOME_RANGE_KM.light, null).has(JONGNO)).toBe(true);
  });

  it("단조성: 반경이 넓으면 좁은 반경 집합을 포함한다", () => {
    const light = homeRangeSigunguSet(JONGNO, HOME_RANGE_KM.light, null);
    const day = homeRangeSigunguSet(JONGNO, HOME_RANGE_KM.dayTrip, null);
    expect(day.size).toBeGreaterThan(light.size);
    for (const c of light) expect(day.has(c)).toBe(true);
  });

  it("🍃 ranks 주면 한적 교집합 — emptySpotSigunguSet 과 같은 규칙(≤ 0.5)", () => {
    const ranks = new Map<string, number>([[JONGNO_LDONG, 0.1]]);
    // 종로구만 랭크 존재·한적 → 반경 안이지만 나머지는 랭크 결측(보수적 제외).
    expect(homeRangeSigunguSet(JONGNO, HOME_RANGE_KM.dayTrip, ranks)).toEqual(
      new Set([JONGNO]),
    );
  });

  it("🍃 컷 경계 0.5 포함 / 0.5 초과 제외", () => {
    const at = new Map<string, number>([[JONGNO_LDONG, 0.5]]);
    const over = new Map<string, number>([[JONGNO_LDONG, 0.5001]]);
    expect(homeRangeSigunguSet(JONGNO, HOME_RANGE_KM.light, at).size).toBe(1);
    expect(homeRangeSigunguSet(JONGNO, HOME_RANGE_KM.light, over).size).toBe(0);
  });

  it("🍃 한적하지만 반경 밖이면 제외 — 거리 조건이 함께 걸린다", () => {
    // 부산 중구 법정동(21010→ 부산 중구)이 한적이어도 서울 70km 밖.
    const ranks = new Map<string, number>([[JONGNO_LDONG, 0.1]]);
    const set = homeRangeSigunguSet(BUSAN, HOME_RANGE_KM.light, ranks);
    expect(set.size).toBe(0); // 부산 반경 안에 종로구가 없다
  });

  it("거주지 코드가 무효면 빈 집합(필터가 조용히 전국으로 넓어지지 않게)", () => {
    expect(homeRangeSigunguSet("99999", HOME_RANGE_KM.dayTrip, null).size).toBe(0);
  });

  it("maxKm 가 0·음수·비유한이면 빈 집합", () => {
    expect(homeRangeSigunguSet(JONGNO, 0, null).size).toBe(0);
    expect(homeRangeSigunguSet(JONGNO, -10, null).size).toBe(0);
    expect(homeRangeSigunguSet(JONGNO, NaN, null).size).toBe(0);
  });

  it("원소는 통계청 code 문자열(타입 축 일치)", () => {
    const set = homeRangeSigunguSet(JONGNO, HOME_RANGE_KM.light, null);
    expect(set.size).toBeGreaterThan(0);
    for (const c of set) {
      expect(typeof c).toBe("string");
      expect(KOREA_SIGUNGU.some((sg) => sg.code === c)).toBe(true);
    }
  });
});

describe("HOME_RANGE_KM — 프리셋 밴드(§7.17C)", () => {
  it("가볍게 < 당일치기, 둘 다 양수", () => {
    expect(HOME_RANGE_KM.light).toBeGreaterThan(0);
    expect(HOME_RANGE_KM.dayTrip).toBeGreaterThan(HOME_RANGE_KM.light);
  });
});

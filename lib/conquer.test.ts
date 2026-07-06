import { describe, it, expect } from "vitest";
import {
  pointInRings,
  projectLatLng,
  sigunguAt,
  conqueredSigunguCodes,
  conquerStats,
  conquerByArea,
  visitedAreaCodes,
  TOTAL_SIGUNGU,
} from "@/lib/conquer";
import { KOREA_PROJECTION, KOREA_SIGUNGU } from "@/lib/koreaMap";
import type { SavedPlace } from "@/lib/travelStore";

function sp(
  lat: number | null,
  lng: number | null,
  contentId: string,
): SavedPlace {
  return {
    contentId,
    contentTypeId: 12,
    title: "t" + contentId,
    address: "주소",
    image: null,
    lat,
    lng,
    areaCode: null,
    savedAt: 0,
  };
}

describe("pointInRings — even-odd ray casting", () => {
  const square = [[0, 0, 10, 0, 10, 10, 0, 10]]; // 정사각형 1개 링

  it("사각형 내부/외부 판정", () => {
    expect(pointInRings(square, 5, 5)).toBe(true);
    expect(pointInRings(square, 15, 5)).toBe(false);
    expect(pointInRings(square, -1, 5)).toBe(false);
    expect(pointInRings(square, 5, 15)).toBe(false);
  });

  it("홀(내부 링)은 제외된다", () => {
    const withHole = [
      [0, 0, 10, 0, 10, 10, 0, 10],
      [3, 3, 7, 3, 7, 7, 3, 7],
    ];
    expect(pointInRings(withHole, 5, 5)).toBe(false); // 홀 안 → 밖
    expect(pointInRings(withHole, 1, 5)).toBe(true); // 링 사이 → 안
  });

  it("떨어진 두 섬(별도 링)은 각자 내부 인정", () => {
    const islands = [
      [0, 0, 4, 0, 4, 4, 0, 4],
      [10, 10, 14, 10, 14, 14, 10, 14],
    ];
    expect(pointInRings(islands, 2, 2)).toBe(true);
    expect(pointInRings(islands, 12, 12)).toBe(true);
    expect(pointInRings(islands, 6, 6)).toBe(false);
  });
});

describe("projectLatLng — 위도 보정 등거리 투영", () => {
  it("bbox 좌상단(maxLat, minLng)은 (pad, pad)로", () => {
    const p = KOREA_PROJECTION;
    const { x, y } = projectLatLng(p.maxLat, p.minLng);
    expect(x).toBeCloseTo(p.pad, 5);
    expect(y).toBeCloseTo(p.pad, 5);
  });

  it("경도↑ → x↑, 위도↑ → y↓(북쪽이 위)", () => {
    const a = projectLatLng(36, 127);
    const bEast = projectLatLng(36, 128);
    const bNorth = projectLatLng(37, 127);
    expect(bEast.x).toBeGreaterThan(a.x);
    expect(bNorth.y).toBeLessThan(a.y);
  });
});

describe("conquer — 시·군·구 정복 집계(실제 데이터)", () => {
  it("전체 시·군·구 수는 데이터와 일치", () => {
    expect(TOTAL_SIGUNGU).toBe(KOREA_SIGUNGU.length);
    expect(TOTAL_SIGUNGU).toBeGreaterThan(200); // 약 250
  });

  it("서울시청 좌표 → 서울(area=1) 시·군·구로 판정", () => {
    const sg = sigunguAt(37.5665, 126.978);
    expect(sg).not.toBeNull();
    expect(sg?.area).toBe(1);
    expect(sg?.code.startsWith("11")).toBe(true);
  });

  it("방문 없으면 정복 0", () => {
    expect(conqueredSigunguCodes([]).size).toBe(0);
    expect(conquerStats([]).conquered).toBe(0);
    expect(conquerStats([]).percent).toBe(0);
  });

  it("좌표 없는 방문은 제외", () => {
    expect(conquerStats([sp(null, null, "a")]).conquered).toBe(0);
    expect(conquerStats([sp(37.5665, null, "b")]).conquered).toBe(0);
  });

  it("국내 밖 좌표는 어느 시·군·구에도 안 들어감", () => {
    expect(sigunguAt(0, 0)).toBeNull();
    expect(sigunguAt(48, 150)).toBeNull();
    expect(conquerStats([sp(0, 0, "a")]).conquered).toBe(0);
  });

  it("해안 스냅 폴백이 바다 좌표를 잘못 잡지 않는다(동해 한가운데)", () => {
    // 육지에서 먼 열린 바다(가장 가까운 경계도 ~103px) — 스냅 임계(12px) 밖이라 null
    expect(sigunguAt(37.5, 130.0)).toBeNull();
  });

  it("해안 관광지가 단순화로 폴리곤 밖에 떨어져도 최근접 시·군·구로 스냅(월미도 회귀)", () => {
    // 실제 사용자 방문 '그때를 아시나요?'(인천 월미도, area 2). 단순화(EPS~450m)로
    // 해안선이 깎여 정확 판정은 폴리곤 밖(경계까지 0.04px)이지만, 스냅이 인천 중구로 잡아야 함.
    const sg = sigunguAt(37.4738193767, 126.598352733);
    expect(sg).not.toBeNull();
    expect(sg?.area).toBe(2); // 인천
    expect(sg?.code.startsWith("23")).toBe(true); // 통계청 인천 prefix
  });

  it("같은 시·군·구 여러 곳은 1로 집계", () => {
    // 서울시청 근처 두 점 — 같은 구로 수렴
    const v = [sp(37.5665, 126.978, "a"), sp(37.5651, 126.98, "b")];
    expect(conqueredSigunguCodes(v).size).toBe(1);
    expect(conquerStats(v).conquered).toBe(1);
  });

  it("서로 다른 시·도의 두 곳 → 정복 2 + 시·도별 진행", () => {
    const v = [sp(37.5665, 126.978, "seoul"), sp(35.1631, 129.1639, "busan")];
    const codes = conqueredSigunguCodes(v);
    expect(codes.size).toBe(2);
    const byArea = conquerByArea(codes);
    const areas = byArea.map((a) => a.area).sort((x, y) => x - y);
    expect(areas).toEqual([1, 6]); // 서울·부산
    for (const a of byArea) {
      expect(a.done).toBe(1);
      expect(a.total).toBeGreaterThanOrEqual(1);
    }
  });

  it("percent 는 conquered/total 반올림", () => {
    const v = [sp(37.5665, 126.978, "a")];
    const { conquered, total, percent } = conquerStats(v);
    expect(conquered).toBe(1);
    expect(percent).toBe(Math.round((1 / total) * 100));
  });
});

describe("visitedAreaCodes — 발 들인 시·도(M16, areaCode 기준)", () => {
  // 홈 히어로 17타일·헤더 정복 pill·지도 '발 들인 시·도'의 단일 출처.
  // 좌표→시·군·구 판정과 달리 areaCode 로 직접 집계 → 좌표 없는 방문도 포함.
  function withArea(areaCode: number | null, id: string): SavedPlace {
    return { ...sp(null, null, id), areaCode };
  }

  it("방문 없으면 빈 집합", () => {
    expect(visitedAreaCodes([]).size).toBe(0);
  });

  it("서로 다른 시·도만 카운트(중복 제거)", () => {
    const v = [withArea(1, "a"), withArea(6, "b"), withArea(1, "c")];
    const set = visitedAreaCodes(v);
    expect(set.size).toBe(2);
    expect(set.has(1)).toBe(true);
    expect(set.has(6)).toBe(true);
  });

  it("areaCode 없는 방문은 제외", () => {
    const v = [withArea(null, "a"), withArea(32, "b")];
    const set = visitedAreaCodes(v);
    expect(set.size).toBe(1);
    expect(set.has(32)).toBe(true);
  });
});

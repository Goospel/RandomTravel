// 🧭 반나절 코스(M20, plan.md §7.10) 순수 로직 — 슬롯 정의·다리 거리·교통 힌트.
//
// 서버 뽑기(drawCourse)는 네트워크라 lib/tourapi 에 두고, 여기선 UI·서버 공용 순수부만.
// COURSE_SLOTS 는 "볼거리→식사→카페" 의미 고정 순서(nearest-neighbor 기각, §7.10) — 슬롯 키·타입·
// cat3 규칙의 단일 출처(서버 뽑기·클라 렌더가 함께 참조).

import { haversineM } from "@/lib/geo";
import { CAFE_CAT3, MEAL_REJECT_CAT3, COURSE_DRIVE_HINT_M } from "@/lib/constants";

export type CourseSlot = "sight" | "meal" | "cafe";

export interface CourseSlotDef {
  slot: CourseSlot;
  /** UI 라벨(볼거리·식사·카페) */
  label: string;
  /** UI 이모지 */
  emoji: string;
  /** 뽑을 contentTypeId 들(셔플 순회) */
  contentTypeIds: number[];
  /** ☕ 카페 슬롯만 — cat3 직접 필터(음식점39 하위 카페·전통찻집). */
  cat3?: string;
  /** 🍚 식사 슬롯만 — 뽑힌 항목 cat3 가 여기 있으면 거부하고 재추첨(카페·클럽). */
  rejectCat3?: readonly string[];
}

/**
 * 코스 3슬롯 — 볼거리 → 식사 → 카페(의미 고정 순서, §7.10).
 *  - 볼거리: 관광지12·문화시설14·레포츠28(축제15=시간성·여행코스25=코스 중첩이라 제외)
 *  - 식사: 음식점39 전체, 단 카페·클럽 cat3 는 거부(밥집만)
 *  - 카페: 음식점39 + cat3=카페·전통찻집 직접 필터
 */
export const COURSE_SLOTS: CourseSlotDef[] = [
  { slot: "sight", label: "볼거리", emoji: "🏞️", contentTypeIds: [12, 14, 28] },
  {
    slot: "meal",
    label: "식사",
    emoji: "🍚",
    contentTypeIds: [39],
    rejectCat3: MEAL_REJECT_CAT3,
  },
  {
    slot: "cafe",
    label: "카페",
    emoji: "☕",
    contentTypeIds: [39],
    cat3: CAFE_CAT3,
  },
];

/** 다리 거리 계산 입력 점(앵커·스텝) — 좌표 null 이면 그 점에 붙는 다리는 미상(null). */
export interface CoursePoint {
  lat: number | null;
  lng: number | null;
}

/**
 * 인접 점 사이 직선거리(m) 배열 — 길이 = points.length - 1.
 * 어느 한쪽 좌표가 null 이면 그 다리는 null(거리 미상 → 표시 생략). 앵커→볼거리→식사→카페 순.
 * locationBased 응답 dist(앵커 기준)를 쓰지 않고 하버사인으로 이전 스텝 기준 축을 통일(§7.10).
 */
export function courseLegs(points: CoursePoint[]): (number | null)[] {
  const legs: (number | null)[] = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (a.lat == null || a.lng == null || b.lat == null || b.lng == null) {
      legs.push(null);
    } else {
      legs.push(haversineM(a.lat, a.lng, b.lat, b.lng));
    }
  }
  return legs;
}

/** 다리 거리 합계(null 다리는 0으로 제외). 다리가 없거나 전부 null 이면 0. */
export function courseTotalM(legs: (number | null)[]): number {
  return legs.reduce<number>((sum, m) => sum + (m ?? 0), 0);
}

/**
 * 🚗 총 이동거리가 COURSE_DRIVE_HINT_M(10km) 초과면 "차로 이동 기준" 병기(경계=false).
 * 반경 상한(20km)을 눌러도 다리 합계는 이론상 더 커질 수 있어, "반나절"의 정직성은
 * 반경이 아니라 총거리 표기 + 이 힌트로 확보한다(§7.10).
 */
export function needsDriveHint(totalM: number): boolean {
  return totalM > COURSE_DRIVE_HINT_M;
}

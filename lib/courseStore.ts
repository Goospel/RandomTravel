// 🧭 코스 저장(§7.10 백로그 ① rt.courses.v1) 순수부 — 목록 대수만. localStorage 접근은
// hooks/useTravelStore 가 담당한다(lib/travelStore 와 같은 분업).
//
// 코스는 "앵커 + 스텝 조합"이 곧 정체성이라, contentId 하나로 식별되는 SavedPlace 와 달리
// 조합 키(courseKey)를 쓴다 — 스텝을 하나라도 재뽑으면 **다른 코스**다.

import { toSavedPlace, type SavedPlace } from "@/lib/travelStore";
import type { CourseSlot } from "@/lib/course";
import type { CourseStep } from "@/types/tour";

/** 코스 출발점(뽑힌 결과) — 지도 링크에 필요한 최소 필드. */
export interface SavedCourseAnchor {
  contentId: string;
  title: string;
  lat: number;
  lng: number;
}

export interface SavedCourseStep {
  slot: CourseSlot;
  place: SavedPlace;
}

export interface SavedCourse {
  /** 앵커+스텝 조합 키 — 저장 여부 판정·삭제의 단일 식별자. */
  key: string;
  anchor: SavedCourseAnchor;
  steps: SavedCourseStep[];
  savedAt: number;
}

/**
 * 조합 키. JSON 배열로 만드는 이유는 **구분자 안전** — `join(",")` 은 id 에 콤마가 섞이면
 * `["1,2"]` 와 `["1","2"]` 가 같은 키가 된다(경계 뭉개짐).
 */
export function courseKey(anchorContentId: string, stepIds: string[]): string {
  return JSON.stringify([anchorContentId, stepIds]);
}

/**
 * 응답(CourseStep[]) → 저장용 최소 형태. 스텝 장소는 `toSavedPlace` 재사용이라
 * overview 같은 큰 필드가 자동으로 떨어진다(localStorage 용량 보호).
 */
export function toSavedCourse(
  anchor: SavedCourseAnchor,
  steps: CourseStep[],
  ts: number,
): SavedCourse {
  return {
    key: courseKey(anchor.contentId, steps.map((s) => s.place.contentId)),
    anchor,
    steps: steps.map((s) => ({ slot: s.slot, place: toSavedPlace(s.place, ts) })),
    savedAt: ts,
  };
}

export function hasCourse(list: SavedCourse[], key: string): boolean {
  return list.some((c) => c.key === key);
}

/** 키로 제거. 없으면 같은 내용의 새 배열(원본 불변). */
export function removeCourse(list: SavedCourse[], key: string): SavedCourse[] {
  return list.filter((c) => c.key !== key);
}

/**
 * 저장 토글: 이미 있으면 제거, 없으면 맨 앞에 추가하고 상한 cap 으로 뒤(오래된 것)를 자른다.
 * addToRecent + toggleSaved 의 성격을 합친 형태 — 코스는 "찜"이면서 목록이 쌓이는 것이라.
 */
export function toggleCourse(
  list: SavedCourse[],
  course: SavedCourse,
  cap: number,
): SavedCourse[] {
  if (hasCourse(list, course.key)) return removeCourse(list, course.key);
  const n = Math.max(0, Math.trunc(cap)); // cap≤0/소수 방어(addToRecent 동형)
  if (n === 0) return [];
  return [course, ...list].slice(0, n);
}

/** 저장 문자열 → SavedCourse[]. 손상(깨진 JSON·비배열·필드 누락)에 throw 하지 않는다. */
export function parseStoredCourses(raw: string | null): SavedCourse[] {
  if (!raw) return [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  return data.filter((x): x is SavedCourse => {
    if (!x || typeof x !== "object") return false;
    const c = x as Partial<SavedCourse>;
    return (
      typeof c.key === "string" &&
      !!c.anchor &&
      typeof c.anchor === "object" &&
      typeof c.anchor.contentId === "string" &&
      Array.isArray(c.steps)
    );
  });
}

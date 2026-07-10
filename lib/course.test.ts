// 🧭 반나절 코스(M20, plan.md §7.10) 순수 로직 — TDD(구현 전 작성).
//   슬롯 정의 shape · 스텝 간 다리(leg) 거리 · 총거리 합계 · 🚗 차량 힌트 경계.

import { describe, it, expect } from "vitest";
import {
  COURSE_SLOTS,
  courseLegs,
  courseTotalM,
  needsDriveHint,
  type CoursePoint,
} from "@/lib/course";
import { haversineM } from "@/lib/geo";
import { CAFE_CAT3, MEAL_REJECT_CAT3, COURSE_DRIVE_HINT_M } from "@/lib/constants";

describe("COURSE_SLOTS — 볼거리→식사→카페 3슬롯 정의", () => {
  it("순서·슬롯 키가 고정(시간 서사)", () => {
    expect(COURSE_SLOTS.map((s) => s.slot)).toEqual(["sight", "meal", "cafe"]);
  });
  it("볼거리는 관광지12·문화시설14·레포츠28 (축제15·여행코스25 제외)", () => {
    const sight = COURSE_SLOTS[0];
    expect(sight.contentTypeIds).toEqual([12, 14, 28]);
    expect(sight.cat3).toBeUndefined();
  });
  it("식사는 음식점39 + 카페·클럽 cat3 거부 목록", () => {
    const meal = COURSE_SLOTS[1];
    expect(meal.contentTypeIds).toEqual([39]);
    expect(meal.rejectCat3).toEqual(MEAL_REJECT_CAT3);
    expect(meal.rejectCat3).toContain(CAFE_CAT3); // 카페는 밥집 아님
  });
  it("카페는 음식점39 + 카페·전통찻집 cat3 직접 필터", () => {
    const cafe = COURSE_SLOTS[2];
    expect(cafe.contentTypeIds).toEqual([39]);
    expect(cafe.cat3).toBe(CAFE_CAT3);
  });
  it("모든 슬롯에 라벨·이모지가 있다(UI 렌더용)", () => {
    for (const s of COURSE_SLOTS) {
      expect(s.label.length).toBeGreaterThan(0);
      expect(s.emoji.length).toBeGreaterThan(0);
    }
  });
});

describe("courseLegs — 인접 점 직선거리(앵커+스텝)", () => {
  const anchor: CoursePoint = { lat: 37.5665, lng: 126.978 }; // 서울시청
  const p1: CoursePoint = { lat: 37.5796, lng: 126.977 }; // 북쪽
  const p2: CoursePoint = { lat: 37.5512, lng: 126.988 }; // 남동쪽

  it("점 n개면 다리 n-1개 = 인접 하버사인", () => {
    const legs = courseLegs([anchor, p1, p2]);
    expect(legs).toHaveLength(2);
    expect(legs[0]).toBe(haversineM(anchor.lat!, anchor.lng!, p1.lat!, p1.lng!));
    expect(legs[1]).toBe(haversineM(p1.lat!, p1.lng!, p2.lat!, p2.lng!));
  });
  it("한쪽 좌표가 null 인 다리만 null(나머지는 유지)", () => {
    const noCoord: CoursePoint = { lat: null, lng: null };
    const legs = courseLegs([anchor, noCoord, p2]);
    expect(legs[0]).toBeNull(); // anchor→noCoord
    expect(legs[1]).toBeNull(); // noCoord→p2
  });
  it("점 1개 이하면 다리 없음", () => {
    expect(courseLegs([anchor])).toEqual([]);
    expect(courseLegs([])).toEqual([]);
  });
});

describe("courseTotalM — 다리 합계(null 다리 제외)", () => {
  it("null 은 0 으로 취급해 합산", () => {
    expect(courseTotalM([1000, null, 2500])).toBe(3500);
  });
  it("빈 배열·전부 null 은 0", () => {
    expect(courseTotalM([])).toBe(0);
    expect(courseTotalM([null, null])).toBe(0);
  });
});

describe("needsDriveHint — 총거리 초과 시 🚗 차량 이동 기준", () => {
  it("경계(정확히 10km)는 false — 초과만 힌트", () => {
    expect(needsDriveHint(COURSE_DRIVE_HINT_M)).toBe(false);
    expect(needsDriveHint(COURSE_DRIVE_HINT_M + 1)).toBe(true);
  });
  it("짧은 코스는 false", () => {
    expect(needsDriveHint(0)).toBe(false);
    expect(needsDriveHint(3500)).toBe(false);
  });
});

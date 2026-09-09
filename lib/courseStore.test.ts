import { describe, it, expect } from "vitest";
import {
  courseKey,
  toSavedCourse,
  hasCourse,
  toggleCourse,
  removeCourse,
  parseStoredCourses,
  type SavedCourse,
} from "@/lib/courseStore";
import type { CourseStep, Place } from "@/types/tour";

const place = (contentId: string, title: string): Place => ({
  contentId,
  contentTypeId: 12,
  title,
  address: "서울특별시 중구",
  image: null,
  lat: 37.5,
  lng: 127,
  areaCode: 1,
  overview: "아주 긴 개요 문자열 ".repeat(50),
});

const anchor = { contentId: "100", title: "출발지", lat: 37.5, lng: 127 };
const steps: CourseStep[] = [
  { slot: "sight", place: place("201", "볼거리") },
  { slot: "meal", place: place("202", "식사") },
  { slot: "cafe", place: place("203", "카페") },
];

describe("courseKey — 같은 구성 = 같은 코스", () => {
  it("앵커·스텝이 같으면 같은 키", () => {
    expect(courseKey("100", ["201", "202"])).toBe(courseKey("100", ["201", "202"]));
  });

  it("스텝 하나만 달라도 다른 키 (스텝 재뽑기 = 다른 코스)", () => {
    expect(courseKey("100", ["201", "202"])).not.toBe(courseKey("100", ["201", "299"]));
  });

  it("앵커가 다르면 다른 키", () => {
    expect(courseKey("100", ["201"])).not.toBe(courseKey("999", ["201"]));
  });

  it("스텝 순서가 다르면 다른 키 (순서는 의미 고정 — 구경→밥→커피)", () => {
    expect(courseKey("100", ["201", "202"])).not.toBe(courseKey("100", ["202", "201"]));
  });

  it("id 에 구분자가 섞여도 경계가 뭉개지지 않는다", () => {
    expect(courseKey("100", ["1,2"])).not.toBe(courseKey("100", ["1", "2"]));
  });
});

describe("toSavedCourse — 저장용 최소 형태", () => {
  it("앵커·스텝·저장시각을 담고 키를 만든다", () => {
    const c = toSavedCourse(anchor, steps, 1000);
    expect(c.key).toBe(courseKey("100", ["201", "202", "203"]));
    expect(c.anchor).toEqual(anchor);
    expect(c.savedAt).toBe(1000);
    expect(c.steps.map((s) => s.slot)).toEqual(["sight", "meal", "cafe"]);
    expect(c.steps.map((s) => s.place.title)).toEqual(["볼거리", "식사", "카페"]);
  });

  it("개요(overview) 같은 큰 필드는 저장하지 않는다 — localStorage 용량 보호", () => {
    const c = toSavedCourse(anchor, steps, 1000);
    expect(JSON.stringify(c)).not.toContain("아주 긴 개요");
    expect("overview" in c.steps[0].place).toBe(false);
  });

  it("지도 링크에 필요한 좌표·이미지는 남긴다", () => {
    const c = toSavedCourse(anchor, steps, 1000);
    expect(c.steps[0].place).toMatchObject({ contentId: "201", lat: 37.5, lng: 127 });
  });
});

describe("toggleCourse / removeCourse / hasCourse", () => {
  const a = toSavedCourse(anchor, steps, 1000);
  const b = toSavedCourse({ ...anchor, contentId: "500" }, steps, 2000);

  it("없으면 맨 앞에 추가(최신 우선)", () => {
    const list = toggleCourse(toggleCourse([], a, 20), b, 20);
    expect(list.map((c) => c.key)).toEqual([b.key, a.key]);
  });

  it("같은 키를 다시 저장하면 해제된다(토글)", () => {
    const list = toggleCourse([a], a, 20);
    expect(list).toEqual([]);
  });

  it("상한을 넘으면 오래된 뒤쪽이 잘린다", () => {
    const list = toggleCourse([a], b, 1);
    expect(list.map((c) => c.key)).toEqual([b.key]);
  });

  it("cap 0·음수·소수는 방어한다", () => {
    expect(toggleCourse([], a, 0)).toEqual([]);
    expect(toggleCourse([], a, -3)).toEqual([]);
    expect(toggleCourse([a], b, 1.9).map((c) => c.key)).toEqual([b.key]);
  });

  it("원본 배열을 바꾸지 않는다", () => {
    const list = [a];
    toggleCourse(list, b, 20);
    removeCourse(list, a.key);
    expect(list).toEqual([a]);
  });

  it("removeCourse 는 키로 지우고, 없는 키엔 아무 일도 안 한다", () => {
    expect(removeCourse([a, b], a.key)).toEqual([b]);
    expect(removeCourse([a], "없는키")).toEqual([a]);
  });

  it("hasCourse 로 저장 여부를 본다", () => {
    expect(hasCourse([a], a.key)).toBe(true);
    expect(hasCourse([a], b.key)).toBe(false);
  });
});

describe("parseStoredCourses — 손상에 throw 하지 않는다", () => {
  const a = toSavedCourse(anchor, steps, 1000);

  it("왕복(직렬화 → 파싱)이 같은 값", () => {
    expect(parseStoredCourses(JSON.stringify([a]))).toEqual([a]);
  });

  it("null·빈 문자열·깨진 JSON·비배열은 빈 목록", () => {
    expect(parseStoredCourses(null)).toEqual([]);
    expect(parseStoredCourses("")).toEqual([]);
    expect(parseStoredCourses("{잘못된")).toEqual([]);
    expect(parseStoredCourses('{"a":1}')).toEqual([]);
  });

  it("필수 필드가 없거나 스텝이 배열이 아닌 항목만 걸러낸다", () => {
    const raw = JSON.stringify([
      a,
      null,
      { key: "k" }, // anchor·steps 없음
      { key: "k2", anchor, steps: "배열아님" },
      { anchor, steps: [] }, // key 없음
    ]);
    expect(parseStoredCourses(raw)).toEqual([a]);
  });

  it("스텝이 비어도(전 슬롯 실패 저장분) 형식이 맞으면 통과", () => {
    const empty: SavedCourse = { key: "k3", anchor, steps: [], savedAt: 1 };
    expect(parseStoredCourses(JSON.stringify([empty]))).toEqual([empty]);
  });
});

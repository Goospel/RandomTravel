import { describe, it, expect } from "vitest";
import { mergePlaces, localOnly } from "@/lib/syncMerge";
import type { SavedPlace } from "@/lib/travelStore";

function sp(contentId: string, savedAt: number, over: Partial<SavedPlace> = {}): SavedPlace {
  return {
    contentId,
    contentTypeId: 12,
    title: `장소${contentId}`,
    address: "어딘가",
    image: null,
    lat: 37.5,
    lng: 127.0,
    areaCode: 1,
    savedAt,
    ...over,
  };
}

describe("mergePlaces — 로그인 시 로컬↔서버 찜/방문 병합", () => {
  it("겹치지 않으면 합집합 전체를 남긴다", () => {
    const local = [sp("a", 100)];
    const server = [sp("b", 200)];
    expect(mergePlaces(local, server).map((p) => p.contentId).sort()).toEqual(["a", "b"]);
  });

  it("결과는 savedAt 내림차순(최근 저장이 위로)", () => {
    const local = [sp("a", 100), sp("c", 300)];
    const server = [sp("b", 200)];
    expect(mergePlaces(local, server).map((p) => p.contentId)).toEqual(["c", "b", "a"]);
  });

  it("같은 contentId 는 하나로 — 먼저 저장(작은 savedAt)한 기록을 유지한다", () => {
    const local = [sp("a", 500, { title: "로컬-나중" })];
    const server = [sp("a", 100, { title: "서버-먼저" })];
    const merged = mergePlaces(local, server);
    expect(merged).toHaveLength(1);
    expect(merged[0].savedAt).toBe(100);
    expect(merged[0].title).toBe("서버-먼저");
  });

  it("한쪽이 비어도 다른 쪽을 그대로(정렬만) 반환", () => {
    const server = [sp("b", 200), sp("a", 100)];
    expect(mergePlaces([], server).map((p) => p.contentId)).toEqual(["b", "a"]);
    expect(mergePlaces(server, []).map((p) => p.contentId)).toEqual(["b", "a"]);
  });

  it("둘 다 비면 빈 배열", () => {
    expect(mergePlaces([], [])).toEqual([]);
  });

  it("원본 배열을 변형하지 않는다(불변)", () => {
    const local = [sp("a", 100)];
    const server = [sp("b", 200)];
    mergePlaces(local, server);
    expect(local).toHaveLength(1);
    expect(server).toHaveLength(1);
  });

  it("충돌 시 rating 은 null 아닌 쪽을 살린다 — 평가 유실 방지(M15)", () => {
    // 서버(먼저·평가 없음) + 로컬(나중·평가 있음) → 기저는 서버지만 rating 은 로컬 것 보존
    const server = [sp("a", 100, { rating: null })];
    const local = [sp("a", 500, { rating: 3 })];
    const merged = mergePlaces(local, server);
    expect(merged).toHaveLength(1);
    expect(merged[0].savedAt).toBe(100); // 기저는 여전히 이른 저장
    expect(merged[0].rating).toBe(3); // 평가는 유지
  });

  it("양쪽 모두 평가면 기저(이른 savedAt) 쪽 평가를 쓴다(결정적)", () => {
    const server = [sp("a", 100, { rating: 1 })];
    const local = [sp("a", 500, { rating: 3 })];
    expect(mergePlaces(local, server)[0].rating).toBe(1);
  });
});

describe("localOnly — 서버에 없는 로컬 항목(업로드 델타)", () => {
  it("서버에 이미 있는 항목은 제외한다", () => {
    const local = [sp("a", 100), sp("b", 200), sp("c", 300)];
    const server = [sp("b", 50)]; // b 는 서버에 있음
    expect(localOnly(local, server).map((p) => p.contentId).sort()).toEqual(["a", "c"]);
  });
  it("서버가 비면 로컬 전체가 델타", () => {
    const local = [sp("a", 100), sp("b", 200)];
    expect(localOnly(local, []).map((p) => p.contentId).sort()).toEqual(["a", "b"]);
  });
  it("로컬이 전부 서버에 있으면 빈 배열(삭제한 서버 항목을 되살리지 않음)", () => {
    const local = [sp("a", 100)];
    const server = [sp("a", 50)];
    expect(localOnly(local, server)).toEqual([]);
  });
});

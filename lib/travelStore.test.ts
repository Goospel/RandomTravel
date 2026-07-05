import { describe, it, expect } from "vitest";
import {
  addToRecent,
  toggleSaved,
  has,
  parseStored,
  serialize,
  toSavedPlace,
  setRatingInList,
  type SavedPlace,
} from "@/lib/travelStore";
import type { Place } from "@/types/tour";

// 찜/최근/방문 목록의 순수 리스트 대수 — localStorage 를 직접 만지지 않는다.
// 저장 형태는 SavedPlace(카드/지도에 필요한 최소 필드 + savedAt).

function sp(id: string, over: Partial<SavedPlace> = {}): SavedPlace {
  return {
    contentId: id,
    contentTypeId: 12,
    title: `장소 ${id}`,
    address: "어딘가",
    image: null,
    lat: 37.5,
    lng: 127.0,
    areaCode: 1,
    savedAt: 0,
    ...over,
  };
}

describe("addToRecent — 최근 본 곳(최근순·중복제거·상한)", () => {
  it("새 항목을 맨 앞에 넣는다", () => {
    const out = addToRecent([sp("a")], sp("b"), 10);
    expect(out.map((x) => x.contentId)).toEqual(["b", "a"]);
  });

  it("이미 있는 항목은 맨 앞으로 이동(중복 없음)", () => {
    const out = addToRecent([sp("a"), sp("b"), sp("c")], sp("b"), 10);
    expect(out.map((x) => x.contentId)).toEqual(["b", "a", "c"]);
  });

  it("상한 N을 넘으면 오래된 뒤쪽을 버린다", () => {
    const out = addToRecent([sp("a"), sp("b"), sp("c")], sp("d"), 3);
    expect(out.map((x) => x.contentId)).toEqual(["d", "a", "b"]);
    expect(out).toHaveLength(3);
  });

  it("재삽입 시 새 값(savedAt 등)으로 갱신한다", () => {
    const out = addToRecent([sp("a", { savedAt: 1 })], sp("a", { savedAt: 99 }), 5);
    expect(out).toHaveLength(1);
    expect(out[0].savedAt).toBe(99);
  });

  it("원본 배열을 변형하지 않는다(불변)", () => {
    const orig = [sp("a")];
    addToRecent(orig, sp("b"), 5);
    expect(orig.map((x) => x.contentId)).toEqual(["a"]);
  });

  it("cap=0 이면 빈 배열(방금 넣은 것도 포함 안 함)", () => {
    expect(addToRecent([sp("a")], sp("b"), 0)).toEqual([]);
  });

  it("음수 cap 은 0 으로 방어 — 빈 배열(끝 원소를 자르는 slice 오동작 방지)", () => {
    expect(addToRecent([sp("a"), sp("b"), sp("c")], sp("d"), -1)).toEqual([]);
  });
});

describe("toggleSaved — 찜/방문 토글(contentId 기준)", () => {
  it("없으면 추가(맨 앞)", () => {
    const out = toggleSaved([sp("a")], sp("b"));
    expect(out.map((x) => x.contentId)).toEqual(["b", "a"]);
  });

  it("있으면 제거", () => {
    const out = toggleSaved([sp("a"), sp("b")], sp("b"));
    expect(out.map((x) => x.contentId)).toEqual(["a"]);
  });
});

describe("has", () => {
  it("contentId 포함 여부", () => {
    expect(has([sp("a"), sp("b")], "b")).toBe(true);
    expect(has([sp("a")], "z")).toBe(false);
  });
});

describe("parseStored / serialize — 저장 직렬화·손상 방어", () => {
  it("정상 배열은 왕복", () => {
    const list = [sp("a"), sp("b")];
    expect(parseStored(serialize(list))).toEqual(list);
  });

  it("null 이면 빈 배열", () => {
    expect(parseStored(null)).toEqual([]);
  });

  it("깨진 JSON 이면 빈 배열(throw 안 함)", () => {
    expect(parseStored("{not json")).toEqual([]);
  });

  it("배열이 아니면 빈 배열", () => {
    expect(parseStored('{"a":1}')).toEqual([]);
  });

  it("contentId 없는 손상 항목은 걸러낸다", () => {
    const raw = JSON.stringify([{ title: "no id" }, sp("ok")]);
    expect(parseStored(raw).map((x) => x.contentId)).toEqual(["ok"]);
  });
});

describe("toSavedPlace — Place → SavedPlace 변환", () => {
  it("필요한 필드만 뽑고 savedAt 을 심는다", () => {
    const place: Place = {
      contentId: "123",
      contentTypeId: 15,
      title: "홍련암",
      address: "강원 양양",
      image: "http://img",
      lat: 38.0,
      lng: 128.6,
      areaCode: 32,
      overview: "긴 개요 텍스트",
    };
    const out = toSavedPlace(place, 1717000000000);
    expect(out).toEqual({
      contentId: "123",
      contentTypeId: 15,
      title: "홍련암",
      address: "강원 양양",
      image: "http://img",
      lat: 38.0,
      lng: 128.6,
      areaCode: 32,
      savedAt: 1717000000000,
      // 새로 뽑은/저장한 장소는 아직 미평가
      rating: null,
    });
    // overview 는 목록엔 불필요 — 저장하지 않는다
    expect("overview" in out).toBe(false);
  });
});

describe("setRatingInList — 방문 항목에 재방문 의향 평가 설정(M15)", () => {
  it("매칭 항목만 rating 을 설정한다", () => {
    const out = setRatingInList([sp("a"), sp("b")], "b", 3);
    expect(out.find((x) => x.contentId === "b")!.rating).toBe(3);
    expect(out.find((x) => x.contentId === "a")!.rating).toBeUndefined();
  });

  it("null 로 평가를 해제한다", () => {
    const out = setRatingInList([sp("a", { rating: 2 })], "a", null);
    expect(out[0].rating).toBeNull();
  });

  it("기존 평가를 다른 값으로 교체한다", () => {
    const out = setRatingInList([sp("a", { rating: 1 })], "a", 3);
    expect(out[0].rating).toBe(3);
  });

  it("매칭이 없으면 그대로", () => {
    const list = [sp("a", { rating: 2 })];
    const out = setRatingInList(list, "z", 3);
    expect(out.map((x) => x.rating)).toEqual([2]);
  });

  it("원본 배열·항목을 변형하지 않는다(불변)", () => {
    const orig = [sp("a", { rating: 1 })];
    const out = setRatingInList(orig, "a", 3);
    expect(orig[0].rating).toBe(1); // 원본 항목 불변
    expect(out).not.toBe(orig);
    expect(out[0]).not.toBe(orig[0]);
  });
});

describe("parseStored — rating 필드 보존(M15)", () => {
  it("저장·복원 왕복에서 rating 이 유지된다", () => {
    const list = [sp("a", { rating: 3 }), sp("b", { rating: null }), sp("c")];
    const round = parseStored(serialize(list));
    expect(round.map((x) => x.rating)).toEqual([3, null, undefined]);
  });
});

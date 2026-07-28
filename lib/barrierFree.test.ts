import { describe, it, expect } from "vitest";
import {
  WITH_FACILITY_LABELS,
  normalizeWithFacilities,
} from "@/lib/barrierFree";

describe("normalizeWithFacilities — ♿ detailWithTour2 편의시설 정규화 (§6.11)", () => {
  it("채워진 필드만 칩으로(항목마다 오는 필드가 다름 — 실측)", () => {
    expect(
      normalizeWithFacilities({
        contentid: "2776846",
        parking: "장애인 전용 주차구역 2면",
        route: "경사로 있음",
      }),
    ).toEqual([
      { label: "장애인 주차", value: "장애인 전용 주차구역 2면" },
      { label: "접근로", value: "경사로 있음" },
    ]);
  });

  it("표시 순서는 매핑 테이블 순서(응답 키 순서에 안 흔들림)", () => {
    const chips = normalizeWithFacilities({
      lactationroom: "있음",
      wheelchair: "대여 가능",
      parking: "가능",
    });
    expect(chips.map((c) => c.label)).toEqual([
      "휠체어",
      "장애인 주차",
      "수유실",
    ]);
  });

  it("빈 값·공백·모르는 키는 버린다", () => {
    expect(
      normalizeWithFacilities({
        wheelchair: "",
        parking: "  ",
        unknownField: "값",
      }),
    ).toEqual([]);
  });

  it("HTML 태그·&nbsp; 를 정리한다", () => {
    expect(normalizeWithFacilities({ exit: "자동문<br>&nbsp;폭 90cm" })).toEqual([
      { label: "출입구", value: "자동문 폭 90cm" },
    ]);
  });

  it("값 끝의 분류 꼬리표(_○○ 편의시설)는 잘라낸다 — 라벨과 중복되는 잡음", () => {
    expect(
      normalizeWithFacilities({
        exit: "주출입구는 턱이 없어 휠체어 접근 가능함_무장애 편의시설",
        helpdog: "동반가능_시각장애인 편의시설",
      }),
    ).toEqual([
      { label: "출입구", value: "주출입구는 턱이 없어 휠체어 접근 가능함" },
      { label: "보조견 동반", value: "동반가능" },
    ]);
  });

  it("값 안쪽의 _ 나 편의시설 이란 낱말은 안 건드린다(맨 끝 한 조각만)", () => {
    expect(normalizeWithFacilities({ room: "편의시설 안내는 1층_로비" })).toEqual([
      { label: "객실·이용 공간", value: "편의시설 안내는 1층_로비" },
    ]);
  });

  it("실측 전체 키 28종을 전부 라벨링한다(미매핑 키가 조용히 사라지지 않게)", () => {
    // 스파이크 실측 키 목록(2026-07-28) — contentid 제외.
    const keys = [
      "audioguide", "auditorium", "babysparechair", "bigprint",
      "blindhandicapetc", "braileblock", "brailepromotion", "elevator",
      "exit", "guidehuman", "guidesystem", "handicapetc",
      "hearinghandicapetc", "hearingroom", "helpdog", "infantsfamilyetc",
      "lactationroom", "parking", "promotion", "publictransport",
      "restroom", "room", "route", "signguide",
      "stroller", "ticketoffice", "videoguide", "wheelchair",
    ];
    expect(Object.keys(WITH_FACILITY_LABELS).sort()).toEqual([...keys].sort());
    for (const k of keys) expect(WITH_FACILITY_LABELS[k]).toBeTruthy();
  });
});

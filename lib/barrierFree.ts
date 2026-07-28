// ♿ 무장애 여행지(§6.11) — detailWithTour2 편의시설 필드를 카드 칩으로 정규화(순수부).
//   항목마다 **채워진 필드만** 응답에 온다(실측 2776846: parking·publictransport·route·exit 4개)
//   → 없는 필드는 "없음"이 아니라 **정보 없음**이다. 그래서 있는 것만 칩으로 보여준다.

import type { InfoChip } from "@/types/tour";
import { stripTags } from "@/lib/text";

/**
 * 실측 전체 키 28종(2026-07-28 · contentid 제외) → 한글 라벨.
 * 객체 **키 순서 = 칩 표시 순서** — 이동·접근에 직결되는 것부터, 부가 편의는 뒤로.
 * ⚠️ 여기 없는 키는 조용히 버려진다 → 상류에 새 필드가 생기면 여기에 추가한다.
 */
export const WITH_FACILITY_LABELS: Readonly<Record<string, string>> = {
  wheelchair: "휠체어",
  parking: "장애인 주차",
  restroom: "장애인 화장실",
  elevator: "엘리베이터",
  exit: "출입구",
  route: "접근로",
  publictransport: "대중교통",
  room: "객실·이용 공간",
  auditorium: "관람석",
  ticketoffice: "매표소",
  braileblock: "점자블록",
  brailepromotion: "점자 안내물",
  bigprint: "큰 글씨 안내물",
  audioguide: "음성 안내",
  videoguide: "영상 안내",
  signguide: "수어 안내",
  guidehuman: "안내 도우미",
  guidesystem: "안내 시스템",
  promotion: "안내 홍보물",
  helpdog: "보조견 동반",
  hearingroom: "청각 보조기기",
  blindhandicapetc: "시각장애인 기타 편의",
  hearinghandicapetc: "청각장애인 기타 편의",
  handicapetc: "기타 편의시설",
  lactationroom: "수유실",
  babysparechair: "유아용 의자",
  stroller: "유모차 대여",
  infantsfamilyetc: "영유아 가족 편의",
};

/**
 * 상류 값 꼬리에 붙는 분류 꼬리표(`…가능함_무장애 편의시설`·`…_시각장애인 편의시설`) 제거.
 * 라벨이 이미 같은 뜻을 말하고 있어 화면에선 중복 잡음이다(실측 2714103).
 * 안쪽 `_` 는 건드리지 않도록 **맨 끝 한 조각**만, 그것도 "편의시설"로 끝날 때만 자른다.
 */
const CATEGORY_SUFFIX_RE = /_[^_]{0,20}편의시설$/;

/** 편의시설 칩 — 값이 있고 라벨을 아는 필드만, 위 테이블 순서로. */
export function normalizeWithFacilities(
  item: Record<string, string | undefined>,
): InfoChip[] {
  const chips: InfoChip[] = [];
  for (const [key, label] of Object.entries(WITH_FACILITY_LABELS)) {
    const value = stripTags(item[key] ?? "").replace(CATEGORY_SUFFIX_RE, "");
    if (value) chips.push({ label, value });
  }
  return chips;
}

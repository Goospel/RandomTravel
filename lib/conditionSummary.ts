// 🎫 조건 요약 한 줄(M32, plan.md §7.21) — 켜진 조건들의 한국어 라벨 배열(순수).
//
// 티켓 카드 안에서 조건 패널이 차지하던 959px 을 이 한 줄이 대신한다. 계약은 **표시·전송 일치**:
// buildRandomQuery 가 서버에 안 싣는 조건은 여기서도 말하지 않는다. 잠금 규칙을 두 벌 쓰는
// 것이 아니라 같은 우선순위(🌊 > 🐕 > ♿)와 같은 배제(🏠 · 미래 기준일)를 그대로 따른다.

import { AREA_NAME, CONTENT_TYPE_NAME } from "@/lib/constants";

export interface ConditionInput {
  areas: Iterable<number>;
  types: Iterable<number>;
  seaside: boolean;
  pet: boolean;
  barrierFree: boolean;
  seasonal: boolean;
  festival: boolean;
  noRain: boolean;
  quiet: boolean;
  scatter: boolean;
  /** 📅 정리된 미래 기준일의 칩 라벨(activeDateYmd 통과분). null = 오늘 = 조건 아님 */
  dateLabel: string | null;
  /** 🏠 거주지 반경 km. null = 제한 없음 = 조건 아님 */
  homeKm: number | null;
}

/** 코드 목록 → 이름 한 조각. 3개부터는 "첫 이름 외 N곳"(줄 하나에 담기게). */
function names(
  codes: Iterable<number>,
  map: Record<number, string>,
): string | null {
  const list = [...codes].map((c) => map[c]).filter(Boolean);
  if (list.length === 0) return null;
  if (list.length <= 2) return list.join("·");
  return `${list[0]} 외 ${list.length - 1}곳`;
}

export function conditionSummary(c: ConditionInput): string[] {
  // 🏠 거주지 반경(§7.17D): 서버가 이 축만 본다 — 나머지를 말하면 화면이 거짓말을 한다.
  //    함께 실리는 건 🍃 하나뿐이다.
  if (c.homeKm != null) {
    return [`집에서 ${c.homeKm}km`, ...(c.quiet ? ["한적"] : [])];
  }

  // 대상 축은 동시 1개(§6.11) — buildRandomQuery 와 같은 우선순위.
  const target = c.seaside
    ? "seaside"
    : c.pet
      ? "pet"
      : c.barrierFree
        ? "barrierFree"
        : null;

  const out: string[] = [];

  // 🐕 는 전국 전용이라 지역·테마가 전송되지 않는다 → 요약에서도 뺀다.
  if (target !== "pet") {
    const area = names(c.areas, AREA_NAME);
    if (area) out.push(area);
    // 🌊 는 테마가 관광지로 고정된다.
    if (target !== "seaside") {
      const type = names(c.types, CONTENT_TYPE_NAME);
      if (type) out.push(type);
    }
  }

  if (c.dateLabel) out.push(c.dateLabel);

  if (target === "seaside") out.push("바다");
  if (target === "pet") out.push("반려동물");
  if (target === "barrierFree") out.push("무장애");
  if (c.seasonal) out.push("제철 산지");
  if (c.festival) out.push("축제 중");
  // ☔ 는 오늘 날씨만 알 수 있다(§6.8) — 미래 기준일에선 잠기므로 말하지 않는다.
  if (!c.dateLabel && c.noRain) out.push("비 안 오는 곳");
  if (c.quiet) out.push("한적");
  if (c.scatter) out.push("분산");

  return out;
}

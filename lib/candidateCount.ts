// 🔢 실시간 후보 수(M16, plan.md §7.8) — 조건 → 조회할 조합 계획(순수 함수).
//   실제 합산은 tourapi.countCandidates 가 이 계획대로 getTotalCount(24h 캐시)를 돌려 수행.
//   drawRandom 의 풀 구성과 같은 규칙을 쓰되 "뽑지 않고 세기만" 한다.
//
//   동적 조건(🎪 축제·☔ 비안옴)은 그날그날 원격 소스로 좁혀야 해 정확·저비용 집계가
//   어렵다 → 값 대신 dynamic 으로 표시하고 UI 는 정성 라벨을 보여준다(사용자 선택 Option A).

import { RANDOM_DEFAULT_TYPES, SEA_CAT3 } from "@/lib/constants";
import { narrowBySeasonal } from "@/lib/season";

/** getTotalCount 호출 상한 — drawRandom 의 COMBO_BUDGET(34)과 같은 예산. */
export const COUNT_COMBO_BUDGET = 34;

export interface CountParams {
  areaCodes: number[];
  contentTypeIds: number[];
  seaside: boolean;
  seasonal: boolean;
  festivalOnly: boolean;
  noRain: boolean;
}

/** 조회할 한 조합 — areaBasedList2 파라미터로 매핑된다. */
export interface Combo {
  contentTypeId: number;
  areaCode?: number;
  cat3?: string;
}

export type CountPlan =
  /** 🎪·☔ — 정확 집계 불가, UI 는 정성 라벨 */
  | { kind: "dynamic" }
  /** 제철 등으로 지역 풀이 비어 후보 0 확정 */
  | { kind: "empty" }
  /** 조회할 조합들. capped=예산 상한에 잘려 근사(≈ N곳+)임을 뜻함 */
  | { kind: "combos"; combos: Combo[]; capped: boolean };

/**
 * 조건 → 카운트 계획. month 는 제철 기준 월(호출부에서 주입, 테스트 결정성).
 */
export function planCandidateCount(p: CountParams, month: number): CountPlan {
  // 동적 조건이 하나라도 켜지면 정확 집계 불가 → dynamic
  if (p.festivalOnly || p.noRain) return { kind: "dynamic" };

  // 지역 풀 — 비면 전국(null). 🦀 제철이면 이번 달 산지로 교집합.
  let areaPool: number[] | null = p.areaCodes.length > 0 ? [...p.areaCodes] : null;
  if (p.seasonal) {
    areaPool = narrowBySeasonal(areaPool, month);
    if (areaPool.length === 0) return { kind: "empty" };
  }

  const combos: Combo[] = [];
  if (p.seaside) {
    // 🌊 바다: 관광지(12)×cat3 4종 (타입 선택 무시 — drawSeaside 와 동일).
    for (const sea of SEA_CAT3) {
      if (areaPool) {
        for (const areaCode of areaPool)
          combos.push({ contentTypeId: 12, areaCode, cat3: sea.cat3 });
      } else {
        combos.push({ contentTypeId: 12, cat3: sea.cat3 });
      }
    }
  } else {
    const typePool =
      p.contentTypeIds.length > 0 ? p.contentTypeIds : RANDOM_DEFAULT_TYPES;
    for (const contentTypeId of typePool) {
      if (areaPool) {
        for (const areaCode of areaPool) combos.push({ contentTypeId, areaCode });
      } else {
        combos.push({ contentTypeId });
      }
    }
  }

  const capped = combos.length > COUNT_COMBO_BUDGET;
  return {
    kind: "combos",
    combos: capped ? combos.slice(0, COUNT_COMBO_BUDGET) : combos,
    capped,
  };
}

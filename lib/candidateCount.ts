// 🔢 실시간 후보 수(M16, plan.md §7.8) — 조건 → 조회할 조합 계획(순수 함수).
//   실제 합산은 tourapi.countCandidates 가 이 계획대로 getTotalCount(24h 캐시)를 돌려 수행.
//   drawRandom 의 풀 구성과 같은 규칙을 쓰되 "뽑지 않고 세기만" 한다.
//
//   동적 조건(🎪 축제·☔ 비안옴)은 그날그날 원격 소스로 좁혀야 해 정확·저비용 집계가
//   어렵다 → 값 대신 dynamic 으로 표시하고 UI 는 정성 라벨을 보여준다(사용자 선택 Option A).

import { RANDOM_DEFAULT_TYPES, SEA_CAT3 } from "@/lib/constants";
import { narrowBySeasonal } from "@/lib/season";
import { narrowByQuiet } from "@/lib/congestion";

/** getTotalCount 호출 상한 — drawRandom 의 COMBO_BUDGET(34)과 같은 예산. */
export const COUNT_COMBO_BUDGET = 34;

export interface CountParams {
  areaCodes: number[];
  contentTypeIds: number[];
  seaside: boolean;
  seasonal: boolean;
  festivalOnly: boolean;
  noRain: boolean;
  quiet: boolean;
  /** 🐕 반려동물 동반(§6.11) — 전국 전용 단일 totalCount 경로 */
  pet: boolean;
  /** ♿ 무장애(§6.11) — 조합 계획은 그대로, 조회 서비스만 KorWithService2 로 */
  barrierFree: boolean;
}

/** 후보 수를 어느 서비스에서 셀 것인가(§6.11) — countCandidates 가 엔드포인트로 번역한다. */
export type CountSource = "kor" | "with";

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
  /** 🐕 — detailPetTour2 totalCount 1콜(전국 전용·조건 무관 단일 값, §6.11) */
  | { kind: "pet" }
  /** 조회할 조합들. capped=예산 상한에 잘려 근사(≈ N곳+)임을 뜻함 */
  | { kind: "combos"; source: CountSource; combos: Combo[]; capped: boolean };

/**
 * 조건 → 카운트 계획. month 는 제철 기준 월(호출부에서 주입, 테스트 결정성).
 * quietSet 은 🍃 한적 시·도 집합(호출부 countCandidates 가 DB에서 계산해 주입 — 제철 calendar 주입 동형).
 *   quiet 켜짐 + quietSet 미주입/null = 데이터 없음/stale → dynamic(정확 집계 불가로 폴백).
 *   ⚠️ 라우트에서 지역 풀을 사전 교집합하지 말 것 — CountParams의 "빈 배열=전국"과 충돌해
 *   전멸이 전국으로 뒤집힌다. 교집합은 여기서(narrowByQuiet) 하고 0이면 empty.
 */
export function planCandidateCount(
  p: CountParams,
  month: number,
  quietSet?: Set<number> | null,
): CountPlan {
  // 🐕 대상 축(§6.11) — 상류가 지역·타입·조건 필터를 안 받는 전국 전용이라 다른 조건이
  //   켜져 있어도 후보는 detailPetTour2 전체다. 그래서 dynamic 판정보다 **먼저** 반환한다
  //   (서버 drawPet 이 조건을 적용하지 않는 사실과 배지를 일치시킨다).
  //   🌊 가 켜져 있으면 buildRandomQuery 우선순위(🌊 > 🐕 > ♿)를 따라 여기 안 온다.
  if (p.pet && !p.seaside) return { kind: "pet" };
  const source: CountSource = p.barrierFree && !p.seaside ? "with" : "kor";

  // 동적 조건이 하나라도 켜지면 정확 집계 불가 → dynamic
  if (p.festivalOnly || p.noRain) return { kind: "dynamic" };
  // 🍃 한적 켜졌는데 배치 데이터가 없거나 stale → dynamic(countCandidates가 null 주입)
  if (p.quiet && quietSet == null) return { kind: "dynamic" };

  // 지역 풀 — 비면 전국(null). 🦀 제철이면 이번 달 산지로 교집합.
  let areaPool: number[] | null = p.areaCodes.length > 0 ? [...p.areaCodes] : null;
  if (p.seasonal) {
    areaPool = narrowBySeasonal(areaPool, month);
    if (areaPool.length === 0) return { kind: "empty" };
  }
  // 🍃 한적 — 성수기 예측 시·도 제거(narrowByQuiet). 교집합 0이면 empty(전멸).
  if (p.quiet && quietSet) {
    areaPool = narrowByQuiet(areaPool, quietSet);
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
    source,
    combos: capped ? combos.slice(0, COUNT_COMBO_BUDGET) : combos,
    capped,
  };
}

// 🔭 빈 곳에서 뽑기(M21, plan.md §7.11)의 순수 로직 — 미방문 ∩ 한적 풀·후보 셀.
//
// 네트워크·DB 없음(단위 테스트 O). getCongestionDay 조회·좌표 검증은 lib/tourapi 의 drawEmptySpot
// 이 담당(lib/congestion↔lib/tourapi 의 순수/불순 분리 대칭).
//   - 한적 정의는 배지와 단일 출처: sigunguPctRank 중앙값 ≤ QUIET_SIGUNGU_CUT(lib/congestion).
//     후보 수·좌표 검증·EMPTY_POOL 판정·배지 주장 전부 이 한 집합(정의 분열 금지, §7.11).
//   - 세 코드체계: members·sigunguSet = 통계청 KOREA_SIGUNGU.code / cell.sigunguCode = TourAPI /
//     법정동 signguCd = ranks 키. 섞지 않는다(코드 직결 금지).

import { KOREA_SIGUNGU } from "@/lib/koreaMap";
import { sigunguPctRank, QUIET_SIGUNGU_CUT } from "@/lib/congestion";
import { TOUR_SIGUNGU_CELLS, type TourSigunguCell } from "@/lib/tourSigungu";

/**
 * 🔭 미방문 ∩ 한적 시·군·구 통계청 code 집합.
 * @param excluded 방문 정복한 시·군·구 통계청 code(conqueredSigunguCodes 산출). 미방문 = 전체 − 이것.
 * @param ranks    그날 전국 시군구 pctRank(법정동cd→pctRank). null = 성능저하(congestion 실패/stale)
 *                 → 한적 판정을 생략하고 **미방문 전체**로 폴백(버튼이 죽는 것보다 정직한 축소, 문구③).
 *
 * ranks 있음: 각 미방문 시군구의 sigunguPctRank(중앙값) ≤ QUIET_SIGUNGU_CUT 만 한적.
 *   매핑 없음·랭크 전부 결측(sigunguPctRank null)은 한적 아님(보수적 제외 — 배지와 동일 규칙).
 */
export function emptySpotSigunguSet(
  excluded: ReadonlySet<string>,
  ranks: Map<string, number> | null,
): Set<string> {
  const out = new Set<string>();
  for (const sg of KOREA_SIGUNGU) {
    if (excluded.has(sg.code)) continue; // 방문 → 제외(미방문 조건이 앞선다)
    if (ranks === null) {
      out.add(sg.code); // 성능저하: 미방문 전체
      continue;
    }
    const p = sigunguPctRank(sg.area, sg.name, ranks);
    if (p != null && p <= QUIET_SIGUNGU_CUT) out.add(sg.code);
  }
  return out;
}

/**
 * 🔭 뽑기 후보 셀 — 멤버(통계청 code) 중 **1개 이상**이 sigunguSet 에 속한 셀.
 * 부분 방문 셀도 통과(방문 구 차단은 좌표 검증 몫). N:1 셀 지원.
 * 성질: TOUR_SIGUNGU_CELLS members 합집합이 250 전수이므로 sigunguSet≠∅ ⇔ eligibleCells≠∅.
 */
export function eligibleCells(
  sigunguSet: ReadonlySet<string>,
  cells: readonly TourSigunguCell[] = TOUR_SIGUNGU_CELLS,
): TourSigunguCell[] {
  return cells.filter((c) => c.members.some((m) => sigunguSet.has(m)));
}

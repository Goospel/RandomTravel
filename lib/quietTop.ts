// 🍃 오늘 한적 TOP5(M27, plan.md §7.16A)의 순수 선정 로직.
//
// 네트워크·DB 없음(단위 테스트 O) — 조회·신선도 판정은 app/api/quiet/top 이 담당한다
// (lib/emptySpot ↔ lib/tourapi 의 순수/불순 분리와 같은 대칭).
//   - '한적' 정의는 배지·🔭 와 단일 출처: sigunguPctRank(lib/congestion) 중앙값.
//     여기선 컷을 두지 않는다 — TOP5 는 임계 통과가 아니라 **순위 상위 N**이다.
//   - 세 코드체계: 반환 code = 통계청 KOREA_SIGUNGU.code(only= 파라미터 축) /
//     ranks 키 = 법정동 signguCd / 셀 = TourAPI sigunguCode. 섞지 않는다(코드 직결 금지).

import { KOREA_SIGUNGU, type Sigungu } from "@/lib/koreaMap";
import { sigunguPctRank } from "@/lib/congestion";
import { TOUR_SIGUNGU_CELLS } from "@/lib/tourSigungu";
import { AREA_NAME } from "@/lib/constants";
import type { QuietTopItem } from "@/types/tour";

/** 셀 매핑이 있는 통계청 code 전수(⋃members) — 기본 인자. 없는 곳은 탭해도 못 뽑는 '죽은 칩'. */
const CELL_MEMBERS: ReadonlySet<string> = new Set(
  TOUR_SIGUNGU_CELLS.flatMap((c) => c.members),
);

/**
 * 🍃 그날 pctRank 가 낮은(=한적 예측) 시·군·구 상위 n곳.
 *
 * @param ranked 그날 전국 법정동 시군구 pctRank(rankDaily 산출).
 * @param n      뽑을 개수(음수·0 은 빈 배열).
 * @param cellMembers 셀 매핑이 있는 통계청 code 집합. 여기 없는 곳은 **스킵하고 다음 순위로
 *   채운다** — 칩을 탭하면 그 셀에서 뽑아야 하는데 셀이 없으면 죽은 칩이 된다(§7.16A).
 *
 * @param sigungus 후보 시·군·구 목록. 기본 KOREA_SIGUNGU — **입력 순서에 의존하지 않는다**는
 *   타이브레이크의 성질을 테스트가 실측할 수 있게 주입 가능(quietAreaCodes·eligibleCells 관례).
 *
 * 동률은 통계청 code 오름차순 타이브레이크 — 같은 입력이면 항상 같은 TOP5(1h 캐시·재현성).
 *   KOREA_SIGUNGU 가 지금은 code 순이라 정렬 안정성만으로도 같은 결과지만, 그건 **생성물의
 *   우연한 성질**이라 재생성으로 깨질 수 있다(명시 타이브레이크가 그 의존을 끊는다).
 * 랭크 결측(매핑 없음·데이터 없음 → sigunguPctRank null)은 후보에서 제외(배지와 같은 보수 규칙).
 */
export function topQuietSigungu(
  ranked: Map<string, number>,
  n: number,
  cellMembers: ReadonlySet<string> = CELL_MEMBERS,
  sigungus: readonly Sigungu[] = KOREA_SIGUNGU,
): QuietTopItem[] {
  if (n <= 0) return [];
  const scored: { item: QuietTopItem; pct: number }[] = [];
  for (const sg of sigungus) {
    if (!cellMembers.has(sg.code)) continue; // 죽은 칩 방지
    const pct = sigunguPctRank(sg.area, sg.name, ranked);
    if (pct == null) continue; // 결측 제외
    scored.push({
      pct,
      item: {
        code: sg.code,
        name: sg.name,
        areaName: AREA_NAME[sg.area] ?? "",
        pctBelow: Math.round(pct * 100),
      },
    });
  }
  // ⚠️ code 비교는 문자열 사전순 — 전부 5자리 숫자 문자열이라 수치순과 일치한다.
  scored.sort(
    (a, b) => a.pct - b.pct || (a.item.code < b.item.code ? -1 : 1),
  );
  return scored.slice(0, n).map((s) => s.item);
}

// 법정동 코드 → 앱 areaCode 판별 (공용 순수 헬퍼).
//
// TourAPI 응답의 areacode 는 자주 비어 있고(항목 ~40%·축제는 대부분), 대신 법정동
// lDongRegnCd/lDongSignguCd 는 채워져 온다. 🎪 축제(§6.2)가 먼저 이 우회로를 썼고,
// ⚖️ 시·도 균등 승격(§6.9A)이 뽑기 결과의 배지 귀속에 같은 판별을 쓰면서 공용으로 뺐다.
// (호출부마다 areacode 와의 우선순위가 달라, 여기선 **lDong 판별만** 하고 폴백은 호출부 몫.)

import { LDONG_TO_AREA, LDONG12_GWANGJU_GU } from "@/lib/constants";

/**
 * 법정동 시도(+시군구) 코드 → 앱 areaCode. 판별 불가면 null.
 *
 * 특례 12 = 전남광주통합특별시(2026-07-01 개편) — 한 시도 코드가 광주(5)·전남(38)에
 * 걸쳐 시도 단위로 못 가르므로 시군구 코드로 판별한다. 시군구가 없으면 null(호출부 폴백).
 */
export function ldongToAreaCode(
  lDongRegnCd?: string,
  lDongSignguCd?: string,
): number | null {
  if (!lDongRegnCd) return null;
  if (lDongRegnCd === "12") {
    if (!lDongSignguCd) return null;
    return LDONG12_GWANGJU_GU.has(lDongSignguCd) ? 5 : 38;
  }
  return LDONG_TO_AREA[lDongRegnCd] ?? null;
}

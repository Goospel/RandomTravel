// ⚖️ 분산 모드(M22, plan.md §6.9B)의 순수 로직 — 외지인 방문자수 √역가중 + 가중 선택 순서.
//
// DB·캐시는 db/congestion(getVisitorRecent)이 담당하고 여기선 변환·가중·순서만 한다
// (lib/congestion ↔ db/congestion 대칭). 시·도 귀속 매핑은 **주입받는다** — 이 모듈이
// congestionCodes(519행 자동생성)에 묶이지 않게, 그리고 테스트가 매핑을 갈아끼울 수 있게.
//
// ⚠️ 의미론: ⚖️ 는 **필터가 아니라 분포 축**이다. 후보 풀은 그대로고 뽑힐 확률만 기운다
//   — 그래서 후보 수 배지는 ⚖️ ON/OFF 에서 같아야 한다(§6.9 불변식).

import { ldongToAreaCode } from "@/lib/ldong";

/** 관광객 구분 코드 — 외지인. 실측 2026-07: "1"현지인/"2"외지인/"3"외국인. */
export const VISITOR_OUTSIDER = "2";

/**
 * 방문자 행의 시군구 코드 → 앱 시·도. **2계층**으로 판별한다.
 *
 * ① 정밀 매핑(LDONG_TO_APP_AREA, 5자리 전체) — 특례 4건(군위→경북·부천 3코드·세종·미추홀)이
 *    여기 들어있고, 앱의 시·도 귀속이 법정동 시도 코드와 **다른** 경우는 이 계층뿐이다.
 * ② 시도 2자리 폴백(ldongToAreaCode) — 방문자 데이터가 통합시를 **상위 코드**로 주기 때문에
 *    필요하다(41110 수원시 vs 정밀 매핑의 41111 장안구…). 실측 2026-07-27: 최신일 268개 중
 *    16개가 이 형태였고 **외지인 방문자의 13%(3.77M)** 가 통째로 버려지고 있었다 —
 *    그것도 경기 최대 도시들(수원·성남·용인·화성·고양…)이라 ⚖️ 의 목적을 정면으로 훼손했다.
 *    개편 신코드(52 전북)·병합(12 전남광주)도 이 계층이 함께 처리한다.
 *
 * ⚠️ 순서가 핵심 — ①을 건너뛰고 앞 2자리를 바로 자르면 군위(27720)가 대구로 새서
 *   조용히 틀린다. ①에 있는 코드는 ②에 절대 닿지 않는다.
 */
function visitorArea(
  sigunguCd: string,
  ldongToArea: Record<string, number>,
): number | null {
  const exact = ldongToArea[sigunguCd];
  if (exact != null) return exact;
  if (sigunguCd.length < 2) return null;
  return ldongToAreaCode(sigunguCd.slice(0, 2), sigunguCd.slice(2));
}

/** getVisitorRecent 산출물 1행 — 시군구(법정동 5자리)별 외지인 방문자 평균(최근 ≤7일). */
export interface VisitorRecentRow {
  sigunguCd: string;
  touNum: number;
}

/**
 * 입도 중복 제거 — **같은 인구가 두 번 세어지는 것**을 막는다(§6.9B).
 *
 * 방문자 데이터는 통합시를 **시 상위 코드와 구 하위 코드로 동시에** 준다(실측 2026-07-27:
 * 41110 수원시 506,160 **과** 41111~41117 구 합 586,499 이 같은 날 공존 — 13개 그룹).
 * 그대로 합하면 경기 ×1.54·충북 ×1.49·전북 ×1.33·경남 ×1.33·충남 ×1.29·경북 ×1.16 으로
 * 부풀고, 충북처럼 중간 규모 시·도는 ⚖️ 가 **의도와 반대로 눌린다**.
 *
 * 판별은 법정동 **앞 4자리 그룹** 단위로 하되, 무엇을 버릴지는 **정밀 매핑(ldongToArea) 보유
 * 여부**로 정한다 — 정밀 매핑이 곧 "앱이 인정하는 시·군·구 정본"이기 때문이다:
 *  ① 그룹에 정본과 미매핑이 **섞여 있으면** 미매핑 쪽이 다른 입도의 중복 → 정본만 남긴다.
 *     수원(정본=구 4개, 중복=상위 41110)과 화성(정본=상위 41590, 중복=신설 구 4개)이 **방향이
 *     반대**인데도 같은 규칙으로 잡힌다.
 *  ② 그룹이 **전부 정본**이면 애초에 중복이 아니라 **서로 다른 시·군·구**다 → 손대지 않는다.
 *     ⚠️ 실측 반례: `43740 영동군` + `43745 증평군`. 앞 4자리가 같지만 별개 군이라, "행 수 많은
 *     쪽만 채택" 같은 순수 개수 규칙을 쓰면 1:1 동수가 돼 **한 군의 방문자가 통째로 사라진다**.
 *  ③ 그룹이 **전부 미매핑**이면 기준 삼을 정본이 없다 → 이때만 **행 수가 많은 쪽**을 채택하고,
 *     동수면 세분 입도(그룹 대표코드 `prefix+"0"` 가 아닌 쪽)를 택한다. 현재 데이터엔 이 경우가
 *     0건이지만, 새 통합시가 정밀 매핑보다 먼저 들어오는 상황의 방어선이다.
 */
function dedupeGranularity(
  rows: VisitorRecentRow[],
  ldongToArea: Record<string, number>,
): VisitorRecentRow[] {
  const groups = new Map<string, VisitorRecentRow[]>();
  for (const r of rows) {
    const key = r.sigunguCd.slice(0, 4);
    const list = groups.get(key);
    if (list) list.push(r);
    else groups.set(key, [r]);
  }

  const out: VisitorRecentRow[] = [];
  for (const [prefix, list] of groups) {
    if (list.length < 2) {
      out.push(...list);
      continue;
    }
    const canonical = list.filter((r) => ldongToArea[r.sigunguCd] != null);
    const unmapped = list.filter((r) => ldongToArea[r.sigunguCd] == null);

    if (unmapped.length === 0 || canonical.length > 0) {
      // ② 전부 정본(별개 시군구) · ① 혼재(정본만 채택) — 두 경우 다 정본만 내보내면 된다.
      out.push(...canonical);
      continue;
    }
    // ③ 전부 미매핑 — 대표코드 vs 세분, 행 수 많은 쪽. 동수면 세분.
    const rep = unmapped.filter((r) => r.sigunguCd === `${prefix}0`);
    const fine = unmapped.filter((r) => r.sigunguCd !== `${prefix}0`);
    if (rep.length === 0 || fine.length === 0) out.push(...unmapped);
    else out.push(...(rep.length > fine.length ? rep : fine));
  }
  return out;
}

/** 정렬된 수열의 중앙값(짝수는 두 가운데 평균). 빈 배열은 NaN. (lib/congestion 동형) */
function median(nums: number[]): number {
  if (nums.length === 0) return NaN;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/**
 * 시·도별 가중치 = **1/√(외지인 방문자 합)**.
 *
 * 왜 √인가: 시·도 극단이 실측 **71.1배**(서울 5,916,964 vs 세종 83,164 — 입도 중복 제거 후)라
 * 원시 역비례면 세종이 판을 독점한다. √ 완충으로 확률비 **8.43배** — "적을수록 자주"는 유지하되
 * 큰 시·도가 사실상 사라지지 않는 지점.
 *
 * 결측 시·도(방문자 데이터에 없는 시·도)는 **분포 중앙값 가중**으로 계층화한다. 0 을 주면
 * 그 시·도가 통째 탈락하고(오버투어리즘 주제와 충돌), 최대 가중을 주면 "데이터 없음"이
 * "방문자 최저"로 둔갑해 단조성이 깨진다 — 중앙값이 둘 다 피하는 유일한 지점이다.
 * 전결측(빈 입력)이면 전 시·도 같은 값 = 균등(호출부는 이 경우 notice 로 알린다).
 *
 * @param rows 시군구별 외지인 평균
 * @param ldongToArea 법정동 시군구 5자리 → 앱 areaCode. **앞 2자리 자르기 금지** —
 *   군위 27720 은 대구(27…)가 아니라 경북(35)이라 prefix 방식은 조용히 틀린다.
 *   호출부는 LDONG_TO_APP_AREA(자동생성 역인덱스, 특례 4건 반영)를 넘긴다.
 * @param areaCodes 가중치를 낼 대상 시·도(기본 = 전국 17개)
 */
export function areaWeights(
  rows: VisitorRecentRow[],
  ldongToArea: Record<string, number>,
  areaCodes: readonly number[] = DEFAULT_AREA_CODES,
): Map<number, number> {
  const sums = new Map<number, number>();
  // 합산 **전에** 입도 중복을 걷어낸다 — 안 하면 통합시 인구가 두 번 세어져 큰 시·도가
  // 부풀고, 그 시·도의 가중치가 부당하게 낮아진다(⚖️ 의도와 반대 방향).
  for (const r of dedupeGranularity(rows, ldongToArea)) {
    const area = visitorArea(r.sigunguCd, ldongToArea);
    if (area == null) continue; // 판별 불가 — 합에 안 섞는다
    if (!Number.isFinite(r.touNum) || r.touNum <= 0) continue;
    sums.set(area, (sums.get(area) ?? 0) + r.touNum);
  }

  const weights = new Map<number, number>();
  for (const [area, sum] of sums) weights.set(area, 1 / Math.sqrt(sum));

  // 결측 계층 — 관측된 가중치들의 중앙값. 하나도 없으면 균등(1).
  const fallback = weights.size > 0 ? median([...weights.values()]) : 1;
  for (const area of areaCodes) {
    if (!weights.has(area)) weights.set(area, fallback);
  }
  return weights;
}

// 전국 17개 시·도 — constants 를 import 하면 순환이 생기지 않지만, 이 모듈의 유일한 의존을
// 없애 순수부를 자립시킨다(호출부가 다른 풀을 넘기면 그대로 존중).
const DEFAULT_AREA_CODES: readonly number[] = [
  1, 2, 3, 4, 5, 6, 7, 8, 31, 32, 33, 34, 35, 36, 37, 38, 39,
];

/**
 * 가중 확률로 시·도를 **비복원 추출**해 시도 순서를 만든다(= drawSeaside 의 splice 패턴을
 * 미리 다 돌려놓은 것). 호출부는 이 순서대로 count 를 때려보고 빈 지역은 그냥 넘어간다.
 *
 * ⚠️ "뽑힌 지역 가중치를 0 으로 만들고 재추첨"은 쓰면 안 된다 — 남은 가중 합이 0 이 되는
 *   순간 누적합 선택이 인덱스 0 을 돌려주며(에러 아님) 같은 지역을 무한히 고른다.
 *   여기선 **배열에서 제거 + 길이로 종료**하므로 그 실패 모드가 구조적으로 없다.
 *   가중치가 전부 0·결측인 구간은 남은 순서를 그대로(균등하게) 이어붙인다.
 */
export function weightedPickOrder(
  areas: readonly number[],
  weights: Map<number, number>,
  rand: () => number,
): number[] {
  const pool = [...areas];
  const out: number[] = [];
  while (pool.length > 0) {
    const w = pool.map((a) => {
      const v = weights.get(a);
      return Number.isFinite(v) && v! > 0 ? v! : 0;
    });
    const total = w.reduce((s, v) => s + v, 0);
    let idx: number;
    if (total <= 0) {
      // 남은 전부가 무가중 — 균등하게 하나 고른다(무한루프·0번 쏠림 방지).
      idx = Math.min(pool.length - 1, Math.floor(rand() * pool.length));
    } else {
      const target = rand() * total;
      let acc = 0;
      idx = pool.length - 1; // 부동소수 잔차 방어(마지막으로 폴백)
      for (let i = 0; i < w.length; i++) {
        acc += w[i];
        if (target < acc) {
          idx = i;
          break;
        }
      }
    }
    out.push(pool[idx]);
    pool.splice(idx, 1); // 비복원 — 길이가 줄어 반드시 종료
  }
  return out;
}

/** Fisher-Yates — rand 주입(결정적 테스트용). 입력을 복사해 부작용 없음. */
function shuffleWith<T>(arr: readonly T[], rand: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * 조합 목록을 **(가중 지역) × (셔플 타입)** 순서로 재배열한다 — 균등 경로의 전역 셔플을
 * 대체하는 ⚖️ 전용 순서. 지역 단위로 붙여 내보내므로 호출부는 "그 지역 전 타입이 0건이면
 * 다음 지역"을 자연히 수행한다.
 *
 * 조합 **자체는 만들지 않고 재배열만** 한다 — 쿼리 디스크립터(§6.9A 의 lDong 버킷)를
 * 호출부와 100% 공유하기 위함이다(따로 만들면 ⚖️ ON 에서 areacode 40% 손실이 재발한다).
 */
export function orderByWeightedArea<T extends { slotAreaCode: number }>(
  combos: readonly T[],
  weights: Map<number, number>,
  rand: () => number,
): T[] {
  const byArea = new Map<number, T[]>();
  for (const c of combos) {
    const list = byArea.get(c.slotAreaCode);
    if (list) list.push(c);
    else byArea.set(c.slotAreaCode, [c]);
  }
  const order = weightedPickOrder([...byArea.keys()], weights, rand);
  const out: T[] = [];
  for (const area of order) out.push(...shuffleWith(byArea.get(area)!, rand));
  return out;
}

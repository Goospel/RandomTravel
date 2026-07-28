// 공공 API 호출 정책 — 타임아웃 + 1회 재시도 (plan.md §6.5 "API 장애·지연")
//
// 왜 필요한가: TourAPI·기상청은 응답이 수 초씩 걸리거나 간헐적으로 멈춘다. 타임아웃이 없으면
// 상류가 응답을 붙잡고 있는 동안 뽑기 요청이 **무한정** 대기하고, 사용자는 슬롯이 계속 도는
// 화면만 본다(§7.9 MIN_SPIN_MS 는 하한이지 상한이 아니다).
//
// ⚠️ 이건 **호출 1건당 상한**이지 요청 전체 상한이 아니다 — drawByType 처럼 조합을 순회하는
//    경로는 (호출 수 × 상한)까지 늘 수 있다. 전체 데드라인이 필요해지면 §6.5 재설계 몫.
//    (ponytail: per-call ceiling, 요청 단위 데드라인은 필요해질 때)
//
// ⚠️ Next 의 fetch 캐시와 공존한다 — `signal` 을 넘겨도 데이터 캐시는 꺼지지 않는다
//    (next 16.2.10 patch-fetch 실측: signal 은 그대로 통과, 백그라운드 재검증 때만 제거).
//    그래서 getTotalCount 의 24h 캐시(§5.6)는 이 변경으로 영향받지 않는다.

/** 호출 1건 타임아웃(ms). plan §6.5 확정값. */
export const API_TIMEOUT_MS = 8000;

/**
 * 실패하면 **1회만** 더 시도한다(§6.5). 두 번째도 실패하면 그 오류를 그대로 던진다.
 * 시도마다 fn 을 새로 호출하므로 호출부가 시도별 AbortSignal 을 새로 만들 수 있다
 * (이미 abort 된 signal 을 재사용하면 재시도가 즉시 실패한다).
 *
 * @param shouldRetry 재시도할 오류인지 판정(기본: 전부 재시도). false 면 첫 오류를 그대로 던진다.
 */
export async function retryOnce<T>(
  fn: () => Promise<T>,
  shouldRetry: (e: unknown) => boolean = () => true,
): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (!shouldRetry(e)) throw e;
    return await fn();
  }
}

/**
 * AbortSignal.timeout 이 던지는 오류인가(DOMException `TimeoutError` — Node 실측 확인).
 *
 * ⚠️ **타임아웃은 재시도하지 않는다.** 타임아웃이 났다는 건 상류가 *죽은 게 아니라 느리다*는
 * 뜻이라, 곧바로 다시 때리면 대개 또 기다린다 — 재시도가 꼬리 지연을 2배(8s→16s)로 만든다.
 * 프로덕션 실측(2026-07-28): 뽑기 12.9초 = 타임아웃 8초 + 재시도 4.9초. 재시도의 값어치는
 * 연결 리셋·DNS 실패 같은 **즉시 실패**에 있고, 그건 이 판정을 통과해 그대로 재시도된다.
 */
export function isTimeout(e: unknown): boolean {
  return e instanceof Error && e.name === "TimeoutError";
}

/**
 * 타임아웃 + 1회 재시도가 걸린 fetch. 상류 래퍼(tourFetch·fetchNcst)가 이걸 통해 나간다.
 * 재시도는 **네트워크·타임아웃 실패**에만 걸린다 — 상류가 200 으로 준 오류 응답(resultCode)은
 * 여기서 성공이라 호출부의 판정 로직이 그대로 처리한다(무의미한 재호출로 쿼터를 태우지 않는다).
 */
export function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  return retryOnce(
    () => fetch(url, { ...init, signal: AbortSignal.timeout(API_TIMEOUT_MS) }),
    (e) => !isTimeout(e), // 느린 상류는 한 번 더 기다리지 않는다 — isTimeout 주석 참조
  );
}

"use client";

// 🔭 빈 곳 후보 수(M21, §7.11) — /map CTA 캡션 "지도에 없는 한적한 동네 N곳" 전용.
//   useCandidateCount 와 같은 400ms 디바운스·seq 경합 가드·dynamic 폴백. 단 별도 훅으로 분리해
//   emptySpot·exclude 가 기존 CandidateBadge 쿼리에 절대 안 실리게 한다(단위 오버로드 차단).
//   query=null 이면 조회하지 않고 loading 유지(store.ready 전 exclude 부정확 방지 게이트).

import { useEffect, useRef, useState } from "react";
import type { CountResponse } from "@/types/tour";
import type { CandidateCount } from "@/hooks/useCandidateCount";

/**
 * 🔭 `emptySpot=1&exclude=…` 쿼리스트링(buildEmptySpotQuery 산출물) → 후보 수 상태.
 * @param query null 이면 미조회(loading 유지) — /map 은 store.ready 전엔 null 을 넘긴다.
 */
export function useEmptySpotCount(query: string | null): CandidateCount {
  const [state, setState] = useState<CandidateCount>({ status: "loading" });
  const seq = useRef(0);

  useEffect(() => {
    const id = ++seq.current;
    // 쿼리(방문집합)가 바뀌면 즉시 로딩 표시 — 외부→UI 동기화라 의도된 setState.
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    setState({ status: "loading" });
    if (query === null) return; // 아직 준비 전 — 조회 보류
    const timer = setTimeout(() => {
      fetch(`/api/random/count?${query}`, { cache: "no-store" })
        .then((res) => res.json() as Promise<CountResponse>)
        .then((data) => {
          if (id !== seq.current) return; // 최신 요청만 반영
          if ("dynamic" in data) setState({ status: "dynamic" });
          else
            setState({
              status: "count",
              totalCount: data.totalCount,
              approx: data.approx,
            });
        })
        .catch(() => {
          if (id === seq.current) setState({ status: "dynamic" });
        });
    }, 400);

    return () => clearTimeout(timer);
  }, [query]);

  return state;
}

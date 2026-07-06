"use client";

// 🔢 실시간 후보 수 배지(M16) — 조건 변경 시 /api/random/count 로 후보 총합 조회.
//   400ms 디바운스로 잦은 호출 억제 + seq 로 경합(늦게 온 옛 응답)을 무시.
//   실패·동적 조건은 dynamic 으로 폴백해 UI 가 정성 라벨을 보이게 한다.

import { useEffect, useRef, useState } from "react";
import type { CountResponse } from "@/types/tour";

export type CandidateCount =
  | { status: "loading" }
  | { status: "count"; totalCount: number; approx: boolean }
  | { status: "dynamic" };

/**
 * 조건 쿼리스트링(buildRandomQuery 산출물) → 후보 수 상태.
 * 빈 문자열이면 전국 카운트를 조회한다.
 */
export function useCandidateCount(query: string): CandidateCount {
  const [state, setState] = useState<CandidateCount>({ status: "loading" });
  const seq = useRef(0);

  useEffect(() => {
    const id = ++seq.current;
    // 조건이 바뀌면 즉시 로딩 표시(디바운스 동안) — 외부(조건)→UI 동기화라 의도된 setState.
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    setState({ status: "loading" });
    const timer = setTimeout(() => {
      const url = `/api/random/count${query ? `?${query}` : ""}`;
      fetch(url, { cache: "no-store" })
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

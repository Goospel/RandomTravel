"use client";

// 📝 개요 지연 로드 (plan.md §5.6) — 결과 카드가 뜬 뒤 detailCommon2 개요만 따로 받는다.
//   뽑기 응답에서 이 왕복(항상 캐시 미스)을 빼는 대가로, 개요는 카드보다 조금 늦게 나타난다.
//   useEmptySpotCount 와 같은 seq 경합 가드 — 연타로 다음 뽑기가 시작되면 옛 개요를 안 붙인다.
//   실패·없음은 조용히 null(카드는 이름·주소·사진·배지로 이미 완결 — 기존 best-effort 계약 유지).

import { useEffect, useRef, useState } from "react";

/**
 * @param contentId 뽑힌 곳의 TourAPI contentId. 바뀌면 다시 받는다.
 * @param initial 응답에 이미 개요가 실려 있으면 그 값(그때는 조회하지 않는다).
 */
export function useOverview(
  contentId: string,
  initial: string | null,
): string | null {
  const [overview, setOverview] = useState<string | null>(initial);
  const seq = useRef(0);

  useEffect(() => {
    const id = ++seq.current;
    // 다른 곳이 뽑히면 옛 개요를 즉시 지운다 — 새 장소에 옛 설명이 붙는 게 최악(외부→UI 동기화).
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    setOverview(initial);
    if (initial || !contentId) return; // 이미 있으면 조회 불필요

    fetch(`/api/overview?contentId=${encodeURIComponent(contentId)}`)
      .then((res) => res.json() as Promise<{ overview?: string | null }>)
      .then((data) => {
        if (id !== seq.current) return; // 최신 뽑기만 반영
        setOverview(data.overview ?? null);
      })
      .catch(() => {}); // 부가 정보라 실패해도 카드는 그대로
    // cleanup 불필요 — 다음 뽑기가 effect 를 다시 돌며 seq 를 올려 옛 응답을 무효화한다.
  }, [contentId, initial]);

  return overview;
}

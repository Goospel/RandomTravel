"use client";

// 📝 개요 지연 로드 (plan.md §5.6) — 결과 카드가 뜬 뒤 detailCommon2 개요만 따로 받는다.
//   뽑기 응답에서 이 왕복(항상 캐시 미스)을 빼는 대가로, 개요는 카드보다 조금 늦게 나타난다.
//   useEmptySpotCount 와 같은 seq 경합 가드 — 연타로 다음 뽑기가 시작되면 옛 개요를 안 붙인다.
//   실패·없음은 조용히 null(카드는 이름·주소·사진·배지로 이미 완결 — 기존 best-effort 계약 유지).
//   ♿ withDetail(§6.11): 같은 왕복에 detailWithTour2 편의시설 칩을 함께 받는다.

import { useEffect, useRef, useState } from "react";
import type { InfoChip } from "@/types/tour";

interface OverviewState {
  overview: string | null;
  /** ♿ 무장애 편의시설 칩(withDetail 일 때만 채워짐). 없으면 빈 배열 */
  facilities: InfoChip[];
}

const EMPTY: InfoChip[] = [];

/**
 * @param contentId 뽑힌 곳의 TourAPI contentId. 바뀌면 다시 받는다.
 * @param initial 응답에 이미 개요가 실려 있으면 그 값(♿ 칩이 필요 없으면 조회하지 않는다).
 * @param withDetail ♿ 편의시설 칩까지 받을지(§6.11). 개요가 이미 있어도 칩 때문에 한 번은 조회한다.
 */
export function useOverview(
  contentId: string,
  initial: string | null,
  withDetail = false,
): OverviewState {
  const [state, setState] = useState<OverviewState>({
    overview: initial,
    facilities: EMPTY,
  });
  const seq = useRef(0);

  useEffect(() => {
    const id = ++seq.current;
    // 다른 곳이 뽑히면 옛 개요·칩을 즉시 지운다 — 새 장소에 옛 설명이 붙는 게 최악(외부→UI 동기화).
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    setState({ overview: initial, facilities: EMPTY });
    if (!contentId) return;
    if (initial && !withDetail) return; // 개요가 이미 있고 칩도 필요 없으면 조회 불필요

    const q = new URLSearchParams({ contentId });
    if (withDetail) q.set("detail", "with");
    fetch(`/api/overview?${q.toString()}`)
      .then(
        (res) =>
          res.json() as Promise<{
            overview?: string | null;
            facilities?: InfoChip[];
          }>,
      )
      .then((data) => {
        if (id !== seq.current) return; // 최신 뽑기만 반영
        setState({
          // 응답 개요가 비면 뽑기 응답에 실려 온 initial 을 유지(🐕 처럼 동봉된 경우).
          overview: data.overview ?? initial,
          facilities: data.facilities ?? EMPTY,
        });
      })
      .catch(() => {}); // 부가 정보라 실패해도 카드는 그대로
    // cleanup 불필요 — 다음 뽑기가 effect 를 다시 돌며 seq 를 올려 옛 응답을 무효화한다.
  }, [contentId, initial, withDetail]);

  return state;
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useTravelStore } from "@/hooks/useTravelStore";
import { useEmptySpotCount } from "@/hooks/useEmptySpotCount";
import { VisitedMap } from "@/components/VisitedMap";
import { visitedWithCoords } from "@/lib/mapView";
import { buildEmptySpotQuery } from "@/lib/query";
import { segment, segmentGroup } from "@/components/ModeToggle";
import { Icon, type IconName } from "@/components/icons";

// 정복 지도는 시·군·구 경계 데이터(약 200KB)를 싣는다 → 별도 청크로 코드 분할해 초기 페인트를
// 막지 않는다(핀 뷰만 볼 땐 아예 안 받는다). 히어로(정복률 링·레벨)도 이 컴포넌트 안에 있다.
const ConquerMap = dynamic(
  () => import("@/components/ConquerMap").then((m) => m.ConquerMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-64 items-center justify-center rounded-xl border border-g-border bg-g-surface text-[13px] text-g-text-2">
        정복 지도 불러오는 중…
      </div>
    ),
  },
);

// 🗺️ 내 여행 지도 — 정복(기본)/핀 토글. 정복이 이 페이지의 주인공.
type View = "conquer" | "pin";
const VIEWS: { key: View; label: string; icon: IconName }[] = [
  { key: "conquer", label: "정복 지도", icon: "grid" },
  { key: "pin", label: "핀 지도", icon: "pin" },
];

export default function MapPage() {
  const store = useTravelStore();
  const router = useRouter();
  const [view, setView] = useState<View>("conquer");
  const pinCount = visitedWithCoords(store.visited).length;

  // 🔭 빈 곳 CTA 캡션 수(§7.11) — exclude(정복 시·군·구)는 conqueredSigunguCodes(koreaMap 의존)라
  //   /map 진입 청크를 무겁게 하지 않게 동적 import 로 계산(정복 지도 자체도 lazy). ready 전엔 null.
  const [excludeQuery, setExcludeQuery] = useState<string | null>(null);
  useEffect(() => {
    // synced 게이트 — 로그인 사용자 서버 병합 완료 후라야 exclude(방문 시·군·구)가 정확(§7.11).
    if (!store.ready || !store.synced) {
      // 아직 준비 전 — 조회 보류(외부→UI 동기화라 의도된 setState, useCandidateCount 동형).
      /* eslint-disable-next-line react-hooks/set-state-in-effect */
      setExcludeQuery(null);
      return;
    }
    let alive = true;
    import("@/lib/conquer").then(({ conqueredSigunguCodes }) => {
      if (alive) setExcludeQuery(buildEmptySpotQuery(conqueredSigunguCodes(store.visited)));
    });
    return () => {
      alive = false;
    };
  }, [store.ready, store.synced, store.visited]);
  const emptyCount = useEmptySpotCount(excludeQuery);

  return (
    <main className="mx-auto flex w-full max-w-[1000px] flex-1 flex-col gap-5 px-4 py-7 sm:px-5">
      <header className="flex flex-col gap-2">
        <Link
          href="/"
          className="inline-flex w-fit items-center gap-1.5 text-[13px] font-medium text-g-primary hover:text-g-primary-hover"
        >
          <Icon name="arrowLeft" size={14} />
          뽑기로 돌아가기
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h1 className="flex items-center gap-2 font-display text-[24px] font-bold leading-[1.2] tracking-[-0.03em] sm:gap-2.5 sm:text-[32px] sm:leading-[1.15]">
              <Icon name="map" size={26} className="text-g-primary" />
              내 여행 지도
            </h1>
            <p className="mt-2 text-[15px] leading-[1.6] text-g-text-2">
              다녀온 곳이 쌓일수록 대한민국이 내 색으로 채워져요.
            </p>
          </div>
          <span aria-live="polite" className="text-[13px] text-g-text-2">
            {store.ready && view === "pin" ? `다녀온 곳 ${pinCount}곳` : " "}
          </span>
        </div>
      </header>

      {/* 세그먼트 토글 — aria-pressed 버튼(FilterPanel과 동일 패턴, radio 계약 미약속). */}
      <div
        role="group"
        aria-label="지도 보기 방식"
        className={`${segmentGroup} max-w-[320px]`}
      >
        {VIEWS.map((o) => (
          <button
            key={o.key}
            type="button"
            aria-pressed={view === o.key}
            onClick={() => setView(o.key)}
            className={segment(view === o.key)}
          >
            <Icon name={o.icon} size={14} />
            {o.label}
          </button>
        ))}
      </div>

      {view === "conquer" ? (
        <ConquerMap
          visited={store.visited}
          storeReady={store.ready}
          // 🔭 빈 곳에서 뽑기 역방향 CTA(§7.11) — 정복률 히어로 **바로 아래**(지도 위)로 올렸다.
          //   페이지 최하단이던 옛 위치는 스크롤해야 보였다. 데스크톱 한 줄 / 모바일 세로 스택.
          //   CTA 를 prop 으로 끼워 ConquerMap 을 쪼개지 않는다(정복 판정이 두 번 돌지 않게).
          cta={
            store.ready ? (
              <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => router.push("/?emptySpot=1")}
                  className="inline-flex h-11 items-center gap-2 rounded-md border border-g-primary bg-transparent px-5 text-[15px] font-medium text-g-primary transition-transform duration-200 hover:-translate-y-px hover:bg-g-primary-soft"
                >
                  <Icon name="target" size={16} />
                  빈 곳에서 뽑기
                </button>
                <p className="text-center text-[12px] leading-[1.6] text-g-text-2">
                  {emptyCount.status === "count"
                    ? `지도에 없는 한적한 동네 ${emptyCount.totalCount}곳`
                    : emptyCount.status === "dynamic"
                      ? "안 가본 동네에서 — 혼잡도 확인 불가"
                      : "아직 발도장 없는 한적한 동네에서"}
                </p>
              </div>
            ) : null
          }
        />
      ) : (
        <VisitedMap visited={store.visited} storeReady={store.ready} />
      )}

      <p className="text-center text-[12px] leading-[1.6] text-g-neutral">
        {view === "conquer"
          ? "다녀온 시·군·구가 내 색으로 채워져요. 조각 위에 마우스를 올리면 이름이 보여요."
          : "핀을 누르면 장소 이름이 보여요 · 카카오/네이버로 다시 열 수 있어요."}
      </p>
    </main>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import type { RandomResponse, ErrorResponse, Place } from "@/types/tour";
import type { SavedPlace } from "@/lib/travelStore";
import { ModeToggle, type Mode } from "@/components/ModeToggle";
import { FilterPanel } from "@/components/FilterPanel";
import { ResultCard } from "@/components/ResultCard";
import { SlotMachine } from "@/components/SlotMachine";
import { RecordPanel } from "@/components/RecordPanel";
import { MapHero } from "@/components/MapHero";
import { AuthButtons } from "@/components/AuthButtons";
import { buildRandomQuery, buildNearbyQuery } from "@/lib/query";
import { visitedAreaCodes } from "@/lib/conquer";
import { AREA_CODES } from "@/lib/constants";
import { useTravelStore } from "@/hooks/useTravelStore";

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok"; data: RandomResponse }
  | { kind: "error"; error: ErrorResponse };

// 📍 주변 뽑기 거점 — 결과 카드/기록 어느 쪽에서 잡든 이름·좌표만 있으면 된다.
type Anchor = { title: string; lat: number; lng: number };

export default function Home() {
  const [mode, setMode] = useState<Mode>("pure");
  const [areas, setAreas] = useState<Set<number>>(new Set());
  const [types, setTypes] = useState<Set<number>>(new Set());
  const [seaside, setSeaside] = useState(false); // 🌊 바다 (§6.3)
  const [seasonal, setSeasonal] = useState(false); // 🦀 제철 (§6.4)
  const [festival, setFestival] = useState(false); // 🎪 축제 (§6.2)
  const [noRain, setNoRain] = useState(false); // ☔ 날씨 (§6.1)
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  // 뽑기마다 증가 → ResultCard 의 key 로 써서 매번 등장 애니메이션이 재생되게
  const [seq, setSeq] = useState(0);
  // 📍 주변에서 뽑기 거점 — 전국 랜덤 결과 또는 기록(찜·최근·다녀옴)에서 잡는다.
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  // 🎉 방금 정복한 시·도 — 홈 히어로 토스트 + 타일 팝(§7.8). 1.7초 뒤 자동 해제.
  const [filledArea, setFilledArea] = useState<number | null>(null);
  const store = useTravelStore();
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (filledArea == null) return;
    const t = window.setTimeout(() => setFilledArea(null), 1700);
    return () => window.clearTimeout(t);
  }, [filledArea]);

  const toggleArea = (code: number) =>
    setAreas((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  const toggleType = (code: number) =>
    setTypes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  const clearFilters = () => {
    setAreas(new Set());
    setTypes(new Set());
    setSeaside(false);
    setSeasonal(false);
    setFestival(false);
    setNoRain(false);
  };

  // 공통 뽑기 실행 — URL 을 받아 상태·기록을 처리. updateAnchor=true 면 결과를 앵커로 잡는다.
  async function runDraw(url: string, isRedraw: boolean, updateAnchor: boolean) {
    setStatus({ kind: "loading" });
    setSeq((s) => s + 1);

    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        const error = (await res.json().catch(() => ({
          error: "알 수 없는 오류가 발생했어요.",
        }))) as ErrorResponse;
        setStatus({ kind: "error", error });
        return;
      }
      const data = (await res.json()) as RandomResponse;
      setStatus({ kind: "ok", data });
      store.recordDraw(data.place, { mode, isRedraw });
      if (updateAnchor) {
        const p = data.place;
        setAnchor(
          p.lat != null && p.lng != null
            ? { title: p.title, lat: p.lat, lng: p.lng }
            : null,
        );
      }
    } catch {
      setStatus({
        kind: "error",
        error: { error: "네트워크 오류 — 연결을 확인하고 다시 시도해 주세요." },
      });
    }
  }

  function draw(isRedraw: boolean) {
    // 조건 0개면 빈 문자열 → 파라미터 없이 = 완전 랜덤(§2 불변식).
    const qs = buildRandomQuery(mode, areas, types, {
      seaside,
      seasonal,
      festival,
      noRain,
    });
    const url = qs ? `/api/random?${qs}` : "/api/random";
    void runDraw(url, isRedraw, true); // 전국 랜덤 → 앵커 갱신
  }

  // 📍 결과 카드의 "주변에서 뽑기" — 현재 앵커 좌표 반경 내 랜덤. 앵커는 그대로 유지.
  function drawNearby() {
    if (!anchor) return;
    const url = `/api/random?${buildNearbyQuery(anchor.lat, anchor.lng)}`;
    void runDraw(url, true, false);
  }

  // 📍 기록(찜·최근·다녀옴)에서 그 장소를 거점으로 삼아 주변 뽑기 — 앵커를 그 장소로 바꾼다.
  function drawNearbyFrom(place: SavedPlace) {
    if (place.lat == null || place.lng == null) return;
    setAnchor({ title: place.title, lat: place.lat, lng: place.lng });
    const url = `/api/random?${buildNearbyQuery(place.lat, place.lng)}`;
    void runDraw(url, true, false);
    resultRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  // ✔ 다녀왔어요 — 새 시·도를 처음 채우면 🎉 토스트를 띄운다(정복 지도 즉시 반영 연출).
  function handleToggleVisit(place: Place) {
    const wasVisited = store.isVisited(place.contentId);
    const before = visitedAreaCodes(store.visited);
    store.toggleVisit(place);
    if (!wasVisited && place.areaCode != null && !before.has(place.areaCode)) {
      setFilledArea(place.areaCode);
    }
  }

  const loading = status.kind === "loading";
  const currentIsNearby =
    status.kind === "ok" && status.data.picked.distanceM != null;
  const canDrawNearby = !!anchor && (mode === "pure" || currentIsNearby);

  const hasCondition =
    areas.size > 0 || types.size > 0 || seaside || seasonal || festival || noRain;

  // 🧩 발 들인 시·도 정복 pill(헤더) — 홈 히어로 타일과 같은 출처(areaCode 기준).
  const conqueredAreas = visitedAreaCodes(store.visited).size;
  const conqueredPct = Math.round((conqueredAreas / AREA_CODES.length) * 100);

  return (
    <main className="mx-auto w-full max-w-[1140px] flex-1 px-4 pb-16 pt-6 sm:px-5">
      <div className="mb-3 flex justify-end">
        <AuthButtons />
      </div>

      <header className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight">🎲 어디든</h1>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            어디 갈지 고민될 때, 운명에 맡겨.
          </p>
        </div>
        <div
          aria-live="polite"
          className="flex flex-none items-center gap-1.5 rounded-full border border-emerald-200 bg-white px-3.5 py-2 text-xs font-bold text-emerald-700 shadow-sm dark:border-emerald-900 dark:bg-zinc-900 dark:text-emerald-300"
        >
          <span aria-hidden>🧩</span>
          <span>
            정복 <b className="text-sm">{conqueredAreas}</b>
            <span className="font-semibold text-zinc-400"> / 17 · {conqueredPct}%</span>
          </span>
        </div>
      </header>

      <MapHero
        visited={store.visited}
        storeReady={store.ready}
        filledArea={filledArea}
      />

      <div className="mt-4 flex flex-wrap items-start gap-4">
        {/* 뽑기 덱 — raised sheet */}
        <section className="min-w-[300px] flex-[1_1_360px] rounded-[22px_22px_20px_20px] border border-zinc-200 bg-white px-4 pb-5 pt-2 shadow-[0_12px_34px_-20px_rgba(20,40,30,0.4)] dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mx-auto mb-3.5 mt-1.5 h-1.5 w-9 rounded-full bg-zinc-200 dark:bg-zinc-700" />

          <ModeToggle mode={mode} onChange={setMode} />

          {mode === "filtered" && (
            <div className="mt-3.5">
              <FilterPanel
                selectedAreas={areas}
                selectedTypes={types}
                seaside={seaside}
                seasonal={seasonal}
                festival={festival}
                noRain={noRain}
                onToggleArea={toggleArea}
                onToggleType={toggleType}
                onToggleSeaside={() => setSeaside((v) => !v)}
                onToggleSeasonal={() => setSeasonal((v) => !v)}
                onToggleFestival={() => setFestival((v) => !v)}
                onToggleNoRain={() => setNoRain((v) => !v)}
                onClear={clearFilters}
              />
            </div>
          )}

          {/* 유일한 전국 랜덤 뽑기 버튼 — 결과가 뜬 뒤엔 "다시 뽑기"로 라벨만 바뀐다
              (결과 카드에 뽑기 버튼을 또 두지 않아 중복 제거). */}
          <button
            type="button"
            onClick={() => draw(status.kind === "ok")}
            disabled={loading}
            className="mt-3.5 w-full rounded-2xl bg-emerald-600 px-6 py-4 text-base font-extrabold text-white shadow-[0_12px_22px_-10px_rgba(5,150,105,0.6)] transition-colors hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-60"
          >
            {loading
              ? "여행지를 뽑는 중…"
              : status.kind === "ok"
                ? "🎲 다시 뽑기"
                : "🎲 여기서 한 곳 뽑기"}
          </button>

          {/* aria-live: 로딩→결과 전환을 같은 컨테이너에서 교체해 스크린리더가 새 결과를 안내 */}
          <div ref={resultRef} className="mt-3.5" aria-live="polite">
            {status.kind === "loading" && <SlotMachine />}
            {status.kind === "ok" && (
              <ResultCard
                key={seq}
                data={status.data}
                onDrawNearby={canDrawNearby ? drawNearby : null}
                anchorTitle={anchor?.title ?? null}
                saved={store.isSaved(status.data.place.contentId)}
                visited={store.isVisited(status.data.place.contentId)}
                onToggleSave={() => store.toggleSave(status.data.place)}
                onToggleVisit={() => handleToggleVisit(status.data.place)}
                onNavigate={() => store.logNavigate(status.data.place)}
              />
            )}
            {status.kind === "error" && (
              <ErrorPanel
                error={status.error}
                onClearConditions={
                  mode === "filtered" && hasCondition ? clearFilters : null
                }
              />
            )}
            {status.kind === "idle" && (
              <p className="px-2 py-3.5 text-center text-sm leading-relaxed text-zinc-400">
                {mode === "pure"
                  ? "버튼을 눌러 전국 어디든 랜덤으로 한 곳을 받아보세요."
                  : "조건을 고르고 뽑거나, 아무것도 안 고르면 완전 랜덤이에요."}
              </p>
            )}
          </div>
        </section>

        <aside className="min-w-[280px] flex-[1_1_300px]">
          <RecordPanel
            saved={store.saved}
            recent={store.recent}
            visited={store.visited}
            onRemove={store.remove}
            onNavigate={store.logNavigate}
            onDrawNearby={drawNearbyFrom}
            onRate={store.setRating}
          />
        </aside>
      </div>

      <p className="mt-6 text-center text-[11.5px] leading-relaxed text-zinc-400">
        탐험 로그 · 뽑기·결과·지도가 한 화면 — <b>다녀왔어요</b>를 누르면 위 정복
        지도가 바로 채워져요.
      </p>
    </main>
  );
}

function ErrorPanel({
  error,
  onClearConditions,
}: {
  error: ErrorResponse;
  onClearConditions: (() => void) | null;
}) {
  const isKeyIssue = error.code === "UPSTREAM_ERROR";
  return (
    <div className="w-full rounded-2xl border border-amber-200 bg-amber-50 p-4 text-center text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
      <p className="font-semibold">⚠️ {error.error}</p>
      {isKeyIssue && (
        <p className="mt-2 text-amber-700 dark:text-amber-300">
          서버의 <code className="font-mono">TOUR_API_KEY</code> 설정을 확인해
          주세요. (<code className="font-mono">.env.local.example</code> 참고)
        </p>
      )}
      {onClearConditions && (
        <button
          type="button"
          onClick={onClearConditions}
          className="mt-2.5 rounded-lg border border-amber-300 bg-white px-3.5 py-2 text-xs font-bold text-amber-700 transition-colors hover:bg-amber-100 dark:border-amber-800 dark:bg-zinc-900 dark:hover:bg-zinc-800"
        >
          조건 초기화
        </button>
      )}
    </div>
  );
}

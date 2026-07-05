"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import type { RandomResponse, ErrorResponse } from "@/types/tour";
import type { SavedPlace } from "@/lib/travelStore";
import { ModeToggle, type Mode } from "@/components/ModeToggle";
import { FilterPanel } from "@/components/FilterPanel";
import { ResultCard } from "@/components/ResultCard";
import { SlotMachine } from "@/components/SlotMachine";
import { RecordPanel } from "@/components/RecordPanel";
import { AuthButtons } from "@/components/AuthButtons";
import { buildRandomQuery, buildNearbyQuery } from "@/lib/query";
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
  const store = useTravelStore();
  // 기록에서 주변 뽑기를 누르면 결과가 위/옆에서 갱신되므로(모바일은 스크롤 밖) 결과로 이동.
  const resultRef = useRef<HTMLDivElement>(null);

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
  async function runDraw(
    url: string,
    isRedraw: boolean,
    updateAnchor: boolean,
  ) {
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
      // 최근 본 곳 기록 + draw/redraw 이벤트(§12.6 P0: 로컬 전용)
      store.recordDraw(data.place, { mode, isRedraw });
      // 전국 랜덤(뽑기/다시뽑기)만 앵커 갱신 — 좌표 없으면 주변 뽑기 불가라 null.
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
    // 조건 0개면 빈 문자열 → 파라미터 없이 = 완전 랜덤(§2 불변식). lib/query.ts 단위 테스트로 고정.
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
  // 결과 카드가 사라진 뒤에도(새로고침·시간 경과) 남은 기록으로 주변 뽑기를 이어갈 수 있게.
  function drawNearbyFrom(place: SavedPlace) {
    if (place.lat == null || place.lng == null) return;
    setAnchor({ title: place.title, lat: place.lat, lng: place.lng });
    const url = `/api/random?${buildNearbyQuery(place.lat, place.lng)}`;
    void runDraw(url, true, false);
    // 모바일은 기록 패널이 결과 아래(desktop은 우측)라, 갱신된 결과로 부드럽게 이동.
    resultRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  const loading = status.kind === "loading";
  // 결과 카드의 주변 버튼 — 앵커가 있고, 순수 모드이거나 지금 결과 자체가 주변 뽑기 결과일 때.
  // (기록에서 주변 뽑기를 하면 조건 모드여도 거리 결과엔 노출해 이어서 탐색 가능하게.)
  const currentIsNearby =
    status.kind === "ok" && status.data.picked.distanceM != null;
  const canDrawNearby = !!anchor && (mode === "pure" || currentIsNearby);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-8 px-5 py-10 lg:max-w-5xl">
      <div className="flex justify-end">
        <AuthButtons />
      </div>
      <header className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">🎲 어디든</h1>
        <p className="mt-2 text-sm text-zinc-500">
          어디 갈지 고민될 때, 운명에 맡겨.
        </p>
        <Link
          href="/map"
          className="mt-3 inline-flex items-center gap-1 rounded-full border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-600 transition-colors hover:border-indigo-300 hover:text-indigo-600 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-indigo-700 dark:hover:text-indigo-400"
        >
          🗺️ 내 여행 지도
        </Link>
      </header>

      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:items-start lg:gap-8">
        <section className="flex flex-col items-center gap-6">
          <ModeToggle mode={mode} onChange={setMode} />

          {mode === "filtered" && (
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
          )}

          <button
            type="button"
            onClick={() => draw(false)}
            disabled={loading}
            className="w-full rounded-2xl bg-indigo-600 px-6 py-5 text-lg font-semibold text-white shadow-lg shadow-indigo-600/20 transition-colors hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-60"
          >
            {loading ? "여행지를 뽑는 중…" : "🎲 뽑기"}
          </button>

          {/* aria-live: 로딩→결과 전환을 같은 컨테이너에서 교체해 스크린리더가 새 결과를 안내 */}
          <div ref={resultRef} className="w-full" aria-live="polite">
            {status.kind === "loading" && <SlotMachine />}
            {status.kind === "ok" && (
              <ResultCard
                key={seq}
                data={status.data}
                onRedraw={() => draw(true)}
                onDrawNearby={canDrawNearby ? drawNearby : null}
                anchorTitle={anchor?.title ?? null}
                saved={store.isSaved(status.data.place.contentId)}
                visited={store.isVisited(status.data.place.contentId)}
                onToggleSave={() => store.toggleSave(status.data.place)}
                onToggleVisit={() => store.toggleVisit(status.data.place)}
                onNavigate={() => store.logNavigate(status.data.place)}
              />
            )}
            {status.kind === "error" && <ErrorPanel error={status.error} />}
            {status.kind === "idle" && (
              <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
                {mode === "pure"
                  ? "버튼을 눌러 전국 어디든 랜덤으로 한 곳을 받아보세요."
                  : "조건을 고르고 뽑거나, 아무것도 안 고르면 완전 랜덤이에요."}
              </p>
            )}
          </div>
        </section>

        <aside className="w-full lg:sticky lg:top-10">
          <RecordPanel
            saved={store.saved}
            recent={store.recent}
            visited={store.visited}
            onRemove={store.remove}
            onNavigate={store.logNavigate}
            onDrawNearby={drawNearbyFrom}
          />
        </aside>
      </div>
    </main>
  );
}

function ErrorPanel({ error }: { error: ErrorResponse }) {
  const isKeyIssue = error.code === "UPSTREAM_ERROR";
  return (
    <div className="w-full rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
      <p className="font-medium">{error.error}</p>
      {isKeyIssue && (
        <p className="mt-2 text-amber-700 dark:text-amber-300">
          서버의 <code className="font-mono">TOUR_API_KEY</code> 설정을 확인해
          주세요. (<code className="font-mono">.env.local.example</code> 참고)
        </p>
      )}
    </div>
  );
}

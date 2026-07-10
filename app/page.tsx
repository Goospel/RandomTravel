"use client";

import { useEffect, useRef, useState } from "react";
import type {
  RandomResponse,
  ErrorResponse,
  Place,
  CourseResponse,
  CourseStepResponse,
} from "@/types/tour";
import type { SavedPlace } from "@/lib/travelStore";
import { ModeToggle, type Mode } from "@/components/ModeToggle";
import { FilterPanel } from "@/components/FilterPanel";
import { ResultCard } from "@/components/ResultCard";
import { SlotMachine } from "@/components/SlotMachine";
import { RecordPanel } from "@/components/RecordPanel";
import { MapHero } from "@/components/MapHero";
import { StoryBanner } from "@/components/StoryBanner";
import { AuthButtons } from "@/components/AuthButtons";
import { InstallButton } from "@/components/InstallButton";
import {
  CoursePanel,
  type CourseState,
  type CourseAnchor,
} from "@/components/CoursePanel";
import {
  buildRandomQuery,
  buildNearbyQuery,
  buildCourseQuery,
  buildEmptySpotQuery,
} from "@/lib/query";
// 🔭 visitedAreaCodes 는 koreaMap 비의존 경량 모듈에서(§7.11). conqueredSigunguCodes 는 홈에
//    정적 import 하지 않는다(koreaMap 유입) — 🔭 클릭 시 동적 import 로만 로드.
import { visitedAreaCodes } from "@/lib/visitedAreas";
import { AREA_CODES } from "@/lib/constants";
import { useTravelStore } from "@/hooks/useTravelStore";

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok"; data: RandomResponse }
  | { kind: "error"; error: ErrorResponse };

// 📍 주변 뽑기 거점 — 결과 카드/기록 어느 쪽에서 잡든 이름·좌표만 있으면 된다.
type Anchor = { title: string; lat: number; lng: number };

// 🎰 슬롯 최소 노출시간(§6.5·§7.9) — 뽑기가 이보다 빨리 끝나도 연출을 이 시간만큼 유지.
const MIN_SPIN_MS = 1200;
const delay = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));

export default function Home() {
  const [mode, setMode] = useState<Mode>("pure");
  const [areas, setAreas] = useState<Set<number>>(new Set());
  const [types, setTypes] = useState<Set<number>>(new Set());
  const [seaside, setSeaside] = useState(false); // 🌊 바다 (§6.3)
  const [seasonal, setSeasonal] = useState(false); // 🦀 제철 (§6.4)
  const [festival, setFestival] = useState(false); // 🎪 축제 (§6.2)
  const [noRain, setNoRain] = useState(false); // ☔ 날씨 (§6.1)
  const [quiet, setQuiet] = useState(false); // 🍃 한적 (§6.7)
  // 📅 방문 시점 기준일(§6.8) — null = 오늘(기본). 미래 칩 선택 시 그 ymd 저장(날짜 단독=완전 랜덤).
  const [dateYmd, setDateYmd] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  // 뽑기마다 증가 → ResultCard 의 key 로 써서 매번 등장 애니메이션이 재생되게
  const [seq, setSeq] = useState(0);
  // 최신 뽑기 토큰(동기적) — 슬롯 최소 노출로 커밋이 뒤로 밀리면서, 늦게 끝난 옛 뽑기가
  // 그 사이 시작된 새 뽑기 결과를 덮어쓰는 경합을 막는다(기록 패널 📍는 loading 게이트 밖이라 실재).
  const drawTokenRef = useRef(0);
  // 📍 주변에서 뽑기 거점 — 전국 랜덤 결과 또는 기록(찜·최근·다녀옴)에서 잡는다.
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  // 🧭 반나절 코스(M20) — 별도 fetch 흐름. courseTokenRef 로 코스↔뽑기 교차 경합 차단(drawTokenRef 동형).
  const [course, setCourse] = useState<CourseState>({ kind: "idle" });
  const courseTokenRef = useRef(0);
  // 🎉 방금 정복한 시·도 — 홈 히어로 토스트 + 타일 팝(§7.8). 1.7초 뒤 자동 해제.
  const [filledArea, setFilledArea] = useState<number | null>(null);
  // 🔭 빈 곳에서 뽑기(§7.11) — 클릭~runDraw 진입 전 창(동적 import·exclude 계산) 이중 클릭 차단.
  const [emptySpotPending, setEmptySpotPending] = useState(false);
  // 🔭 /map → ?emptySpot=1 신호 1회 소비 가드(StrictMode 이중 실행·새로고침 재발화 차단).
  const emptySpotSignalRef = useRef(false);
  const store = useTravelStore();
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (filledArea == null) return;
    const t = window.setTimeout(() => setFilledArea(null), 1700);
    return () => window.clearTimeout(t);
  }, [filledArea]);

  // 🔭 /map "빈 곳" CTA → router.push("/?emptySpot=1") 신호를 홈이 1회 소비(§7.11).
  //   store.ready 후라야 exclude 정확. ref 로 StrictMode 이중 실행·새로고침 재발화 차단 + 즉시 URL 제거.
  useEffect(() => {
    // synced 까지 기다렸다 소비 — 병합 전 소비하면 exclude 가 비어 이미 방문한 곳이 뽑힐 수 있음.
    if (emptySpotSignalRef.current || !store.ready || !store.synced) return;
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("emptySpot") !== "1") return;
    emptySpotSignalRef.current = true;
    window.history.replaceState(null, "", window.location.pathname);
    void runEmptySpot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.ready, store.synced]);

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
    setQuiet(false);
    setDateYmd(null); // 📅 '오늘' 복귀(§6.8)
  };

  // 공통 뽑기 실행 — URL 을 받아 상태·기록을 처리. updateAnchor=true 면 결과를 앵커로 잡는다.
  //   슬롯 최소 노출(§7.9): fetch 를 '커밋 클로저'로 감싸 reject 없는 형태로 만들고, delay 와
  //   Promise.all 로 묶어 **에러 포함 모든 결과**가 최소 노출을 따르게 한다(두 속도 비대칭 방지).
  async function runDraw(url: string, isRedraw: boolean, updateAnchor: boolean) {
    const token = ++drawTokenRef.current; // 이 뽑기의 순번 — 커밋 직전 최신인지 확인
    setStatus({ kind: "loading" });
    setSeq((s) => s + 1);
    // 🧭 새 뽑기가 시작되면 진행 중 코스 fetch 를 무효화하고 옛 코스를 즉시 감춘다(§7.10).
    courseTokenRef.current++;
    setCourse({ kind: "idle" });

    const work = (async (): Promise<() => void> => {
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) {
          const error = (await res.json().catch(() => ({
            error: "알 수 없는 오류가 발생했어요.",
          }))) as ErrorResponse;
          return () => setStatus({ kind: "error", error });
        }
        const data = (await res.json()) as RandomResponse;
        return () => {
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
        };
      } catch {
        return () =>
          setStatus({
            kind: "error",
            error: {
              error: "네트워크 오류 — 연결을 확인하고 다시 시도해 주세요.",
            },
          });
      }
    })();

    const [commit] = await Promise.all([work, delay(MIN_SPIN_MS)]);
    // 더 새로운 뽑기가 이미 시작됐으면 옛 결과로 상태·앵커·기록을 덮어쓰지 않는다(최신 승리).
    if (token !== drawTokenRef.current) return;
    commit();
  }

  function draw(isRedraw: boolean) {
    // 조건 0개면 빈 문자열 → 파라미터 없이 = 완전 랜덤(§2 불변식).
    const qs = buildRandomQuery(mode, areas, types, {
      seaside,
      seasonal,
      festival,
      noRain,
      quiet,
      dateYmd, // 📅 미래 기준일이면 date 방출 + ☔ 미방출(§6.8)
    });
    const url = qs ? `/api/random?${qs}` : "/api/random";
    void runDraw(url, isRedraw, true); // 전국 랜덤 → 앵커 갱신
  }

  // 🔭 빈 곳에서 뽑기(§7.11) — 미방문 ∩ 한적 시·군·구에서. store.ready 게이트(방문 로드 후라야
  //   exclude 정확). conqueredSigunguCodes 는 koreaMap 의존이라 클릭 시에만 동적 로드(홈 번들 보호).
  //   로컬 pending 으로 runDraw 진입 전 이중 클릭 창을 막고, import 실패는 기존 에러 상태로 커밋.
  async function runEmptySpot() {
    // store.synced: 로그인 사용자의 기기 간 방문(서버 병합)까지 반영돼야 exclude 가 정확(§7.11).
    if (!store.ready || !store.synced || emptySpotPending) return;
    setEmptySpotPending(true);
    try {
      const { conqueredSigunguCodes } = await import("@/lib/conquer");
      const exclude = conqueredSigunguCodes(store.visited); // 정렬은 빌더가 담당(쿼리 결정성)
      void runDraw(`/api/random?${buildEmptySpotQuery(exclude)}`, false, true);
    } catch {
      setStatus({
        kind: "error",
        error: { error: "빈 곳 정보를 불러오지 못했어요 — 다시 시도해 주세요." },
      });
    } finally {
      setEmptySpotPending(false);
    }
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

  // 🧭 반나절 코스 만들기(M20) — 현재 결과 place 를 앵커로 전체 코스 생성. 재클릭 = 전체 재생성.
  function openCourse() {
    if (status.kind !== "ok") return;
    const p = status.data.place;
    if (p.lat == null || p.lng == null) return; // 좌표 없으면 애초에 버튼 미렌더(가드 중복)
    void runCourse({ title: p.title, lat: p.lat, lng: p.lng, contentId: p.contentId });
  }

  // 코스 fetch — courseTokenRef 로 최신만 커밋(뽑기 시작·연타 시 옛 코스 무효화).
  async function runCourse(anchor: CourseAnchor) {
    const token = ++courseTokenRef.current;
    setCourse({ kind: "loading", anchor });
    const qs = buildCourseQuery(anchor.lat, anchor.lng, {
      exclude: [anchor.contentId], // 앵커 자신 재등장 방지(위치 조회는 기준점도 반환)
      dateYmd, // 📅 미래 기준일이면 date — 🍃 헤더 배지 기준일만, 코스 구성 무변(§6.8)
    });
    try {
      const res = await fetch(`/api/course?${qs}`, { cache: "no-store" });
      if (token !== courseTokenRef.current) return;
      if (!res.ok) {
        const err = (await res.json().catch(() => ({
          error: "코스를 불러오지 못했어요.",
        }))) as ErrorResponse;
        if (token !== courseTokenRef.current) return;
        setCourse({ kind: "error", message: err.error });
        return;
      }
      const data = (await res.json()) as CourseResponse;
      if (token !== courseTokenRef.current) return;
      setCourse({ kind: "ok", anchor, data });
    } catch {
      if (token !== courseTokenRef.current) return;
      setCourse({
        kind: "error",
        message: "네트워크 오류 — 연결을 확인하고 다시 시도해 주세요.",
      });
    }
  }

  // 🧭 스텝 재뽑기 — 앵커∪현재 전 스텝 exclude 로 그 슬롯만 다시 뽑아 교체. 실패는 throw(패널이 행 에러).
  async function redrawCourseStep(index: number) {
    if (course.kind !== "ok") return;
    const { anchor, data } = course;
    const token = courseTokenRef.current; // 이 재뽑기 시작 시점의 코스 순번(runCourse 토큰 가드와 대칭)
    const slot = data.steps[index].slot;
    const excludeIds = [
      anchor.contentId,
      ...data.steps.map((s) => s.place.contentId),
    ];
    const qs = buildCourseQuery(anchor.lat, anchor.lng, {
      slot,
      exclude: excludeIds,
    });
    const res = await fetch(`/api/course?${qs}`, { cache: "no-store" });
    if (!res.ok) {
      // 서버 확정 문구(§7.10 "주변에서 새로 보여드릴 곳을…")를 그대로 패널로 — 전체 코스 에러 경로와 대칭.
      const err = (await res.json().catch(() => ({
        error: "주변에서 새로 보여드릴 곳을 찾지 못했어요.",
      }))) as ErrorResponse;
      throw new Error(err.error);
    }
    const { step } = (await res.json()) as CourseStepResponse;
    // 그 사이 새 뽑기·전체 재생성으로 코스가 바뀌었으면 stale 스텝 병합 금지(kind==="ok" 만으론 C1→C2 를 못 막음).
    if (token !== courseTokenRef.current) return;
    setCourse((prev) =>
      prev.kind === "ok"
        ? {
            ...prev,
            data: {
              ...prev.data,
              steps: prev.data.steps.map((s, i) => (i === index ? step : s)),
            },
          }
        : prev,
    );
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
    areas.size > 0 ||
    types.size > 0 ||
    seaside ||
    seasonal ||
    festival ||
    noRain ||
    quiet;

  // 🧩 발 들인 시·도 정복 pill(헤더) — 홈 히어로 타일과 같은 출처(areaCode 기준).
  const conqueredAreas = visitedAreaCodes(store.visited).size;
  const conqueredPct = Math.round((conqueredAreas / AREA_CODES.length) * 100);

  return (
    <main className="mx-auto w-full max-w-[1140px] flex-1 px-4 pb-16 pt-6 sm:px-5">
      <div className="mb-3 flex items-center justify-end gap-2">
        <InstallButton />
        <AuthButtons />
      </div>

      <header className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight">🎲 어디든</h1>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            어디 갈지 고민될 때, 운명에 맡겨 — 전국 어디든 같은 출발선.
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

      <StoryBanner />

      <MapHero
        visited={store.visited}
        storeReady={store.ready}
        storeSynced={store.synced}
        filledArea={filledArea}
        onEmptySpot={runEmptySpot}
        emptySpotPending={emptySpotPending}
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
                quiet={quiet}
                dateYmd={dateYmd}
                onToggleArea={toggleArea}
                onToggleType={toggleType}
                onToggleSeaside={() => setSeaside((v) => !v)}
                onToggleSeasonal={() => setSeasonal((v) => !v)}
                onToggleFestival={() => setFestival((v) => !v)}
                onToggleNoRain={() => setNoRain((v) => !v)}
                onToggleQuiet={() => setQuiet((v) => !v)}
                onSelectDate={setDateYmd}
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
                onOpenCourse={
                  status.data.place.lat != null &&
                  status.data.place.lng != null
                    ? openCourse
                    : null
                }
                courseLoading={course.kind === "loading"}
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

          {/* 🧭 반나절 코스(M20) — 결과 aria-live 컨테이너 밖(중첩·통째 낭독 방지), 결과 있을 때만 */}
          {status.kind === "ok" && course.kind !== "idle" && (
            <CoursePanel
              state={course}
              onRedrawStep={redrawCourseStep}
              onRetry={openCourse}
            />
          )}
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

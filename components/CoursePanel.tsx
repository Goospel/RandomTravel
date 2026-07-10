"use client";

import { useState } from "react";
import type { CourseResponse } from "@/types/tour";
import {
  COURSE_SLOTS,
  courseLegs,
  courseTotalM,
  needsDriveHint,
} from "@/lib/course";
import { formatKm } from "@/lib/geo";
import { fmtYmd } from "@/lib/kst";
import { kakaoMapLink } from "@/lib/mapLink";

// 🧭 반나절 코스 타임라인(M20, §7.10) — 표시 전용. 상태(생성 lifecycle·경합 가드)는 page 소유,
//   패널은 콜백 주입. 스텝 재뽑기의 그 행 로딩·에러만 패널 로컬(전역 상태로 끌어올릴 이유 없음).

/** 코스 앵커(뽑힌 결과 place) — 재뽑기 exclude·헤더 라벨용. */
export type CourseAnchor = {
  title: string;
  lat: number;
  lng: number;
  contentId: string;
};

/** page 가 소유하는 코스 생성 상태 — 패널은 loading/ok/error 를 렌더(idle 은 게이트로 미렌더). */
export type CourseState =
  | { kind: "idle" }
  | { kind: "loading"; anchor: CourseAnchor }
  | { kind: "ok"; anchor: CourseAnchor; data: CourseResponse }
  | { kind: "error"; message: string };

const slotMeta = (slot: string) =>
  COURSE_SLOTS.find((s) => s.slot === slot) ?? {
    label: "장소",
    emoji: "📍",
  };

export function CoursePanel({
  state,
  onRedrawStep,
  onRetry,
}: {
  state: CourseState;
  /** 스텝 i 재뽑기 — 성공 시 page 가 그 스텝 교체, 실패는 throw(패널이 그 행 에러 표시). */
  onRedrawStep: (index: number) => Promise<void>;
  /** 에러 상태 "다시 시도" — 전체 코스 재생성. */
  onRetry: () => void;
}) {
  const [busy, setBusy] = useState<number | null>(null); // 재뽑기 중인 행
  // 재뽑기 실패한 행 + 서버 확정 문구(§7.10). 행 안내·live 통지 공용(하드코딩 대신 서버 메시지).
  const [rowErr, setRowErr] = useState<{ idx: number; msg: string } | null>(null);
  const [live, setLive] = useState(""); // sr-only 통지
  const [prevKind, setPrevKind] = useState(state.kind);

  // 새 코스 준비/에러 전환에만 통지·행 상태 리셋 — "이전 렌더 정보 저장" 패턴(effect 아님,
  //   재뽑기는 kind 무변이라 안 걸림). setState-in-effect 회피(React 권장: 렌더 중 prop 변화 조정).
  if (prevKind !== state.kind) {
    setPrevKind(state.kind);
    setBusy(null);
    setRowErr(null);
    setLive(
      state.kind === "ok"
        ? "반나절 코스가 준비됐어요."
        : state.kind === "error"
          ? state.message
          : "",
    );
  }

  if (state.kind === "idle") return null;

  const wrap =
    "mt-4 w-full rounded-2xl border border-zinc-200 bg-white p-4 shadow-[0_6px_20px_-14px_rgba(20,40,30,0.3)] dark:border-zinc-800 dark:bg-zinc-900";

  async function handleRedraw(i: number) {
    setBusy(i);
    setRowErr(null);
    const label = state.kind === "ok" ? slotMeta(state.data.steps[i].slot).label : "";
    try {
      await onRedrawStep(i);
      setLive(`${label}를 다시 뽑았어요.`); // 라벨(볼거리·식사·카페)은 모두 모음 종결 → "를"
    } catch (e) {
      // 서버 확정 문구를 그대로(page.redrawCourseStep 이 err.error 를 던짐), 없으면 스펙 폴백.
      const msg =
        e instanceof Error && e.message
          ? e.message
          : "주변에서 새로 보여드릴 곳을 찾지 못했어요.";
      setRowErr({ idx: i, msg });
      setLive(msg);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className={wrap}>
      {/* 컨테이너 밖(page 결과 aria-live) 이라 중첩 아님 — 코스 준비·재뽑기·에러만 통지 */}
      <p className="sr-only" aria-live="polite">
        {live}
      </p>

      {state.kind === "loading" && (
        <div className="flex items-center gap-2 py-1 text-sm font-semibold text-zinc-500 dark:text-zinc-400">
          <Spinner />
          반나절 코스를 짜는 중…
        </div>
      )}

      {state.kind === "error" && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-center text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <p className="font-semibold">⚠️ {state.message}</p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-2 rounded-lg border border-amber-300 bg-white px-3.5 py-2 text-xs font-bold text-amber-700 transition-colors hover:bg-amber-100 dark:border-amber-800 dark:bg-zinc-900 dark:hover:bg-zinc-800"
          >
            다시 시도
          </button>
        </div>
      )}

      {state.kind === "ok" && (
        <Timeline
          data={state.data}
          anchorTitle={state.anchor.title}
          anchorLat={state.anchor.lat}
          anchorLng={state.anchor.lng}
          busy={busy}
          rowErr={rowErr}
          onRedraw={handleRedraw}
        />
      )}
    </section>
  );
}

function Timeline({
  data,
  anchorTitle,
  anchorLat,
  anchorLng,
  busy,
  rowErr,
  onRedraw,
}: {
  data: CourseResponse;
  anchorTitle: string;
  anchorLat: number;
  anchorLng: number;
  busy: number | null;
  rowErr: { idx: number; msg: string } | null;
  onRedraw: (i: number) => void;
}) {
  // 다리 = 앵커→스텝1→스텝2→… 인접 직선거리(legs[i] = 스텝 i 앞의 다리).
  const points = [
    { lat: anchorLat, lng: anchorLng },
    ...data.steps.map((s) => ({ lat: s.place.lat, lng: s.place.lng })),
  ];
  const legs = courseLegs(points);
  const total = courseTotalM(legs);
  const drive = needsDriveHint(total);
  const c = data.congestion;

  return (
    <div>
      {/* 헤더 — 시점 표현 금지(§7.9 원칙 5). 🍃 배지 + 총 이동거리(+🚗 힌트) */}
      <h3 className="text-base font-extrabold leading-snug">
        {anchorTitle}에서의 반나절 코스
      </h3>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
        {c && (
          <span className="rounded-full bg-lime-50 px-2.5 py-1 font-bold text-lime-700 dark:bg-lime-950 dark:text-lime-300">
            🍃 {c.sigunguName} · {fmtYmd(c.targetYmd)} 한적 예측 · 집중률 하위{" "}
            {c.pctBelow}%
            {c.baseYmd < c.targetYmd && ` (${fmtYmd(c.baseYmd)} 데이터)`}
          </span>
        )}
        <span className="rounded-full bg-zinc-100 px-2.5 py-1 font-bold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
          총 {formatKm(total)}
          {drive && " · 🚗 차로 이동 기준"}
        </span>
      </div>

      {data.notice && (
        <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
          ⚠️ {data.notice}
        </p>
      )}

      {/* 앵커 행 — 고정 출발점 */}
      <ol className="mt-3">
        <li className="flex items-center gap-2.5 py-1.5">
          <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-emerald-100 text-sm dark:bg-emerald-950">
            🚩
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
              출발
            </p>
            <p className="truncate text-sm font-semibold">{anchorTitle}</p>
          </div>
        </li>

        {data.steps.map((step, i) => {
          const meta = slotMeta(step.slot);
          const leg = legs[i];
          const mapHref = kakaoMapLink(step.place.title, step.place.lat, step.place.lng);
          const isBusy = busy === i;
          const isErr = rowErr?.idx === i;
          return (
            <li key={`${step.slot}-${step.place.contentId}`}>
              {leg != null && (
                <div className="ml-4 flex items-center gap-1 py-0.5 text-[11px] font-semibold text-zinc-400">
                  <span aria-hidden>↓</span> {formatKm(leg)}
                </div>
              )}
              <div
                className={`flex items-center gap-2.5 rounded-xl py-1.5 pl-0 pr-1 ${
                  isErr ? "bg-amber-50 dark:bg-amber-950/40" : ""
                }`}
              >
                <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-zinc-100 text-sm dark:bg-zinc-800">
                  {meta.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400">
                    {meta.label}
                  </p>
                  {mapHref ? (
                    <a
                      href={mapHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block truncate text-sm font-semibold text-emerald-700 hover:underline dark:text-emerald-300"
                    >
                      {step.place.title}
                    </a>
                  ) : (
                    <p className="truncate text-sm font-semibold">
                      {step.place.title}
                    </p>
                  )}
                  {step.place.address && (
                    <p className="line-clamp-1 text-xs text-zinc-500 dark:text-zinc-400">
                      {step.place.address}
                    </p>
                  )}
                  {isErr && (
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      {rowErr.msg}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onRedraw(i)}
                  disabled={isBusy}
                  aria-label={`${meta.label} 다시 뽑기`}
                  className="flex h-11 w-11 flex-none items-center justify-center rounded-full text-base text-zinc-500 transition-colors hover:bg-zinc-100 disabled:opacity-60 dark:text-zinc-400 dark:hover:bg-zinc-800"
                >
                  {isBusy ? <Spinner /> : <span aria-hidden>↻</span>}
                </button>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden
      className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent"
    />
  );
}

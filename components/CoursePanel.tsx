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
import { Icon, type IconName } from "@/components/icons";

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

const slotMeta = (slot: string): { label: string; icon: IconName } =>
  COURSE_SLOTS.find((s) => s.slot === slot) ?? { label: "장소", icon: "pin" };

/** 스텝·출발 아이콘 타일(32px 원) — 출발만 primary-soft, 스텝은 surface-2. */
function StepIcon({ icon, anchor = false }: { icon: IconName; anchor?: boolean }) {
  return (
    <span
      className={`flex h-8 w-8 flex-none items-center justify-center rounded-full ${
        anchor ? "bg-g-primary-soft text-g-primary-text" : "bg-g-surface-2 text-g-text-2"
      }`}
    >
      <Icon name={icon} size={15} />
    </span>
  );
}

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
    <section className="animate-card-reveal w-full rounded-2xl border border-g-border bg-g-surface p-4">
      {/* 컨테이너 밖(page 결과 aria-live) 이라 중첩 아님 — 코스 준비·재뽑기·에러만 통지 */}
      <p className="sr-only" aria-live="polite">
        {live}
      </p>

      {state.kind === "loading" && (
        <div className="flex items-center gap-2 py-1 text-[13px] font-medium text-g-text-2">
          <Spinner />
          반나절 코스를 짜는 중…
        </div>
      )}

      {state.kind === "error" && <CourseError message={state.message} onRetry={onRetry} />}

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

/** 코스 생성 실패 — warning 톤 + 전체 재생성 버튼. */
function CourseError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-xl bg-g-warning-soft p-3 text-center text-[13px] text-g-warning-text">
      <p className="inline-flex items-center gap-1.5 font-medium">
        <Icon name="warning" size={13} />
        {message}
      </p>
      {/* page.tsx ErrorPanel 의 '조건 초기화'와 같은 규격 — 같은 성격의 복구 버튼이다. */}
      <button
        type="button"
        onClick={onRetry}
        className="mt-2 block w-full rounded-[14px] border border-g-warning-text/40 px-3.5 py-2 text-[12px] font-medium [corner-shape:squircle] hover:bg-g-surface"
      >
        다시 시도
      </button>
    </div>
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
  // 결과 엽서(ResultCard)의 사각 스탬프 배지와 **같은 규격**이어야 한다 — 코스 패널은 엽서 바로
  // 밑에 붙어서, 같은 🍃 한적 예측 정보가 두 모양(pill vs 사각)으로 보이면 다른 정보로 읽힌다.
  const badge =
    "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-[9px] py-[5px] text-[11px] font-bold leading-[1.2]";

  return (
    <div>
      {/* 헤더 — 시점 표현 금지(§7.9 원칙 5). 🍃 배지 + 총 이동거리(+🚗 힌트) */}
      <h3 className="font-display text-[16px] font-bold leading-[1.4] tracking-[-0.03em]">
        {anchorTitle}에서의 반나절 코스
      </h3>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {c && (
          <span className={`${badge} bg-g-success-soft text-g-success-text`}>
            <Icon name="leaf" size={12} />
            {c.sigunguName} · {fmtYmd(c.targetYmd)} 한적 예측 · 집중률 하위 {c.pctBelow}%
            {c.baseYmd < c.targetYmd && ` (${fmtYmd(c.baseYmd)} 데이터)`}
          </span>
        )}
        <span className={`${badge} bg-g-ring-track text-g-text-3`}>
          <Icon name="car" size={12} />총 {formatKm(total)}
          {drive && " · 차로 이동 기준"}
        </span>
      </div>

      {data.notice && (
        <p className="mt-2 inline-flex items-center gap-1.5 text-[12px] text-g-warning-text">
          <Icon name="warning" size={12} />
          {data.notice}
        </p>
      )}

      {/* 앵커 행 — 고정 출발점 */}
      <ol className="mt-3.5">
        <li className="flex items-center gap-2.5 py-1.5">
          <StepIcon icon="start" anchor />
          <div className="min-w-0">
            <p className="text-[11px] font-bold leading-[1.3] text-g-primary-text">출발</p>
            <p className="mt-0.5 truncate text-[15px] font-medium leading-[1.4]">
              {anchorTitle}
            </p>
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
                <div className="ml-4 py-0.5 text-[11px] font-medium leading-[1.4] text-g-text-2">
                  ↓ {formatKm(leg)}
                </div>
              )}
              <div
                className={`flex items-center gap-2.5 rounded-lg py-1.5 pl-0 pr-1 ${
                  isErr ? "bg-g-warning-soft" : ""
                }`}
              >
                <StepIcon icon={meta.icon} />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold leading-[1.3] text-g-text-2">
                    {meta.label}
                  </p>
                  {mapHref ? (
                    <a
                      href={mapHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-0.5 block truncate text-[15px] font-medium leading-[1.4] text-g-primary hover:underline"
                    >
                      {step.place.title}
                    </a>
                  ) : (
                    <p className="mt-0.5 truncate text-[15px] font-medium leading-[1.4]">
                      {step.place.title}
                    </p>
                  )}
                  {step.place.address && (
                    <p className="mt-0.5 line-clamp-1 text-[12px] leading-[1.5] text-g-text-2">
                      {step.place.address}
                    </p>
                  )}
                  {isErr && (
                    <p className="text-[12px] text-g-warning-text">{rowErr.msg}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onRedraw(i)}
                  disabled={isBusy}
                  aria-label={`${meta.label} 다시 뽑기`}
                  className="flex h-11 w-11 flex-none items-center justify-center rounded-full text-g-text-2 hover:bg-g-surface-2 hover:text-g-primary disabled:opacity-60"
                >
                  {isBusy ? <Spinner /> : <Icon name="refresh" size={17} />}
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
      className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-g-primary border-t-transparent"
    />
  );
}

"use client";

import { AREA_CODES, CONTENT_TYPES } from "@/lib/constants";
import { buildRandomQuery } from "@/lib/query";
import { dateChips } from "@/lib/tripDate";
import { kstYmd } from "@/lib/kst";
import { useCandidateCount } from "@/hooks/useCandidateCount";
import { Icon, type IconName } from "@/components/icons";

// 🎯 조건 패널(Genesis 리스킨) — indigo pill 칩 + 실시간 후보 수 배지 + 바다 잠금 인라인 설명.
//   후보 수는 조건이 바뀔 때마다 /api/random/count 로 근사 집계(동적 조건은 정성 라벨).

const CHIP_BASE =
  "whitespace-nowrap rounded-full border px-3 py-1.5 text-[12px] font-medium leading-[1.2]";

function chip(on: boolean): string {
  return `${CHIP_BASE} ${
    on
      ? "border-g-primary bg-g-primary text-g-on-primary"
      : "border-g-border bg-g-surface text-g-text-2 hover:border-g-primary hover:text-g-primary"
  }`;
}

const GROUP_LABEL = "text-[12px] font-bold leading-none text-g-text-2";

/** 실시간 후보 수 배지 — 조건이 얼마나 넓은지 투명하게 보여준다. */
function CandidateBadge({ query }: { query: string }) {
  const count = useCandidateCount(query);
  const pill =
    "whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] font-medium leading-[1.3]";
  const neutral = `${pill} border border-g-border bg-g-surface text-g-text-2`;

  if (count.status === "loading") {
    return (
      <span aria-live="polite" className={neutral}>
        후보 세는 중…
      </span>
    );
  }
  if (count.status === "dynamic") {
    return (
      <span aria-live="polite" className={neutral}>
        조건에 맞는 곳에서
      </span>
    );
  }
  // count
  if (count.totalCount === 0) {
    return (
      <span
        aria-live="polite"
        className={`${pill} bg-g-warning-soft text-g-warning-text`}
      >
        조건이 좁아요 · 0곳
      </span>
    );
  }
  return (
    <span aria-live="polite" className={neutral}>
      ≈ {count.totalCount.toLocaleString("ko-KR")}곳{count.approx ? "+" : ""} 후보
    </span>
  );
}

/** 추가 조건 토글 1개 (🌊·🦀·🎪·☔·🍃). locked=미래 기준일이라 잠긴 상태(☔ 오늘 전용, §6.8) */
function ExtraToggle({
  on,
  onToggle,
  icon,
  label,
  desc,
  locked = false,
}: {
  on: boolean;
  onToggle: () => void;
  icon: IconName;
  label: string;
  desc: string;
  locked?: boolean;
}) {
  const card = "flex flex-col items-start gap-[3px] rounded-lg border px-3 py-2.5 text-left";
  const title = "inline-flex items-center gap-1.5 text-[13px] font-bold leading-[1.3]";

  if (locked) {
    // 잠긴 토글은 눌리지 않은 것으로 취급(🌊 관례) — 선택 state 는 상위에서 보존, 오늘 복귀 시 복원.
    return (
      <div
        aria-disabled
        className={`${card} cursor-not-allowed border-g-border bg-g-surface-2 opacity-70`}
      >
        <span className={`${title} text-g-text-2`}>
          <Icon name={icon} size={14} />
          {label}
          <Icon name="lock" size={12} />
        </span>
        <span className="text-[12px] leading-[1.5] text-g-text-2">{desc}</span>
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={on}
      className={`${card} ${
        on
          ? "border-g-primary bg-g-primary-soft"
          : "border-g-border bg-g-surface hover:border-g-primary"
      }`}
    >
      <span className={`${title} text-g-text`}>
        <Icon name={icon} size={14} className={on ? "text-g-primary-text" : "text-g-text-2"} />
        {label}
      </span>
      <span className="text-[12px] leading-[1.5] text-g-text-2">{desc}</span>
    </button>
  );
}

/** 🔒 인라인 잠금 설명 — 바다/날씨가 왜 다른 칸을 잠갔는지. */
function LockNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-1.5 rounded-lg bg-g-primary-soft px-3 py-2 text-[12px] leading-[1.6] text-g-primary-text">
      <Icon name="lock" size={13} className="mt-0.5" />
      <span>{children}</span>
    </div>
  );
}

export function FilterPanel({
  selectedAreas,
  selectedTypes,
  seaside,
  seasonal,
  festival,
  noRain,
  quiet,
  scatter,
  dateYmd,
  onToggleArea,
  onToggleType,
  onToggleSeaside,
  onToggleSeasonal,
  onToggleFestival,
  onToggleNoRain,
  onToggleQuiet,
  onToggleScatter,
  onSelectDate,
  onClear,
}: {
  selectedAreas: Set<number>;
  selectedTypes: Set<number>;
  seaside: boolean;
  seasonal: boolean;
  festival: boolean;
  noRain: boolean;
  quiet: boolean;
  /** ⚖️ 분산 모드(§6.9B). 필터가 아니라 분포 축 — 후보 수에 영향 없음 */
  scatter: boolean;
  /** 📅 선택 기준일 YYYYMMDD(§6.8). null = 오늘(기본) */
  dateYmd: string | null;
  onToggleArea: (code: number) => void;
  onToggleType: (code: number) => void;
  onToggleSeaside: () => void;
  onToggleSeasonal: () => void;
  onToggleFestival: () => void;
  onToggleNoRain: () => void;
  onToggleQuiet: () => void;
  onToggleScatter: () => void;
  onSelectDate: (ymd: string | null) => void;
  onClear: () => void;
}) {
  // ⚖️ 는 후보를 안 줄이지만 '기본과 다른 상태'라 초기화 대상 — 📅 날짜 칩과 같은 취급.
  const hasAny =
    selectedAreas.size > 0 ||
    selectedTypes.size > 0 ||
    seaside ||
    seasonal ||
    festival ||
    noRain ||
    quiet ||
    scatter;

  // 📅 방문 시점 칩(§6.8) — 조건 모드 진입은 마운트 후(pure 기본)라 렌더 시 new Date() 안전(SSR 아님).
  //    선택 ymd 가 현재 칩에 없으면(자정 통과·과거화) '오늘'로 간주 — 소리 없는 날짜 변경 방지.
  const now = new Date();
  const chips = dateChips(now);
  const todayYmd = kstYmd(now);
  const activeYmd =
    dateYmd && dateYmd !== todayYmd && chips.some((c) => c.ymd === dateYmd)
      ? dateYmd
      : null;
  const rainLocked = activeYmd != null; // 미래 기준일 → ☔ 오늘 전용 잠금

  // 후보 수 조회용 쿼리 — 뽑기와 같은 파라미터(buildRandomQuery)를 재사용해 서버와 일치.
  //   activeYmd(stale 정리분)를 넘겨 count 경로도 date 방출/noRain 미방출을 뽑기와 일치시킨다.
  // ⚠️ scatter 는 **일부러 안 넘긴다**(§6.9B) — ⚖️ 는 풀이 아니라 분포만 바꾸므로 후보 수가
  //   같아야 하고(불변식), 넣으면 같은 풀의 count URL 이 갈라져 캐시만 쪼개진다.
  //   "뽑기·count 쿼리 일치" 관례의 유일한 의도적 예외. 여기에 scatter 를 추가하지 말 것.
  const countQuery = buildRandomQuery("filtered", selectedAreas, selectedTypes, {
    seaside,
    seasonal,
    festival,
    noRain,
    quiet,
    dateYmd: activeYmd,
    todayYmd,
  });

  return (
    <div className="flex w-full flex-col gap-4 rounded-xl border border-g-border bg-g-surface-2 p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="font-display text-[15px] font-bold leading-[1.3] tracking-[-0.02em]">
          조건 고르기
        </span>
        <CandidateBadge query={countQuery} />
      </div>

      <section className="flex flex-col gap-2">
        <h3 id="filter-area-label" className={GROUP_LABEL}>
          지역
        </h3>
        <div
          role="group"
          aria-labelledby="filter-area-label"
          className="flex flex-wrap gap-1.5"
        >
          {AREA_CODES.map((a) => (
            <button
              key={a.code}
              type="button"
              onClick={() => onToggleArea(a.code)}
              aria-pressed={selectedAreas.has(a.code)}
              className={chip(selectedAreas.has(a.code))}
            >
              {a.name}
            </button>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h3 id="filter-type-label" className={GROUP_LABEL}>
          테마
        </h3>
        <div
          role="group"
          aria-labelledby="filter-type-label"
          className="flex flex-wrap gap-1.5"
        >
          {CONTENT_TYPES.map((c) => {
            const on = !seaside && selectedTypes.has(c.code);
            return (
              <button
                key={c.code}
                type="button"
                onClick={() => onToggleType(c.code)}
                // 바다 ON이면 테마가 무시되므로 '눌림'을 보고하지 않는다(안내문과 일치).
                aria-pressed={seaside ? undefined : selectedTypes.has(c.code)}
                disabled={seaside}
                className={
                  seaside
                    ? `${CHIP_BASE} inline-flex cursor-not-allowed items-center gap-1 border-g-border bg-g-surface-2 text-g-neutral`
                    : chip(on)
                }
              >
                {c.name}
                {seaside && <Icon name="lock" size={11} />}
              </button>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h3
          id="filter-date-label"
          className={`inline-flex items-center gap-1.5 ${GROUP_LABEL}`}
        >
          <Icon name="calendar" size={13} />
          언제 가요?
        </h3>
        <div
          role="group"
          aria-labelledby="filter-date-label"
          className="flex flex-wrap gap-1.5"
        >
          {chips.map((c) => {
            // '오늘' 칩은 null 로 저장(기준일=오늘과 동일 → 파라미터 생략). 미래 칩만 그 ymd 저장.
            const active =
              c.ymd === activeYmd || (activeYmd === null && c.key === "today");
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => onSelectDate(c.key === "today" ? null : c.ymd)}
                aria-pressed={active}
                className={chip(active)}
              >
                {c.label}
              </button>
            );
          })}
        </div>
        {/* 상시 마이크로카피 — '날짜는 필터인가요?' 오해 선제 답변 + 칩 하이라이트/완전 랜덤 시각 모순 해소 */}
        <p className="text-[11px] leading-[1.6] text-g-text-2">
          날짜는 조건을 판정할 <b className="font-bold">기준일</b>이에요 — 날짜만으론
          후보가 줄지 않아요.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className={GROUP_LABEL}>추가 조건</h3>
        <div className="grid grid-cols-2 gap-2">
          <ExtraToggle
            on={seaside}
            onToggle={onToggleSeaside}
            icon="wave"
            label="바다"
            desc="해수욕장·섬·항구·해안"
          />
          <ExtraToggle
            on={seasonal}
            onToggle={onToggleSeasonal}
            icon="pot"
            label="제철 산지"
            desc="이번 달 제철 재료 산지"
          />
          <ExtraToggle
            on={festival}
            onToggle={onToggleFestival}
            icon="tent"
            label="축제 중"
            desc="오늘 진행 중인 축제"
          />
          <ExtraToggle
            on={noRain}
            onToggle={onToggleNoRain}
            icon="umbrella"
            label="비 안 오는 곳"
            desc="지금 비 안 오는 지역"
            locked={rainLocked}
          />
          <ExtraToggle
            on={quiet}
            onToggle={onToggleQuiet}
            icon="leaf"
            label="한적한 곳"
            desc="관광지 집중률 예측 기반, 안 붐빌 곳"
          />
        </div>
      </section>

      {/* ⚖️ 분산 모드(§6.9B) — '추가 조건' 그리드와 분리된 줄. 필터가 아니라 분포 축이라
          같은 격자에 넣으면 후보를 줄이는 조건으로 오해된다. 🌊 는 이미 count 가중 축이라 배타. */}
      <section className="flex flex-col gap-2">
        <ExtraToggle
          on={scatter}
          onToggle={onToggleScatter}
          icon="scales"
          label="분산 모드"
          // 🌊 로 잠겼으면 켜져 있어도 꺼진 것으로 취급(☔ 관례) → 설명도 OFF 쪽으로.
          desc={
            scatter && !seaside
              ? "방문자 적은 시·도가 더 자주 나와요 (약 1~2개월 전 공공 방문자 집계 기준)"
              : "끄면 17개 시·도 같은 확률"
          }
          locked={seaside}
        />
      </section>

      {seaside && (
        <LockNote>
          바다를 켜면 테마는 <b className="font-bold">관광지로 고정</b>돼요 — 그래서
          다른 테마 칸이 잠겼어요.
        </LockNote>
      )}

      {rainLocked && (
        <LockNote>
          <b className="font-bold">&lsquo;비 안 오는 곳&rsquo;</b>은 지금 날씨만 알 수
          있어요 — 그래서 오늘 뽑기에서만 켤 수 있어요.
        </LockNote>
      )}

      <div className="text-[12px] leading-none text-g-text-2">
        {/* 날짜만 골라도(hasAny=false) 초기화 대상은 있으므로 버튼 노출 — dateYmd 도 게이트(§6.8) */}
        {hasAny || dateYmd != null ? (
          <button
            type="button"
            onClick={onClear}
            className="underline underline-offset-2 hover:text-g-primary"
          >
            선택 초기화
          </button>
        ) : (
          "아무것도 안 고르면 전국·모든 테마에서 완전 랜덤"
        )}
      </div>
    </div>
  );
}

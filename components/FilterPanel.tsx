"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { AREA_CODES, CONTENT_TYPES, HOME_RANGE_KM } from "@/lib/constants";
import { dateChips } from "@/lib/tripDate";
import type { HomeSigungu } from "@/hooks/useHomeSigungu";
import { Icon, type IconName } from "@/components/icons";

// 🏠 거주지 목록(~20KB)은 고를 때만 필요하다 — 홈 초기 번들에 넣지 않는다(§7.17E).
const HomePicker = dynamic(() => import("@/components/HomePicker"), {
  ssr: false,
  loading: () => <span className="text-[12px] text-g-text-2">불러오는 중…</span>,
});

// 🎫 탑승 조건 — 캡슐 칩 + 1줄 추가 조건 토글.
//   설명문은 전부 걷어냈다 — 화면이 이미 보여주는 걸 문장으로 반복하지 않는다(designGuide 문구 톤).
//
//   M32(§7.21)부터 이건 **조건 시트(FilterSheet)의 내용물**이다: 티켓 카드 안 인셋이던 시절엔
//   이 패널 하나가 959px 을 먹어 주 CTA 를 첫 화면 밖으로 밀어냈다(실측 613 → 1,572px).
//   그래서 카드 껍데기·제목 줄·후보 배지·초기화 줄은 전부 시트로 올라갔고 조건 자체만 남는다.
//   기준일 파생(activeYmd)도 소유자(app/page.tsx)가 lib/tripDate.activeDateYmd 로 한 번만 하고
//   내려준다 — 요약 줄과 시트가 서로 다른 날짜를 말하면 표시·전송이 갈린다.

const CHIP_BASE =
  "whitespace-nowrap rounded-full border px-[13px] py-[7px] text-[12px] leading-[1.2]";

function chip(on: boolean): string {
  return `${CHIP_BASE} ${
    on
      ? "border-g-text bg-g-text font-bold text-g-on-primary"
      : "border-g-border bg-g-surface font-medium text-g-text-3 hover:border-g-primary hover:text-g-primary"
  }`;
}

/** 잠긴 칩 — 눌리지 않은 것으로 취급하고 잉크만 한 단 눌러 둔다(카운트 잉크 재사용). */
const CHIP_LOCKED = `${CHIP_BASE} inline-flex cursor-not-allowed items-center gap-1 border-g-border bg-g-surface-2 font-medium text-g-num`;

const GROUP_LABEL =
  "text-[11px] font-bold uppercase leading-none tracking-[0.1em] text-g-text-3";

/**
 * 추가 조건 토글 1개 (🌊·🐕·♿·🦀·🎪·☔·🍃·⚖️) — 아이콘 칩 + 라벨 **한 줄**.
 * 설명문은 없다: 왜 잠겼는지 같은 예외만 아래 LockNote 가 말한다.
 * locked = 다른 축이 이 칸을 무의미하게 만든 상태(☔ 오늘 전용·🏠 반경 등, §6.8·§6.11).
 */
function ExtraToggle({
  on,
  onToggle,
  icon,
  label,
  locked = false,
}: {
  on: boolean;
  onToggle: () => void;
  icon: IconName;
  label: string;
  locked?: boolean;
}) {
  const row =
    "flex items-center gap-[9px] rounded-2xl border p-3 text-left [corner-shape:squircle]";
  const chipBase =
    "inline-flex h-[26px] w-[26px] flex-none items-center justify-center rounded-lg";
  const title = "text-[13px] font-bold leading-[1.3]";

  if (locked) {
    // 잠긴 토글은 눌리지 않은 것으로 취급(🌊 관례) — 선택 state 는 상위에서 보존, 오늘 복귀 시 복원.
    return (
      <div
        aria-disabled
        className={`${row} cursor-not-allowed border-g-border bg-g-surface-2`}
      >
        <span className={`${chipBase} bg-g-surface text-g-num`}>
          <Icon name={icon} size={14} />
        </span>
        <span className={`${title} inline-flex items-center gap-1.5 text-g-num`}>
          {label}
          <Icon name="lock" size={11} />
        </span>
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={on}
      className={`${row} ${
        on
          ? "border-g-success-text bg-[#f3faf2]"
          : "border-g-border bg-g-surface hover:border-g-primary"
      }`}
    >
      <span
        className={`${chipBase} ${
          on ? "bg-g-success-soft text-g-success-text" : "bg-g-surface-2 text-g-text-3"
        }`}
      >
        <Icon name={icon} size={14} />
      </span>
      <span className={`${title} text-g-text`}>{label}</span>
    </button>
  );
}

/** 🔒 인라인 잠금 설명 — 바다/날씨가 왜 다른 칸을 잠갔는지. */
function LockNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-1.5 rounded-xl bg-g-primary-soft px-3 py-2 text-[12px] leading-[1.6] text-g-primary-text">
      <Icon name="lock" size={13} className="mt-0.5" />
      <span>{children}</span>
    </div>
  );
}

export function FilterPanel({
  selectedAreas,
  selectedTypes,
  seaside,
  pet,
  barrierFree,
  seasonal,
  festival,
  noRain,
  quiet,
  scatter,
  activeYmd,
  home,
  homeKm,
  homeSaving,
  onSelectHomeKm,
  onSaveHome,
  onToggleArea,
  onToggleType,
  onToggleSeaside,
  onTogglePet,
  onToggleBarrierFree,
  onToggleSeasonal,
  onToggleFestival,
  onToggleNoRain,
  onToggleQuiet,
  onToggleScatter,
  onSelectDate,
}: {
  selectedAreas: Set<number>;
  selectedTypes: Set<number>;
  seaside: boolean;
  /** 🐕 반려동물 동반(§6.11) — 대상 축. 켜면 지역·테마가 잠긴다(전국 전용) */
  pet: boolean;
  /** ♿ 무장애(§6.11) — 대상 축. 지역·테마·다른 조건과 그대로 조합 */
  barrierFree: boolean;
  seasonal: boolean;
  festival: boolean;
  noRain: boolean;
  quiet: boolean;
  /** ⚖️ 분산 모드(§6.9B). 필터가 아니라 분포 축 — 후보 수에 영향 없음 */
  scatter: boolean;
  /** 📅 조건으로 인정된 미래 기준일 YYYYMMDD(§6.8, activeDateYmd 통과분). null = 오늘(기본) */
  activeYmd: string | null;
  /** 🏠 거주지(§7.17). null = 비로그인 → 섹션 자체를 감춘다(회원 전용) */
  home: HomeSigungu | null;
  /** 🏠 선택한 거리 밴드 km. null = 제한 없음(기본) */
  homeKm: number | null;
  homeSaving: boolean;
  onSelectHomeKm: (km: number | null) => void;
  onSaveHome: (code: string) => void;
  onToggleArea: (code: number) => void;
  onToggleType: (code: number) => void;
  onToggleSeaside: () => void;
  onTogglePet: () => void;
  onToggleBarrierFree: () => void;
  onToggleSeasonal: () => void;
  onToggleFestival: () => void;
  onToggleNoRain: () => void;
  onToggleQuiet: () => void;
  onToggleScatter: () => void;
  onSelectDate: (ymd: string | null) => void;
}) {
  // 🏠 거주지 변경 UI 노출(로컬 UI 상태 — 저장값은 서버가 단일 출처).
  const [editingHome, setEditingHome] = useState(false);

  // 🏠 거주지 반경(§7.17) — 거주지 + 밴드가 둘 다 있어야 켜진 것. 켜지면 뽑기 경로가
  //   시·군·구 셀로 갈라져 지역·테마·나머지 조건이 서버에서 무시된다 → UI 도 잠근다.
  const homeOn = !!home?.code && homeKm != null;

  // 대상 축(🌊·🐕·♿)은 동시 1개(§6.11) — 하나 켜지면 나머지 둘은 잠긴다(잠긴 토글은
  //   눌리지 않은 것으로 취급 = ☔ 관례). 🐕 는 상류가 지역·타입을 안 받아 지역·테마까지 잠근다.
  const targetOn = seaside || pet || barrierFree;
  const areaLocked = pet || homeOn; // 🐕 = 전국 전용 · 🏠 = 거주지 반경이 지역을 정한다
  const typeLocked = seaside || pet || homeOn; // 🌊 = 관광지 고정 · 🐕·🏠 = 전 타입

  // 📅 방문 시점 칩(§6.8) — 시트는 사용자가 열 때만 마운트되므로 렌더 시 new Date() 안전(SSR 아님).
  //    activeYmd(자정 통과 stale 을 걸러낸 값)는 소유자가 내려준다 — 요약 줄과 같은 판정을 써야 한다.
  const chips = dateChips();
  const rainLocked = activeYmd != null || homeOn; // 미래 기준일 → ☔ 오늘 전용 잠금(🏠 도 잠금)

  return (
    <div className="flex w-full flex-col gap-4">

      {/* 🏠 집에서 갈 만한 곳(§7.17E) — 회원 전용이라 home=null(비로그인)이면 섹션이 없다. */}
      {home && (
        <section className="flex flex-col gap-2">
          <h3
            id="filter-home-label"
            className={`inline-flex items-center gap-1.5 ${GROUP_LABEL}`}
          >
            <Icon name="home" size={13} />
            집에서 얼마나?
          </h3>

          {home.code && !editingHome ? (
            <>
              <div
                role="group"
                aria-labelledby="filter-home-label"
                className="flex flex-wrap gap-1.5"
              >
                {[
                  { km: null, label: "제한 없음" },
                  { km: HOME_RANGE_KM.light, label: `가볍게 ${HOME_RANGE_KM.light}km` },
                  {
                    km: HOME_RANGE_KM.dayTrip,
                    label: `당일치기 ${HOME_RANGE_KM.dayTrip}km`,
                  },
                ].map((b) => (
                  <button
                    key={b.label}
                    type="button"
                    onClick={() => onSelectHomeKm(b.km)}
                    aria-pressed={homeKm === b.km}
                    className={chip(homeKm === b.km)}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] leading-[1.6] text-g-text-3">
                <b className="font-bold">{home.name}</b> 기준 <b className="font-bold">직선거리</b>
                예요 — 실제 이동 시간은 길·교통편에 따라 달라져요.{" "}
                <button
                  type="button"
                  onClick={() => setEditingHome(true)}
                  className="underline underline-offset-2 hover:text-g-primary"
                >
                  사는 곳 바꾸기
                </button>
              </p>
            </>
          ) : (
            <>
              <HomePicker
                current={home.code}
                saving={homeSaving}
                onSelect={(code) => {
                  onSaveHome(code);
                  setEditingHome(false);
                }}
              />
              <p className="text-[11px] leading-[1.6] text-g-text-3">
                사는 곳을 저장해 두면 <b className="font-bold">집에서 갈 만한 거리</b>로 좁혀
                뽑을 수 있어요.
              </p>
            </>
          )}
        </section>
      )}

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
              // 🐕 ON이면 지역이 무시되므로 '눌림'을 보고하지 않는다(안내문과 일치).
              aria-pressed={areaLocked ? undefined : selectedAreas.has(a.code)}
              disabled={areaLocked}
              className={
                areaLocked
                  ? CHIP_LOCKED
                  : chip(selectedAreas.has(a.code))
              }
            >
              {a.name}
              {areaLocked && <Icon name="lock" size={11} />}
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
            const on = !typeLocked && selectedTypes.has(c.code);
            return (
              <button
                key={c.code}
                type="button"
                onClick={() => onToggleType(c.code)}
                // 바다·반려동물 ON이면 테마가 무시되므로 '눌림'을 보고하지 않는다(안내문과 일치).
                aria-pressed={typeLocked ? undefined : selectedTypes.has(c.code)}
                disabled={typeLocked}
                className={
                  typeLocked
                    ? CHIP_LOCKED
                    : chip(on)
                }
              >
                {c.name}
                {typeLocked && <Icon name="lock" size={11} />}
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
          <Icon name="calendar" size={12} />
          날짜
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
                // 🏠 는 오늘 기준 뽑기라 기준일이 무시된다 — 눌림을 보고하지 않는다(☔ 관례).
                aria-pressed={homeOn ? undefined : active}
                disabled={homeOn}
                className={
                  homeOn
                    ? CHIP_LOCKED
                    : chip(active)
                }
              >
                {c.label}
                {homeOn && <Icon name="lock" size={11} />}
              </button>
            );
          })}
        </div>
        {/* 상시 마이크로카피 — '날짜는 필터인가요?' 오해 선제 답변(한 구절로 축약) */}
        <p className="text-[11px] leading-[1.6] text-g-text-3">
          조건을 판정할 <b className="font-bold">기준일</b>이에요
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
            locked={homeOn || (!seaside && targetOn)}
          />
          <ExtraToggle
            on={pet}
            onToggle={onTogglePet}
            icon="paw"
            label="반려동물 동반"
            locked={homeOn || (!pet && targetOn)}
          />
          <ExtraToggle
            on={barrierFree}
            onToggle={onToggleBarrierFree}
            icon="accessible"
            label="무장애 여행"
            locked={homeOn || (!barrierFree && targetOn)}
          />
          <ExtraToggle
            on={seasonal}
            onToggle={onToggleSeasonal}
            icon="pot"
            label="제철 산지"
            locked={homeOn}
          />
          <ExtraToggle
            on={festival}
            onToggle={onToggleFestival}
            icon="tent"
            label="축제 중"
            locked={homeOn}
          />
          <ExtraToggle
            on={noRain}
            onToggle={onToggleNoRain}
            icon="umbrella"
            label="비 안 오는 곳"
            locked={rainLocked}
          />
          {/* 🍃 '(예측)'은 지우면 안 된다(§6.7) — 라벨만 남기는 축약에서도 이 괄호가 유일한 고지다. */}
          <ExtraToggle
            on={quiet}
            onToggle={onToggleQuiet}
            icon="leaf"
            label="한적한 곳 (예측)"
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
          locked={targetOn || homeOn}
        />
      </section>

      {homeOn && (
        <LockNote>
          <b className="font-bold">집에서 갈 만한 거리</b>로 뽑을 땐 사는 곳 주변
          시·군·구에서 통째로 뽑아요 — 그래서 지역·테마·다른 조건 칸이 잠겼어요.{" "}
          <b className="font-bold">한적한 곳</b>만 함께 켤 수 있어요.
        </LockNote>
      )}

      {targetOn && !homeOn && (
        <LockNote>
          <b className="font-bold">바다·반려동물·무장애</b>는 서로 다른 목록에서 뽑아요
          — 한 번에 하나만 골라요.
        </LockNote>
      )}

      {seaside && !homeOn && (
        <LockNote>
          바다를 켜면 테마는 <b className="font-bold">관광지로 고정</b>돼요 — 그래서
          다른 테마 칸이 잠겼어요.
        </LockNote>
      )}

      {pet && !homeOn && (
        <LockNote>
          <b className="font-bold">반려동물 동반 목록</b>은 지역·테마로 나눠 받을 수
          없어요 — 그래서 전국에서 통째로 뽑고 지역·테마 칸이 잠겼어요. 명소를 먼저
          보여드리지만 카페·숙소·매장도 함께 나와요.
        </LockNote>
      )}

      {rainLocked && !homeOn && (
        <LockNote>
          <b className="font-bold">&lsquo;비 안 오는 곳&rsquo;</b>은 지금 날씨만 알 수
          있어요 — 그래서 오늘 뽑기에서만 켤 수 있어요.
        </LockNote>
      )}

    </div>
  );
}

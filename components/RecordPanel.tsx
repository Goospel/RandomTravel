"use client";

import { useState, type KeyboardEvent } from "react";
import type { SavedPlace, RevisitRating } from "@/lib/travelStore";
import type { SavedCourse } from "@/lib/courseStore";
import { AREA_NAME, REVISIT_OPTIONS } from "@/lib/constants";
import { COURSE_SLOTS, courseLegs, courseTotalM } from "@/lib/course";
import { kakaoMapLink } from "@/lib/mapLink";
import { formatKm, hasKoreaCoord } from "@/lib/geo";
import { Icon, type IconName } from "@/components/icons";

/** 장소 목록 3탭 — 서랍의 원래 축(제거·서버 동기화가 이 키로 돈다). */
type TabKey = "saved" | "recent" | "visited";
/** 화면 탭 = 장소 3탭 + 🧭 코스. 코스는 항목 모양이 달라 목록 렌더가 갈린다. */
type Tab = TabKey | "courses";

// 📊 재방문 의향 평가(M15) — 선택된 칸 의미색. 이모지 없이 라벨 + 색으로만 3단계를 구분한다.
export const RATING_SELECTED: Record<RevisitRating, string> = {
  1: "bg-g-error-soft text-g-error-text",
  2: "bg-g-warning-soft text-g-warning-text",
  3: "bg-g-success-soft text-g-success-text",
};

const TABS: {
  key: Tab;
  label: string;
  icon: IconName;
  emptyIcon: IconName;
  empty: string;
}[] = [
  {
    key: "saved",
    label: "찜",
    icon: "heart",
    emptyIcon: "heart",
    empty: "하트를 누르면 여기 모여요",
  },
  {
    key: "recent",
    label: "최근",
    icon: "clock",
    emptyIcon: "dice",
    empty: "한 곳 뽑으면 여기 쌓여요",
  },
  {
    key: "visited",
    label: "다녀옴",
    icon: "check",
    emptyIcon: "grid",
    empty: "체크하면 지도에 도장이 찍혀요",
  },
  {
    key: "courses",
    label: "코스",
    icon: "route",
    emptyIcon: "route",
    empty: "코스를 저장하면 여기 남아요",
  },
];

export function RecordPanel({
  saved,
  recent,
  visited,
  courses,
  onRemove,
  onRemoveCourse,
  onNavigate,
  onDrawNearby,
  onRate,
}: {
  saved: SavedPlace[];
  recent: SavedPlace[];
  visited: SavedPlace[];
  /** 🧭 저장한 반나절 코스(최신 우선) — 기기 안에만 있는 목록. */
  courses: SavedCourse[];
  onRemove: (list: TabKey, contentId: string) => void;
  /** 🧭 저장 코스 제거(조합 키). */
  onRemoveCourse: (key: string) => void;
  onNavigate: (p: SavedPlace) => void;
  /** 📍 이 장소를 거점으로 주변에서 뽑기 (좌표 있는 기록만) */
  onDrawNearby: (p: SavedPlace) => void;
  /** 📊 재방문 의향 평가 설정 (다녀옴 탭에서만) */
  onRate: (p: SavedPlace, rating: RevisitRating | null) => void;
}) {
  const [tab, setTab] = useState<Tab>("saved");
  const lists: Record<TabKey, SavedPlace[]> = { saved, recent, visited };
  const activeMeta = TABS.find((t) => t.key === tab)!;
  const panelId = `rt-panel-${tab}`;
  const tabId = `rt-tab-${tab}`;

  // WAI-ARIA Tabs 키보드 이동 — 좌/우 화살표 + Home/End, 로빙 tabindex
  function onKeyDown(e: KeyboardEvent) {
    const i = TABS.findIndex((t) => t.key === tab);
    let ni = i;
    if (e.key === "ArrowRight") ni = (i + 1) % TABS.length;
    else if (e.key === "ArrowLeft") ni = (i - 1 + TABS.length) % TABS.length;
    else if (e.key === "Home") ni = 0;
    else if (e.key === "End") ni = TABS.length - 1;
    else return;
    e.preventDefault();
    const nextKey = TABS[ni].key;
    setTab(nextKey);
    document.getElementById(`rt-tab-${nextKey}`)?.focus();
  }

  return (
    <section className="w-full overflow-hidden rounded-[14px] border border-g-border bg-g-surface">
      <h2 className="sr-only">내 기록</h2>
      {/* 📑 파일 탭 — 선택 탭만 흰 종이로 앞에 나오고 나머지는 한 단 눌린 면으로 뒤에 있다. */}
      <div
        role="tablist"
        aria-label="내 기록"
        onKeyDown={onKeyDown}
        className="flex gap-1.5 px-3.5 pt-3"
      >
        {TABS.map((t) => {
          const count = t.key === "courses" ? courses.length : lists[t.key].length;
          const selected = t.key === tab;
          return (
            <button
              key={t.key}
              id={`rt-tab-${t.key}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`rt-panel-${t.key}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setTab(t.key)}
              // 폰 폭(<640)에선 아이콘을 빼고 여백을 줄인다 — 탭이 4개(M31 코스)가 되며 376px 에서
              // 탭당 74px 뿐이라 '최/근'·'다/녀/옴'이 세로로 꺾였다(탭 높이 38 → 69px).
              className={`inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-t-[10px] border border-b-0 px-3 py-[11px] text-[13px] font-bold leading-[1.2] max-sm:gap-1 max-sm:px-1 ${
                selected
                  ? "border-g-border bg-g-surface text-g-text"
                  : "border-transparent bg-g-surface-2 text-g-text-2 hover:text-g-text"
              }`}
            >
              <Icon name={t.icon} size={14} className="max-sm:hidden" />
              {t.label}
              {count > 0 && <span className="font-medium text-g-num">{count}</span>}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={panelId}
        aria-labelledby={tabId}
        tabIndex={0}
        className="border-t border-g-border"
      >
        {tab === "courses" ? (
          courses.length === 0 ? (
            <EmptyState icon={activeMeta.emptyIcon} text={activeMeta.empty} />
          ) : (
            <ul>
              {courses.map((c) => (
                <CourseRow
                  key={c.key}
                  course={c}
                  onRemove={() => onRemoveCourse(c.key)}
                  onNavigate={onNavigate}
                />
              ))}
            </ul>
          )
        ) : lists[tab].length === 0 ? (
          <EmptyState icon={activeMeta.emptyIcon} text={activeMeta.empty} />
        ) : (
          <ul>
            {lists[tab].map((p) => (
              <PlaceRow
                key={p.contentId}
                place={p}
                showRating={tab === "visited"}
                onRemove={() => onRemove(tab, p.contentId)}
                onNavigate={() => onNavigate(p)}
                onDrawNearby={() => onDrawNearby(p)}
                onRate={(rating) => onRate(p, rating)}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

/** 빈 탭 안내 — 점선 원 + 한 줄(장소 3탭·코스 탭 공용). */
function EmptyState({ icon, text }: { icon: IconName; text: string }) {
  return (
    <div className="flex flex-col items-center px-6 py-[34px] text-center">
      <span className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-full border-2 border-dashed border-g-map-empty text-g-num">
        <Icon name={icon} size={26} />
      </span>
      <p className="text-[13px] leading-[1.6] text-g-text-2">{text}</p>
    </div>
  );
}

/**
 * 🧭 저장한 코스 1건(§7.10 백로그 ①) — 출발지 + 총 이동거리 헤더 아래 스텝 타임라인.
 * 사진 없이 텍스트로 압축한다 — 코스 1건이 장소 행 4개 높이를 먹으면 서랍이 코스로 뒤덮인다.
 */
function CourseRow({
  course,
  onRemove,
  onNavigate,
}: {
  course: SavedCourse;
  onRemove: () => void;
  onNavigate: (p: SavedPlace) => void;
}) {
  // 거리는 파생값이라 저장하지 않고 좌표에서 다시 계산한다(CoursePanel 헤더와 같은 식).
  const total = courseTotalM(
    courseLegs([course.anchor, ...course.steps.map((s) => s.place)]),
  );

  return (
    <li className="border-t border-g-border px-4 py-3 first:border-t-0">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-medium leading-[1.4]">
            {course.anchor.title}에서의 반나절 코스
          </p>
          <p className="mt-1 text-[12px] leading-[1.4] text-g-text-2">
            {course.steps.length}곳 · 총 {formatKm(total)}
          </p>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="flex h-8 w-8 flex-none items-center justify-center rounded-full text-g-text-3 hover:bg-g-surface-2 hover:text-g-text-2"
          aria-label={`${course.anchor.title}에서의 반나절 코스 삭제`}
        >
          <Icon name="close" size={13} />
        </button>
      </div>

      <ol className="mt-2 flex flex-col gap-1.5 border-l border-dashed border-g-border pl-3">
        {course.steps.map((s) => {
          const meta = COURSE_SLOTS.find((d) => d.slot === s.slot);
          const mapHref = kakaoMapLink(s.place.title, s.place.lat, s.place.lng);
          return (
            <li key={s.place.contentId} className="flex items-center gap-2">
              <Icon
                name={meta?.icon ?? "pin"}
                size={13}
                className="flex-none text-g-text-3"
              />
              <span className="min-w-0 flex-1 truncate text-[13px] leading-[1.4]">
                {s.place.title}
              </span>
              {mapHref && (
                <a
                  href={mapHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => onNavigate(s.place)}
                  className="flex h-7 w-7 flex-none items-center justify-center rounded-full text-g-text-3 hover:bg-g-surface-2 hover:text-g-primary"
                  aria-label={`${s.place.title} 지도에서 보기`}
                >
                  <Icon name="map" size={13} />
                </a>
              )}
            </li>
          );
        })}
      </ol>
    </li>
  );
}

/** 기록 행 공통 썸네일(46px · radius 8) — /map 다녀온 곳 리스트와 같은 규격. */
export function RowThumb({ image }: { image?: string | null }) {
  return (
    <div className="flex h-[46px] w-[46px] flex-none items-center justify-center overflow-hidden rounded-lg bg-g-surface-2 text-g-num">
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" className="h-full w-full object-cover" />
      ) : (
        <Icon name="image" size={18} />
      )}
    </div>
  );
}

function PlaceRow({
  place,
  showRating,
  onRemove,
  onNavigate,
  onDrawNearby,
  onRate,
}: {
  place: SavedPlace;
  showRating: boolean;
  onRemove: () => void;
  onNavigate: () => void;
  onDrawNearby: () => void;
  onRate: (rating: RevisitRating | null) => void;
}) {
  const areaName =
    place.areaCode != null ? AREA_NAME[place.areaCode] : undefined;
  const mapHref = kakaoMapLink(place.title, place.lat, place.lng);
  const canDrawNearby = hasKoreaCoord(place);
  const rating = place.rating ?? null;

  return (
    <li className="border-t border-g-border px-4 py-3 first:border-t-0">
      <div className="flex items-center gap-3">
        <RowThumb image={place.image} />

        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-medium leading-[1.4]">{place.title}</p>
          {areaName && (
            <p className="mt-1 text-[12px] leading-[1.4] text-g-text-2">{areaName}</p>
          )}
        </div>

        {canDrawNearby && (
          <button
            type="button"
            onClick={onDrawNearby}
            className="inline-flex h-8 flex-none items-center gap-1.5 whitespace-nowrap rounded-full border border-g-primary-soft-border bg-g-primary-soft px-2.5 text-[12px] font-medium text-g-primary-text hover:border-g-primary"
            aria-label={`${place.title} 주변에서 뽑기`}
          >
            <Icon name="pin" size={12} />
            주변 뽑기
          </button>
        )}
        {mapHref && (
          <a
            href={mapHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onNavigate}
            className="flex h-8 w-8 flex-none items-center justify-center rounded-full text-g-text-3 hover:bg-g-surface-2 hover:text-g-primary"
            aria-label={`${place.title} 지도에서 보기`}
          >
            <Icon name="map" size={14} />
          </a>
        )}
        <button
          type="button"
          onClick={onRemove}
          className="flex h-8 w-8 flex-none items-center justify-center rounded-full text-g-text-3 hover:bg-g-surface-2 hover:text-g-text-2"
          aria-label={`${place.title} 목록에서 제거`}
        >
          <Icon name="close" size={13} />
        </button>
      </div>

      {showRating && (
        // 📊 재방문 의향 평가(M15) — 둘째 줄, 가로 3분할. 선택 칸 재클릭 시 해제(null).
        <div
          role="group"
          aria-label={`${place.title} 재방문 의향 평가`}
          className="mt-2.5 flex overflow-hidden rounded-md border border-g-border"
        >
          {REVISIT_OPTIONS.map((opt) => {
            const selected = rating === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onRate(selected ? null : opt.value)}
                aria-pressed={selected}
                aria-label={`${place.title} — ${opt.full}`}
                className={`flex-1 border-l border-g-border px-1.5 py-2 text-[12px] font-medium first:border-l-0 ${
                  selected
                    ? RATING_SELECTED[opt.value]
                    : "text-g-text-2 hover:bg-g-surface-2"
                }`}
              >
                {opt.short}
              </button>
            );
          })}
        </div>
      )}
    </li>
  );
}

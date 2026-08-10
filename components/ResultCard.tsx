"use client";

import { useState } from "react";
import Link from "next/link";
import type { RandomResponse, InfoChip } from "@/types/tour";
import { AREA_NAME, CONTENT_TYPE_NAME } from "@/lib/constants";
import { kakaoMapLink, kakaoRouteLink } from "@/lib/mapLink";
import { useKakaoShare } from "@/hooks/useKakaoShare";
import { useOverview } from "@/hooks/useOverview";
import { shareText } from "@/lib/kakaoShare";
import { formatKm } from "@/lib/geo";
import { fmtYmd } from "@/lib/kst";
import { Icon, type IconName } from "@/components/icons";

// 🎴 결과 엽서 — 사진(지역 칩 + 오버레이 찜·다녀옴) + 사각 스탬프 배지 + 주요 2버튼 +
//   보조 4타일(지도·길찾기·공유·복사). 데이터·공유 로직은 그대로 재사용.
//   의미색은 🍃 한적(success)·notice(warning)·🔭 빈 곳(accent)만. 나머지는 중립.

const BADGE_KIND = {
  neutral: "bg-[#f4efe4] text-g-text-3",
  accent: "bg-g-accent-soft text-g-accent-text",
  success: "bg-g-success-soft text-g-success-text",
  warning: "bg-g-warning-soft text-g-warning-text",
} as const;

/** 뱃지 1개 — 엽서에 찍힌 사각 스탬프. 아이콘(12px)은 있을 때만. */
function Badge({
  kind = "neutral",
  icon,
  title,
  truncate = false,
  children,
}: {
  kind?: keyof typeof BADGE_KIND;
  icon?: IconName;
  title?: string;
  truncate?: boolean;
  children: React.ReactNode;
}) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1.5 rounded-md px-[9px] py-[5px] text-[11px] font-bold leading-[1.2] ${
        truncate ? "max-w-[15rem]" : "whitespace-nowrap"
      } ${BADGE_KIND[kind]}`}
    >
      {icon && <Icon name={icon} size={12} />}
      <span className={truncate ? "truncate" : undefined}>{children}</span>
    </span>
  );
}

/**
 * 🐕 동반 정보 · ♿ 편의시설 상세(§6.11) — 라벨-값 목록.
 * 값이 문장이라 pill 로는 안 담겨 카드 안쪽 블록(rounded-lg + surface-2)에 2열 나열한다.
 */
function InfoChipList({
  icon,
  title,
  chips,
}: {
  icon: IconName;
  title: string;
  chips: InfoChip[];
}) {
  if (chips.length === 0) return null;
  return (
    <dl className="flex flex-col gap-1.5 rounded-lg bg-g-surface-2 px-3 py-2.5">
      <dt className="inline-flex items-center gap-1.5 text-[11px] font-bold leading-none text-g-text-2">
        <Icon name={icon} size={12} />
        {title}
      </dt>
      {chips.map((c) => (
        <dd key={c.label} className="text-[12px] leading-[1.5] text-g-text-2">
          <b className="font-bold">{c.label}</b> · {c.value}
        </dd>
      ))}
    </dl>
  );
}

export function ResultCard({
  data,
  onDrawNearby,
  anchorTitle,
  onOpenCourse,
  courseLoading,
  saved,
  visited,
  onToggleSave,
  onToggleVisit,
  onNavigate,
}: {
  data: RandomResponse;
  /** 📍 첫 여행지 주변에서 뽑기(M14) — 순수 모드+앵커 좌표 있을 때만 전달, 아니면 null.
      전국 랜덤 재추첨은 카드 위 "다시 굴리기" 버튼이 담당하므로 카드엔 뽑기 버튼을 두지 않는다. */
  onDrawNearby: (() => void) | null;
  /** 주변 뽑기 기준점(첫 여행지) 이름 — 버튼·거리 배지 라벨용 */
  anchorTitle: string | null;
  /** 🧭 반나절 코스 만들기(M20) — 현재 place 에 좌표가 있을 때만 전달, 없으면 null(미렌더). */
  onOpenCourse: (() => void) | null;
  /** 🧭 코스 생성 중이면 버튼 disabled(연타·중복 요청 방지). */
  courseLoading: boolean;
  saved: boolean;
  visited: boolean;
  onToggleSave: () => void;
  onToggleVisit: () => void;
  onNavigate: () => void;
}) {
  const { place } = data;
  const distanceM = data.picked.distanceM;
  const [imgError, setImgError] = useState(false);
  const [shareMsg, setShareMsg] = useState<string | null>(null);
  const { share } = useKakaoShare();
  // 📝 개요는 카드가 뜬 뒤 따로 받는다(§5.6) — 뽑기 응답에서 이 왕복을 뺀 대가.
  //   ♿ 는 같은 왕복에 detailWithTour2 편의시설 칩까지 받는다(§6.11).
  //   🐕 는 카드 구성에 detailCommon2 가 필수라 개요가 뽑기 응답에 이미 실려 있다(조회 생략).
  const { overview, facilities } = useOverview(
    place.contentId,
    place.overview,
    !!data.picked.barrierFree,
  );

  const areaCode = place.areaCode ?? data.picked.areaCode;
  const areaName = areaCode != null ? AREA_NAME[areaCode] : undefined;
  const typeName =
    CONTENT_TYPE_NAME[place.contentTypeId] ??
    CONTENT_TYPE_NAME[data.picked.contentTypeId];

  const mapHref = kakaoMapLink(place.title, place.lat, place.lng);
  const routeHref = kakaoRouteLink(place.title, place.lat, place.lng);
  const showImage = place.image && !imgError;

  function flash(msg: string | null) {
    setShareMsg(msg);
    if (msg) window.setTimeout(() => setShareMsg(null), 2200);
  }

  // 💬 카톡 공유(M13) — 카카오 피드 카드, 실패 시 Web Share/클립보드 폴백.
  async function onShare() {
    const origin = window.location.origin;
    const result = await share(place, {
      appUrl: origin,
      mapUrl: mapHref,
      fallbackImage: `${origin}/icon-512.png`,
      congestion: data.picked.congestion, // 🍃 분산 서사(§7.9) — 공유 카드에 근거 1줄
    });
    if (result === "copied") flash("링크가 복사됐어요");
    else if (result === "failed") flash("공유를 열 수 없었어요.");
    else flash(null);
  }

  // 🔗 링크 복사 — 클립보드 우선, 안 되면 Web Share(모바일)로 폴백.
  async function onCopyLink() {
    const text = shareText(place, window.location.origin, data.picked.congestion);
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        flash("링크가 복사됐어요 — 카톡에 붙여넣어 보내세요");
        return;
      } catch {
        /* 다음 폴백 */
      }
    }
    if (navigator.share) {
      try {
        await navigator.share({ text });
        return;
      } catch {
        flash("공유를 열 수 없었어요.");
        return;
      }
    }
    flash("이 브라우저에선 복사를 지원하지 않아요.");
  }

  // 사진 위 오버레이 원형 토글 — 42px 흰 원, 테두리 없음(사진 위에선 면이 곧 경계).
  const overlayBtn =
    "flex h-[42px] w-[42px] items-center justify-center rounded-full bg-g-surface";
  // 보조 액션 타일 — 4등분, 아이콘 17px + 11px 라벨.
  const tile =
    "flex flex-1 flex-col items-center gap-1 rounded-[14px] bg-g-surface-2 py-[11px] text-g-text-2 [corner-shape:squircle] hover:bg-g-primary-soft hover:text-g-primary-text";
  const tileLabel = "text-[11px] font-medium leading-none";

  return (
    <article className="animate-card-reveal w-full overflow-hidden rounded-2xl border border-g-border bg-g-surface">
      <div className="bg-g-hatch relative aspect-video w-full">
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={place.image!}
            alt={place.title}
            onError={() => setImgError(true)}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-g-num">
            <Icon name="image" size={40} />
          </div>
        )}
        {/* 엽서 소인처럼 사진 좌상단에 지역을 박는다 — 배지 줄에서 여기로 올라왔다. */}
        {areaName && (
          <span className="absolute left-3.5 top-3.5 inline-flex items-center gap-1.5 rounded-full bg-[rgba(22,50,58,.86)] px-3 py-1.5 text-[12px] font-bold text-g-on-primary">
            <Icon name="pin" size={12} />
            {areaName}
          </span>
        )}
        {/* 사진 위 오버레이 — 찜 / 다녀옴 */}
        <div className="absolute right-3.5 top-3.5 flex gap-2">
          <button
            type="button"
            onClick={onToggleSave}
            aria-pressed={saved}
            aria-label={saved ? "찜 해제" : "찜하기"}
            className={`${overlayBtn} text-g-accent-bright`}
          >
            <Icon name="heart" size={19} className={saved ? "fill-current" : ""} />
          </button>
          <button
            type="button"
            onClick={onToggleVisit}
            aria-pressed={visited}
            aria-label={visited ? "다녀옴 해제" : "다녀왔어요"}
            className={`${overlayBtn} ${visited ? "text-g-primary-text" : "text-g-primary"}`}
          >
            <Icon name={visited ? "check" : "plus"} size={19} />
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-[9px] p-[18px]">
        <div className="flex flex-wrap items-center gap-1.5">
          {typeName && <Badge>{typeName}</Badge>}
          {data.picked.seaside && (
            <Badge icon="wave">{data.picked.seaside.category}</Badge>
          )}
          {/* 🐕·♿ 대상 축 배지(§6.11) — 소스 자체가 근거라 추가 조회 없이 붙는다. */}
          {/* '동반 가능' — 여행지라는 주장이 아니라 '함께 갈 수 있다'는 사실만 말한다(§6.11). */}
          {data.picked.pet && <Badge icon="paw">반려동물 동반 가능</Badge>}
          {data.picked.barrierFree && (
            <Badge icon="accessible">무장애 정보 보유</Badge>
          )}
          {data.picked.seasonal && data.picked.seasonal.items.length > 0 && (
            <Badge icon="pot">
              지금 제철 {data.picked.seasonal.items.map((s) => s.item).join(" · ")}
            </Badge>
          )}
          {data.picked.festival && (
            <Badge icon="tent" truncate title={data.picked.festival.name}>
              {data.picked.festival.name}
              {data.picked.festival.more > 0 && ` 외 ${data.picked.festival.more}`}
              {/* 📅 오늘 아닌 기준일이면 명시 — 시작 전 축제가 '진행 중'처럼 보이는 오해 방지(§6.8) */}
              {data.picked.festival.baseYmd &&
                ` (${fmtYmd(data.picked.festival.baseYmd)} 기준)`}
            </Badge>
          )}
          {data.picked.weather && (
            <Badge icon="sun">
              지금 비 안 와요
              {data.picked.weather.temp != null &&
                ` · ${Math.round(data.picked.weather.temp)}℃`}
            </Badge>
          )}
          {/* 🔭 지도에 없던 동네(§7.11) — 🍃 앞에 둬 "지도에 없던 동네 (+ 🍃 …)" 순서.
              방문 0 사용자에게도 참(전부 없던 곳) — data.picked.emptySpot 만으로 게이트. */}
          {data.picked.emptySpot && (
            <Badge kind="accent" icon="target">
              지도에 없던 동네
            </Badge>
          )}
          {data.picked.congestion && (
            <Badge kind="success" icon="leaf">
              {/* 예측 대상일 선두(정상 경로=선택일). baseYmd < targetYmd(배치 지연)에만 데이터일 병기(§6.8) */}
              {fmtYmd(data.picked.congestion.targetYmd)} 한적 예측 · 집중률 하위{" "}
              {data.picked.congestion.pctBelow}%
              {data.picked.congestion.baseYmd < data.picked.congestion.targetYmd &&
                ` (${fmtYmd(data.picked.congestion.baseYmd)} 데이터)`}
            </Badge>
          )}
          {distanceM != null && (
            <Badge icon="pin" truncate title={anchorTitle ?? undefined}>
              {anchorTitle ? `${anchorTitle}에서 ` : "주변 "}
              {formatKm(distanceM)}
            </Badge>
          )}
        </div>
        {/* ⚖️ 분산 모드로 실제 가중이 걸린 뽑기만(§6.9B) — 근거 없는 분포 변경이 안 보이는 것 방지.
            폴백(균등)으로 내려갔으면 표식이 안 붙고 아래 notice 로 사실이 나간다. */}
        {data.picked.scatter && (
          <p className="inline-flex items-center gap-1.5 text-[12px] text-g-text-2">
            <Icon name="scales" size={12} />
            방문자 적은 시·도 가중으로 뽑음
          </p>
        )}
        {data.picked.notice && (
          <p className="inline-flex items-center gap-1.5 text-[12px] text-g-warning-text">
            <Icon name="warning" size={12} />
            {data.picked.notice}
          </p>
        )}

        {/* 엽서의 주인공 — 18 → 22 */}
        <h2 className="font-display text-[22px] font-bold leading-[1.3] tracking-[-0.03em]">
          {place.title}
        </h2>
        {place.address && (
          <p className="text-[12px] leading-[1.5] text-g-text-3">{place.address}</p>
        )}
        {overview && (
          <p className="line-clamp-3 text-[15px] leading-[1.7] text-g-text-2">
            {overview}
          </p>
        )}
        {data.picked.pet && (
          <InfoChipList
            icon="paw"
            title="반려동물 동반 안내"
            chips={data.picked.pet.chips}
          />
        )}
        {/* ♿ 편의시설은 지연 로드(§6.11) — 없거나 아직 안 왔으면 블록 자체가 안 뜬다. */}
        <InfoChipList icon="accessible" title="무장애 편의시설" chips={facilities} />

        {/* 🔭 통합 카드 지도는 시·군·구 단위라 결과 칩으로 바로 확인되지만,
            내 지도 전체 맥락은 /map 에서 본다(§7.11). */}
        {data.picked.emptySpot && (
          <Link
            href="/map"
            className="inline-flex items-center gap-1.5 text-[12px] font-medium text-g-primary-text hover:text-g-primary"
          >
            <Icon name="map" size={13} />
            내 지도에서 확인
            <Icon name="arrowRight" size={12} />
          </Link>
        )}

        {/* 주요 2버튼 — 📍 주변에서 뽑기(secondary) · 🧭 반나절 코스(tertiary).
            전국 랜덤 재추첨은 카드 위 버튼 하나가 담당하므로 여기 두지 않는다. */}
        {(onDrawNearby || onOpenCourse) && (
          <>
            <div className="mt-1.5 border-t border-dashed border-g-border" />
            <div className="flex gap-2">
              {onDrawNearby && (
                <button
                  type="button"
                  onClick={onDrawNearby}
                  className="inline-flex h-[46px] flex-1 items-center justify-center gap-2 truncate rounded-2xl border-[1.5px] border-g-primary bg-g-surface text-[14px] font-bold text-g-primary transition-transform duration-200 [corner-shape:squircle] hover:-translate-y-px hover:bg-g-primary-soft"
                >
                  <Icon name="pin" size={16} />
                  {anchorTitle ? `${anchorTitle} 근처에서 한 번 더` : "근처에서 한 번 더"}
                </button>
              )}
              {onOpenCourse && (
                <button
                  type="button"
                  onClick={onOpenCourse}
                  disabled={courseLoading}
                  className="inline-flex h-[46px] flex-1 items-center justify-center gap-2 truncate rounded-2xl border-[1.5px] border-g-border bg-g-surface text-[14px] font-bold text-g-text-2 transition-transform duration-200 [corner-shape:squircle] hover:-translate-y-px hover:border-g-primary hover:text-g-primary disabled:opacity-60"
                >
                  <Icon name="clock" size={16} />
                  {courseLoading ? "코스를 짜는 중…" : "반나절 코스"}
                </button>
              )}
            </div>
          </>
        )}

        {/* 보조 액션 — 지도 · 길찾기 · 공유 · 복사 */}
        <div className="flex gap-1.5">
          {mapHref && (
            <a
              href={mapHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onNavigate}
              className={tile}
            >
              <Icon name="map" size={17} />
              <span className={tileLabel}>지도</span>
            </a>
          )}
          {routeHref && (
            <a
              href={routeHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onNavigate}
              className={tile}
            >
              <Icon name="compass" size={17} />
              <span className={tileLabel}>길찾기</span>
            </a>
          )}
          <button type="button" onClick={onShare} className={tile}>
            <Icon name="share" size={17} />
            <span className={tileLabel}>공유</span>
          </button>
          <button type="button" onClick={onCopyLink} className={tile}>
            <Icon name="link" size={17} />
            <span className={tileLabel}>복사</span>
          </button>
        </div>
        {shareMsg && (
          <p aria-live="polite" className="text-center text-[12px] text-g-text-2">
            {shareMsg}
          </p>
        )}
      </div>
    </article>
  );
}

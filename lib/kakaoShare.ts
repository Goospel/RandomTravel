// 💬 뽑기 결과 카톡 공유(M13, plan.md §7.5)의 순수 로직 — SDK·DOM 없이 단위 테스트 가능.
// 카카오 JS SDK Kakao.Share.sendDefault 에 넘길 feed 기본 템플릿을 만들고,
// SDK 를 못 쓰는 환경(데스크톱·비카톡)용 폴백 평문도 만든다. 실제 전송/로드는 hooks/useKakaoShare.

import type { Place, CongestionBadge } from "@/types/tour";

/** 카카오 feed 템플릿의 링크(웹·모바일웹 동일하게 채운다) */
export interface FeedLink {
  webUrl: string;
  mobileWebUrl: string;
}

/** Kakao.Share.sendDefault 용 feed 기본 템플릿(필요한 최소 형태) */
export interface FeedTemplate {
  objectType: "feed";
  content: {
    title: string;
    description: string;
    imageUrl: string;
    link: FeedLink;
  };
  buttons: { title: string; link: FeedLink }[];
}

/** 공유 카드가 참조할 URL 묶음 */
export interface ShareContext {
  /** 앱 홈(window.location.origin) — '나도 뽑기' 대상 */
  appUrl: string;
  /** 이 장소의 카카오맵 링크(lib/mapLink). 좌표·이름 없으면 null */
  mapUrl: string | null;
  /** 이미지 없을 때 대체 이미지(앱 아이콘 등, https) */
  fallbackImage: string;
  /** 🍃 한적 근거(M18 §7.9) — 있으면 공유 설명/평문에 근거 1줄을 덧붙인다. 없으면 무변 */
  congestion?: CongestionBadge | null;
}

// 분산 서사(M18 §7.9 원칙 1·3) — '유명세 대신 전국 어디든 같은 출발선'. 알고리즘이 보장하는
// '시·도 균등/인기 무가중'만 주장(혼잡 회피는 🍃 켤 때만, 아래 congestion 줄로 분리).
const DEFAULT_DESC = "🎲 어디든 — 유명세 대신 전국 어디든 같은 출발선에서 뽑은 여행지";
const DESC_MAX = 80;

/** YYYYMMDD → "M/D"(앞 0 제거). 형식 이상 시 원문 그대로. */
function mdOf(ymd: string): string {
  if (!/^\d{8}$/.test(ymd)) return ymd;
  return `${Number(ymd.slice(4, 6))}/${Number(ymd.slice(6, 8))}`;
}

/**
 * 🍃 한적 근거 1줄(외부 노출면 전용, §7.9 원칙 2) — '이해 가능한 단어(한적 예측)' 선행 +
 * 기준일 필수. 무맥락 수신자가 '집중률 하위'를 '순위 낮은 별로인 곳'으로 오독하는 것을 막는다.
 */
export function congestionShareLine(c: CongestionBadge): string {
  return `🍃 한적 예측 · 집중률 하위 ${c.pctBelow}% (${mdOf(c.baseYmd)} 기준)`;
}

/** 카톡 피드 imageUrl 은 https 를 요구 — http 는 앞부분만 업그레이드. 빈값이면 undefined. */
export function httpsImage(url: string | null): string | undefined {
  if (!url) return undefined;
  const trimmed = url.trim();
  if (!trimmed) return undefined;
  return trimmed.startsWith("http://")
    ? "https://" + trimmed.slice("http://".length)
    : trimmed;
}

function sameLink(url: string): FeedLink {
  return { webUrl: url, mobileWebUrl: url };
}

// 설명: 주소 우선, 없으면 overview 축약, 둘 다 없으면 기본 문구.
function pickDescription(place: Place): string {
  const addr = place.address?.trim();
  if (addr) return addr;
  const ov = place.overview?.trim();
  if (ov) return ov.length > DESC_MAX ? ov.slice(0, DESC_MAX - 1) + "…" : ov;
  return DEFAULT_DESC;
}

/** Place → Kakao.Share.sendDefault 용 feed 템플릿. */
export function buildShareFeed(place: Place, ctx: ShareContext): FeedTemplate {
  const title = place.title?.trim() || "오늘의 여행지";
  const mainUrl = ctx.mapUrl ?? ctx.appUrl;

  const buttons: FeedTemplate["buttons"] = [];
  if (ctx.mapUrl) {
    buttons.push({ title: "🗺️ 지도에서 보기", link: sameLink(ctx.mapUrl) });
  }
  buttons.push({ title: "🎲 나도 뽑기", link: sameLink(ctx.appUrl) });

  // 주소(수신자 실용 정보) 선행 · 🍃 근거 줄 후행 — 카톡 피드 desc 2줄 잘림 시 주소 우선(§7.9 원칙 2).
  const desc = ctx.congestion
    ? `${pickDescription(place)}\n${congestionShareLine(ctx.congestion)}`
    : pickDescription(place);

  return {
    objectType: "feed",
    content: {
      title,
      description: desc,
      imageUrl: httpsImage(place.image) ?? ctx.fallbackImage,
      link: sameLink(mainUrl),
    },
    buttons,
  };
}

/** 폴백(Web Share/클립보드)용 평문 — 빈 필드는 줄을 만들지 않는다. 🍃 근거는 주소 다음·앱URL 앞. */
export function shareText(
  place: Place,
  appUrl: string,
  congestion?: CongestionBadge | null,
): string {
  const title = place.title?.trim() || "오늘의 여행지";
  const lines = [`🎲 어디든 추천: ${title}`];
  const addr = place.address?.trim();
  if (addr) lines.push(addr);
  if (congestion) lines.push(congestionShareLine(congestion));
  lines.push(appUrl);
  return lines.join("\n");
}

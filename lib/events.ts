// 여행 행동 이벤트 — §12.5 스키마. P0 은 localStorage 에만 기록(서버 전송 없음, §12.6).
//
// 순수 부분(스키마 빌드 + 링버퍼)만 여기 두고, localStorage append 는
// hooks/useTravelStore 가 담당한다. 세션 ID는 익명 UUID(기기/개인 식별 불가).

export type TravelEventType =
  | "draw"
  | "redraw"
  | "like"
  | "navigate"
  | "visited";

export type Mode = "pure" | "filtered";

/** §12.5 이벤트 레코드 */
export interface TravelEvent {
  event: TravelEventType;
  mode: Mode | null;
  areaCode: number | null;
  contentTypeId: number | null;
  contentId: string | null;
  sessionId: string;
  ts: number;
}

export interface MakeEventInput {
  event: TravelEventType;
  sessionId: string;
  ts: number;
  mode?: Mode | null;
  areaCode?: number | null;
  contentTypeId?: number | null;
  contentId?: string | null;
}

/** 스키마 빌드 — 누락된 선택 필드는 null 로 정규화 */
export function makeEvent(input: MakeEventInput): TravelEvent {
  return {
    event: input.event,
    mode: input.mode ?? null,
    areaCode: input.areaCode ?? null,
    contentTypeId: input.contentTypeId ?? null,
    contentId: input.contentId ?? null,
    sessionId: input.sessionId,
    ts: input.ts,
  };
}

/** 링버퍼: 맨 뒤에 추가, 상한 cap 초과 시 가장 오래된 앞쪽 제거. 원본 불변. */
export function appendEvent(
  list: TravelEvent[],
  ev: TravelEvent,
  cap = 500,
): TravelEvent[] {
  const n = Math.max(0, Math.trunc(cap)); // cap≤0/소수 방어
  if (n === 0) return [];
  const next = [...list, ev];
  return next.length > n ? next.slice(next.length - n) : next;
}

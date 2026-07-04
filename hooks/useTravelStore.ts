"use client";

// localStorage 기반 찜/최근/방문 목록 + 이벤트 기록(§12.6 P0: 로컬 전용) 훅.
// 순수 로직은 lib/travelStore, lib/events 에 있고, 여기서 브라우저 저장과 배선만 담당.
// SSR 안전: 초기값 [] 로 시작 → 마운트 후(useEffect) localStorage 에서 하이드레이트.

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import type { Place } from "@/types/tour";
import {
  addToRecent,
  parseStored,
  serialize,
  toSavedPlace,
  toggleSaved,
  has,
  type SavedPlace,
} from "@/lib/travelStore";
import { mergePlaces } from "@/lib/syncMerge";
import {
  appendEvent,
  makeEvent,
  type Mode,
  type TravelEvent,
  type TravelEventType,
} from "@/lib/events";

const K_SAVED = "rt.saved.v1";
const K_VISITED = "rt.visited.v1";
const K_RECENT = "rt.recent.v1";
const K_EVENTS = "rt.events.v1";
const K_SESSION = "rt.session.v1";
const RECENT_CAP = 20;

// 로그인 세션당 1회만 서버 병합 — 여러 페이지의 store 인스턴스 중복 병합 방지.
let mergedForUser: string | null = null;

// 서버 write-through(로그인 시). fire-and-forget — 실패해도 로컬은 이미 반영됨.
function serverAdd(list: "saved" | "visited", place: SavedPlace) {
  void fetch("/api/places", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ list, place }),
  }).catch(() => {});
}
function serverRemove(list: "saved" | "visited", contentId: string) {
  void fetch("/api/places", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ list, contentId }),
  }).catch(() => {});
}

function load(key: string): SavedPlace[] {
  if (typeof window === "undefined") return [];
  return parseStored(window.localStorage.getItem(key));
}

function persist(key: string, list: SavedPlace[]) {
  if (typeof window === "undefined") return; // SSR 가드(load/loadEvents 와 대칭)
  try {
    window.localStorage.setItem(key, serialize(list));
  } catch {
    // 용량 초과·프라이빗 모드 등 — 조용히 무시(기능은 계속 동작).
    // ⚠️ 알려진 한계: 저장 실패 시 화면(state)과 localStorage 가 desync 될 수 있다
    //   (iOS Safari 프라이빗 QuotaExceeded 등 니치 환경). P0 허용 degrade.
  }
}

// 손상·외부 조작 대비 이벤트 타입 화이트리스트(§12.5)
const EVENT_TYPES = new Set<TravelEventType>([
  "draw",
  "redraw",
  "like",
  "navigate",
  "visited",
]);

/**
 * 이벤트 로드 — SavedPlace 용 parseStored 는 contentId 문자열을 요구해
 * contentId:null 인 이벤트를 버리므로, 이벤트는 별도 파싱한다.
 * event 화이트리스트 + ts/sessionId 타입을 검증해 손상 레코드 유입을 막되,
 * contentId=null 은 스키마상 정상이므로 계속 허용한다.
 */
function loadEvents(): TravelEvent[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(K_EVENTS);
  if (!raw) return [];
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data.filter((x): x is TravelEvent => {
      if (!x || typeof x !== "object") return false;
      const e = x as Partial<TravelEvent>;
      return (
        typeof e.event === "string" &&
        EVENT_TYPES.has(e.event) &&
        typeof e.ts === "number" &&
        typeof e.sessionId === "string"
      );
    });
  } catch {
    return [];
  }
}

export interface UseTravelStore {
  ready: boolean;
  saved: SavedPlace[];
  visited: SavedPlace[];
  recent: SavedPlace[];
  isSaved: (contentId: string) => boolean;
  isVisited: (contentId: string) => boolean;
  toggleSave: (place: Place) => void;
  toggleVisit: (place: Place) => void;
  /** 뽑기 성공 시 호출 — 최근 목록 기록 + draw/redraw 이벤트 */
  recordDraw: (place: Place, meta: { mode: Mode; isRedraw: boolean }) => void;
  /** 지도/길찾기 클릭 — navigate 이벤트 (Place·SavedPlace 공용 최소 필드) */
  logNavigate: (place: {
    contentId: string;
    areaCode: number | null;
    contentTypeId: number;
  }) => void;
  remove: (list: "saved" | "visited" | "recent", contentId: string) => void;
}

export function useTravelStore(): UseTravelStore {
  const [ready, setReady] = useState(false);
  const [saved, setSaved] = useState<SavedPlace[]>([]);
  const [visited, setVisited] = useState<SavedPlace[]>([]);
  const [recent, setRecent] = useState<SavedPlace[]>([]);
  const eventsRef = useRef<TravelEvent[]>([]);
  const sessionIdRef = useRef<string>("");

  const { data: session, status } = useSession();
  const userId = session?.user?.id ?? null;

  useEffect(() => {
    // 세션 ID(익명 UUID) — 없으면 생성
    let sid = window.localStorage.getItem(K_SESSION);
    if (!sid) {
      sid =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `s-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
      try {
        window.localStorage.setItem(K_SESSION, sid);
      } catch {
        /* 무시 */
      }
    }
    sessionIdRef.current = sid;

    // localStorage 는 SSR 에서 읽을 수 없어, 렌더 중 읽으면 서버(빈 목록)↔클라(채워진 목록)
    // 하이드레이션 불일치가 난다. 그래서 마운트 후 여기서 setState 로 채운다(정석 패턴).
    /* eslint-disable react-hooks/set-state-in-effect */
    setSaved(load(K_SAVED));
    setVisited(load(K_VISITED));
    setRecent(load(K_RECENT));
    eventsRef.current = loadEvents();
    setReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  // 로그인 시 동기화: 서버 목록 ↔ 로컬 병합(합집합) → 화면·localStorage 반영 →
  // 합집합을 서버에 업로드(로컬에만 있던 것 올림). 세션당 1회(mergedForUser 가드).
  useEffect(() => {
    if (!ready) return;
    if (status === "unauthenticated") {
      mergedForUser = null; // 로그아웃 → 재로그인 시 다시 병합 허용
      return;
    }
    if (status !== "authenticated" || !userId) return;
    if (mergedForUser === userId) return;
    mergedForUser = userId;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/places");
        if (!res.ok) throw new Error(String(res.status));
        const server = (await res.json()) as {
          saved: SavedPlace[];
          visited: SavedPlace[];
        };
        if (cancelled) return;
        const mergedSaved = mergePlaces(load(K_SAVED), server.saved ?? []);
        const mergedVisited = mergePlaces(load(K_VISITED), server.visited ?? []);
        setSaved(mergedSaved);
        setVisited(mergedVisited);
        persist(K_SAVED, mergedSaved);
        persist(K_VISITED, mergedVisited);
        await fetch("/api/places/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ saved: mergedSaved, visited: mergedVisited }),
        });
      } catch {
        // 네트워크/서버 실패 — 로컬 폴백 유지. 재마운트 시 재시도 허용.
        if (!cancelled) mergedForUser = null;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status, userId, ready]);

  function logEvent(
    event: TravelEventType,
    extra: {
      mode?: Mode | null;
      areaCode?: number | null;
      contentTypeId?: number | null;
      contentId?: string | null;
    },
  ) {
    if (typeof window === "undefined") return; // SSR 가드
    if (!sessionIdRef.current) return;
    const ev = makeEvent({
      event,
      sessionId: sessionIdRef.current,
      ts: Date.now(),
      ...extra,
    });
    eventsRef.current = appendEvent(eventsRef.current, ev);
    try {
      window.localStorage.setItem(
        K_EVENTS,
        JSON.stringify(eventsRef.current),
      );
    } catch {
      /* 무시 */
    }
  }

  function toggleSave(place: Place) {
    const adding = !has(saved, place.contentId);
    const sp = toSavedPlace(place, Date.now());
    const next = toggleSaved(saved, sp);
    setSaved(next);
    persist(K_SAVED, next);
    if (adding) {
      logEvent("like", {
        areaCode: place.areaCode,
        contentTypeId: place.contentTypeId,
        contentId: place.contentId,
      });
    }
    if (userId) {
      if (adding) serverAdd("saved", sp);
      else serverRemove("saved", place.contentId);
    }
  }

  function toggleVisit(place: Place) {
    const adding = !has(visited, place.contentId);
    const sp = toSavedPlace(place, Date.now());
    const next = toggleSaved(visited, sp);
    setVisited(next);
    persist(K_VISITED, next);
    if (adding) {
      logEvent("visited", {
        areaCode: place.areaCode,
        contentTypeId: place.contentTypeId,
        contentId: place.contentId,
      });
    }
    if (userId) {
      if (adding) serverAdd("visited", sp);
      else serverRemove("visited", place.contentId);
    }
  }

  function recordDraw(place: Place, meta: { mode: Mode; isRedraw: boolean }) {
    const next = addToRecent(recent, toSavedPlace(place, Date.now()), RECENT_CAP);
    setRecent(next);
    persist(K_RECENT, next);
    logEvent(meta.isRedraw ? "redraw" : "draw", {
      mode: meta.mode,
      areaCode: place.areaCode,
      contentTypeId: place.contentTypeId,
      contentId: place.contentId,
    });
  }

  function logNavigate(place: {
    contentId: string;
    areaCode: number | null;
    contentTypeId: number;
  }) {
    logEvent("navigate", {
      areaCode: place.areaCode,
      contentTypeId: place.contentTypeId,
      contentId: place.contentId,
    });
  }

  function remove(list: "saved" | "visited" | "recent", contentId: string) {
    const map = {
      saved: [saved, setSaved, K_SAVED] as const,
      visited: [visited, setVisited, K_VISITED] as const,
      recent: [recent, setRecent, K_RECENT] as const,
    };
    const [cur, setter, key] = map[list];
    const next = cur.filter((x) => x.contentId !== contentId);
    setter(next);
    persist(key, next);
    if (userId && (list === "saved" || list === "visited")) {
      serverRemove(list, contentId);
    }
  }

  return {
    ready,
    saved,
    visited,
    recent,
    isSaved: (id) => has(saved, id),
    isVisited: (id) => has(visited, id),
    toggleSave,
    toggleVisit,
    recordDraw,
    logNavigate,
    remove,
  };
}

"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import type {
  RandomResponse,
  ErrorResponse,
  Place,
  CourseResponse,
  CourseStepResponse,
} from "@/types/tour";
import { FilterPanel } from "@/components/FilterPanel";
import { FilterSheet } from "@/components/FilterSheet";
import { ConditionBar } from "@/components/ConditionBar";
import { ResultCard } from "@/components/ResultCard";
import { SlotMachine } from "@/components/SlotMachine";
import { QuietTopStrip } from "@/components/QuietTopStrip";
import { AuthButtons } from "@/components/AuthButtons";
import { InstallButton } from "@/components/InstallButton";
import { Icon } from "@/components/icons";
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
  initialTogglesFromUrl,
  parseNearFrom,
} from "@/lib/query";
import { conditionSummary } from "@/lib/conditionSummary";
import { activeDateYmd, dateChips } from "@/lib/tripDate";
import { useCandidateCount } from "@/hooks/useCandidateCount";
// 🔭 visitedAreaCodes 는 koreaMap 비의존 경량 모듈에서(§7.11). conqueredSigunguCodes 는 홈에
//    정적 import 하지 않는다(koreaMap 유입) — 🔭 클릭 시 동적 import 로만 로드.
import { visitedAreaCodes } from "@/lib/visitedAreas";
import { courseKey } from "@/lib/courseStore";
import { AREA_NAME } from "@/lib/constants";
import { hasKoreaCoord } from "@/lib/geo";
import { locate } from "@/lib/geolocate";
import { useTravelStore } from "@/hooks/useTravelStore";
import { useHomeSigungu } from "@/hooks/useHomeSigungu";

// 정복 지도는 시·군·구 경계(~207KB)와 lib/conquer 를 싣는다 → 별도 청크로 분리해 홈 초기
// 페인트를 막지 않는다(§7.11 번들 보호 — /map 의 ConquerMap 과 같은 처리).
// 지도는 통합 카드의 룰렛 본체라 스탯 행까지 이 청크가 담당한다(정복 집계가 koreaMap 의존).
const HomeConquerMap = dynamic(
  () => import("@/components/HomeConquerMap").then((m) => m.HomeConquerMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[440px] items-center justify-center text-[13px] text-g-text-2">
        지도 불러오는 중…
      </div>
    ),
  },
);

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
  // 🎫 조건 시트 열림(§7.21) — 옛 mode("pure"|"filtered") 상태를 대신한다. 모드는 이제
  //   상태가 아니라 **파생**이다: 켜진 조건이 없으면 그게 곧 '아무 데나'(§2 불변식).
  const [condOpen, setCondOpen] = useState(false);
  const [areas, setAreas] = useState<Set<number>>(new Set());
  const [types, setTypes] = useState<Set<number>>(new Set());
  const [seaside, setSeaside] = useState(false); // 🌊 바다 (§6.3)
  const [pet, setPet] = useState(false); // 🐕 반려동물 동반 (§6.11)
  const [barrierFree, setBarrierFree] = useState(false); // ♿ 무장애 (§6.11)
  const [seasonal, setSeasonal] = useState(false); // 🦀 제철 (§6.4)
  const [festival, setFestival] = useState(false); // 🎪 축제 (§6.2)
  const [noRain, setNoRain] = useState(false); // ☔ 날씨 (§6.1)
  const [quiet, setQuiet] = useState(false); // 🍃 한적 (§6.7)
  const [scatter, setScatter] = useState(false); // ⚖️ 분산 모드 (§6.9B) — 기본 OFF
  // 🏠 집에서 갈 만한 곳(§7.17) — 거주지는 서버가 단일 출처(훅), 밴드 선택만 화면 상태.
  //   null = 제한 없음(기본). 비로그인은 home=null 이라 조건 패널이 섹션 자체를 감춘다.
  const [homeKm, setHomeKm] = useState<number | null>(null);
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
  // 🎉 방금 정복한 시·도 — 통합 카드 토스트(§7.8). 1.7초 뒤 자동 해제.
  const [filledArea, setFilledArea] = useState<number | null>(null);
  // 🔭 빈 곳에서 뽑기(§7.11) — /map CTA 신호를 처리하는 동안 재진입 차단.
  //   홈에는 버튼이 없다(진입점은 /map 하나) — 이 창은 신호 소비~runDraw 진입 사이를 덮는다.
  const [emptySpotPending, setEmptySpotPending] = useState(false);
  // 🔭 /map → ?emptySpot=1 신호 1회 소비 가드(StrictMode 이중 실행·새로고침 재발화 차단).
  const emptySpotSignalRef = useRef(false);
  // 📍 내 위치에서 뽑기(§7.19) — 권한 팝업~좌표 수신 사이. runDraw 진입 전이라 loading 이 못 덮는 창.
  const [geoPending, setGeoPending] = useState(false);
  const store = useTravelStore();
  const homeSigungu = useHomeSigungu();
  const resultRef = useRef<HTMLDivElement>(null);

  // ─── 🎫 조건 파생(§7.21) — 요약 줄·조건 시트·후보 수·뽑기 쿼리가 **같은 값**을 쓴다 ───
  // 예전엔 이 파생이 FilterPanel 안에 있어서, 패널이 안 떠 있는 동안 홈은 조건 상태를 몰랐다.
  // 소유자(이 페이지)가 한 번만 파생해 내려주면 표시·전송이 갈릴 자리가 없다.

  // 📅 자정을 넘겨 stale 이 된 선택은 여기서 걸러진다(§6.8). dateYmd 가 null 이면 dateChips 를
  //    아예 부르지 않으므로 첫 렌더는 서버·클라가 항상 같다(하이드레이션 안전).
  const activeYmd = activeDateYmd(dateYmd);
  const dateLabel =
    activeYmd != null
      ? (dateChips().find((c) => c.ymd === activeYmd)?.label ?? null)
      : null;

  const homeOn = homeSigungu.home?.code != null && homeKm != null;

  // 켜진 조건 라벨들 — 빈 배열이면 '아무 데나'(= 완전 랜덤, §2). 옛 mode 상태를 대신한다.
  const summary = conditionSummary({
    areas,
    types,
    seaside,
    pet,
    barrierFree,
    seasonal,
    festival,
    noRain,
    quiet,
    scatter,
    dateLabel,
    homeKm: homeOn ? homeKm : null,
  });
  const hasCondition = summary.length > 0;

  // 후보 수 조회용 쿼리 — 뽑기와 같은 파라미터(buildRandomQuery)를 재사용해 서버와 일치.
  //   activeYmd(stale 정리분)를 넘겨 count 경로도 date 방출/noRain 미방출을 뽑기와 일치시킨다.
  // ⚠️ scatter 는 **일부러 안 넘긴다**(§6.9B) — ⚖️ 는 풀이 아니라 분포만 바꾸므로 후보 수가
  //   같아야 하고(불변식), 넣으면 같은 풀의 count URL 이 갈라져 캐시만 쪼개진다.
  //   "뽑기·count 쿼리 일치" 관례의 유일한 의도적 예외. 여기에 scatter 를 추가하지 말 것.
  //   🏠 는 풀을 실제로 좁히므로(분포 축인 ⚖️ 와 다르다) count 에도 그대로 넘긴다 —
  //   안 넘기면 배지가 전국 후보 수를 띄워 거짓말이 된다(§7.17E).
  const countQuery = buildRandomQuery("filtered", areas, types, {
    seaside,
    pet,
    barrierFree,
    seasonal,
    festival,
    noRain,
    quiet,
    home: homeOn ? { code: homeSigungu.home!.code!, km: homeKm! } : null,
    dateYmd: activeYmd,
  });
  // M32 부터 조건 패널이 닫혀 있어도 배지가 요약 줄에 뜬다 → 홈에서 상시 1회 조회(디바운스 400ms).
  const count = useCandidateCount(countQuery);

  useEffect(() => {
    if (filledArea == null) return;
    const t = window.setTimeout(() => setFilledArea(null), 1700);
    return () => window.clearTimeout(t);
  }, [filledArea]);

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
    setPet(false); // 🐕 (§6.11)
    setBarrierFree(false); // ♿ (§6.11)
    setSeasonal(false);
    setFestival(false);
    setNoRain(false);
    setQuiet(false);
    setScatter(false); // ⚖️ 기본(OFF) 복귀(§6.9B)
    setDateYmd(null); // 📅 '오늘' 복귀(§6.8)
    setHomeKm(null); // 🏠 '제한 없음' 복귀(§7.17) — 거주지 저장값은 건드리지 않는다
  };

  // 대상 축(🌊·🐕·♿)은 동시 1개(§6.11) — 하나를 켜면 나머지 둘을 끈다. UI 는 잠금으로
  //   이 상황을 거의 막지만, 상태 쪽에서도 불변식을 지켜야 "잠긴 사이 남아 있던 옛 축"이
  //   되살아나지 않는다(buildRandomQuery 의 우선순위 방출과 이중 안전).
  function toggleTarget(axis: "seaside" | "pet" | "barrierFree") {
    setSeaside(axis === "seaside" ? !seaside : false);
    setPet(axis === "pet" ? !pet : false);
    setBarrierFree(axis === "barrierFree" ? !barrierFree : false);
  }

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
          // 📊 이벤트의 mode 는 이제 파생값(§12.6) — 옛 세그먼트에선 '조건 걸고인데 조건 0개'도
          //    filtered 로 기록됐는데, 그건 실제로는 완전 랜덤 뽑기였다.
          store.recordDraw(data.place, {
            mode: hasCondition ? "filtered" : "pure",
            isRedraw,
          });
          if (updateAnchor) {
            const p = data.place;
            setAnchor(
              hasKoreaCoord(p)
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
    const qs = buildRandomQuery("filtered", areas, types, {
      seaside,
      pet, // 🐕 켜지면 지역·테마 미방출(§6.11)
      barrierFree, // ♿ 지역·테마·조건과 AND(§6.11)
      seasonal,
      festival,
      noRain,
      quiet,
      scatter, // ⚖️ 조건 모드 + ON 일 때만 방출(🌊 면 미방출, §6.9B)
      // 🏠 켜지면 이 축만 방출된다(🍃 제외) — 지역·테마·나머지는 서버가 안 본다(§7.17D).
      home:
        homeSigungu.home?.code && homeKm != null
          ? { code: homeSigungu.home.code, km: homeKm }
          : null,
      dateYmd: activeYmd, // 📅 미래 기준일이면 date 방출 + ☔ 미방출(§6.8)
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

  // 🔭 /map "빈 곳" CTA → router.push("/?emptySpot=1") 신호를 홈이 1회 소비(§7.11).
  //   store.ready 후라야 exclude 정확. ref 로 StrictMode 이중 실행·새로고침 재발화 차단 + 즉시 URL 제거.
  //   ⚠️ 이 훅은 runEmptySpot **선언 뒤**에 있어야 한다 — 위로 올리면 선언 전 접근이라
  //   react-hooks/immutability 가 막는다(홈 버튼이 없어져 다른 참조가 사라진 뒤로 실제 에러).
  useEffect(() => {
    // synced 까지 기다렸다 소비 — 병합 전 소비하면 exclude 가 비어 이미 방문한 곳이 뽑힐 수 있음.
    if (emptySpotSignalRef.current || !store.ready || !store.synced) return;
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("emptySpot") !== "1") return;
    emptySpotSignalRef.current = true;
    window.history.replaceState(null, "", window.location.pathname);
    // URL 신호(외부 상태)를 받아 뽑기를 시작하는 자리라 effect 안 setState 가 의도된 동작이다.
    // ref 가드로 1회만 실행되므로 연쇄 렌더도 없다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void runEmptySpot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.ready, store.synced]);

  // 🍃⚖️ 시연 딥링크(§7.16C) — 홈 도착 URL `?quiet=1&scatter=1` → 토글 초기 ON + URL 스트립.
  //   심사 시연·기능설명서에서 "조건을 켠 상태" URL 한 줄로 들어오기 위한 것(토글 켜는 걸 잊는
  //   실수 제거). 서버 동작은 무변 — 클라 토글 상태만 바꾼다.
  //   M32(§7.21): 모드 전환 줄이 사라졌다 — 모드가 파생이라 토글만 켜면 그대로 조건이 걸린다.
  //   ref 가드 + replaceState 는 🔭 신호(위)와 같은 M21 패턴. 토글 신호가 없으면 URL 을 건드리지
  //     않아 `?emptySpot=1` 같은 다른 신호를 삼키지 않는다.
  const deeplinkSignalRef = useRef(false);
  useEffect(() => {
    if (deeplinkSignalRef.current) return;
    const on = initialTogglesFromUrl(window.location.search);
    if (on.size === 0) return;
    deeplinkSignalRef.current = true;
    window.history.replaceState(null, "", window.location.pathname);
    // URL(외부 상태)을 읽어 초기 토글을 세우는 자리라 effect 안 setState 가 의도된 동작이다.
    // ref 가드로 1회만 실행되므로 연쇄 렌더도 없다.
    /* eslint-disable react-hooks/set-state-in-effect */
    if (on.has("quiet")) setQuiet(true);
    if (on.has("scatter")) setScatter(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  // 📍 /map 기록 행 → `?nearFrom=위도,경도&nearName=…` 신호 1회 소비(§7.21).
  //   기록 서랍이 스탬프북으로 이사하면서 그 안의 '주변 뽑기'가 홈으로 건너오는 길이다.
  //   🔭 emptySpot 과 같은 패턴 — ref 가드로 StrictMode 이중 실행·새로고침 재발화를 막고
  //   URL 을 즉시 지운다. 좌표 검증은 parseNearFrom(= lib/geo 한국 경계)이 끝내고 온다.
  const nearFromSignalRef = useRef(false);
  useEffect(() => {
    if (nearFromSignalRef.current) return;
    const at = parseNearFrom(window.location.search);
    if (!at) return;
    nearFromSignalRef.current = true;
    window.history.replaceState(null, "", window.location.pathname);
    // URL 신호(외부 상태)를 받아 거점을 세우고 뽑기를 시작하는 자리 — 🔭 와 같은 의도된 setState.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAnchor({ title: at.title, lat: at.lat, lng: at.lng });
    void runDraw(`/api/random?${buildNearbyQuery(at.lat, at.lng)}`, false, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 🍃 TOP5 칩 탭(§7.16A) — 그 시·군·구에서 원샷 뽑기. 조건 패널 상태와 무관한 별도 진입점이라
  //   buildRandomQuery 를 거치지 않는다(📍 주변 뽑기 동형 — "조건 0개 = 완전 랜덤" 무침범).
  //   빌더 없이 한 조각(`only=<code>`)만 붙인다 — code 는 서버 화이트리스트 통과 값이라 인코딩 불필요.
  function drawQuietTop(code: string) {
    void runDraw(`/api/random?only=${code}`, false, true);
    resultRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  // 📍 결과 카드의 "주변에서 뽑기" — 현재 앵커 좌표 반경 내 랜덤. 앵커는 그대로 유지.
  function drawNearby() {
    if (!anchor) return;
    const url = `/api/random?${buildNearbyQuery(anchor.lat, anchor.lng)}`;
    void runDraw(url, true, false);
  }

  // 📍 내 위치에서 뽑기(§7.19) — 기기 좌표를 앵커로 삼아 그 주변에서 뽑는다. 좌표는 100m 로
  //   뭉개져 조회에만 쓰이고 저장되지 않는다(lib/geolocate · /privacy 고지). 실패는 reject 가
  //   아니라 한국어 문구로 돌아오므로 그대로 에러 카드에 얹는다(뽑기 실패 경로와 같은 자리).
  async function drawFromMyLocation() {
    if (loading || geoPending) return;
    setGeoPending(true);
    const found = await locate();
    setGeoPending(false);
    if (!found.ok) {
      setStatus({ kind: "error", error: { error: found.message } });
      return;
    }
    // 앵커를 직접 세우고 updateAnchor=false — 거점은 결과(주변 장소)가 아니라 내 위치다(drawNearbyFrom 동형).
    setAnchor({ title: "내 위치", lat: found.lat, lng: found.lng });
    const url = `/api/random?${buildNearbyQuery(found.lat, found.lng)}`;
    void runDraw(url, false, false);
    resultRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  // 🧭 반나절 코스 만들기(M20) — 현재 결과 place 를 앵커로 전체 코스 생성. 재클릭 = 전체 재생성.
  function openCourse() {
    if (status.kind !== "ok") return;
    const p = status.data.place;
    if (!hasKoreaCoord(p)) return; // 좌표 없으면 애초에 버튼 미렌더(가드 중복)
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

  // 🧭 코스 저장 토글(§7.10 백로그 ①) — 지금 화면의 앵커+스텝 조합을 기기에 남긴다.
  function toggleSaveCourse() {
    if (course.kind !== "ok") return;
    store.toggleCourseSave(course.anchor, course.data.steps);
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

  // 🧭 지금 코스의 조합 키 — 스텝을 하나라도 재뽑으면 키가 바뀌어 저장 표시가 저절로 풀린다
  //   (저장된 것은 그때 본 그 조합이지, 이후 바뀐 코스가 아니다).
  const currentCourseKey =
    course.kind === "ok"
      ? courseKey(
          course.anchor.contentId,
          course.data.steps.map((s) => s.place.contentId),
        )
      : null;

  const loading = status.kind === "loading";
  const currentIsNearby =
    status.kind === "ok" && status.data.picked.distanceM != null;
  // 📍 near= 경로는 서버가 지역·테마·조건을 무시한다(§7.6) — 조건이 걸린 채로 이 버튼을 내주면
  //    조건이 조용히 무시된다. 이미 주변 결과인 경우만 예외(옛 mode === "pure" 판정과 동치).
  const canDrawNearby = !!anchor && (!hasCondition || currentIsNearby);

  // 🎰 지도에 넘길 phase — 기존 draw lifecycle 에서 파생(새 상태 아님).
  const mapPhase = loading ? "loading" : status.kind === "ok" ? "result" : "idle";

  return (
    <main className="mx-auto w-full max-w-[720px] flex-1 px-5 pb-12 pt-6">
      <div className="mb-4 flex items-center gap-2.5">
        <div className="flex flex-1 items-center gap-2.5">
          <span className="inline-flex h-[34px] w-[34px] items-center justify-center rounded-[10px] bg-g-primary text-g-on-primary">
            <Icon name="map" size={19} />
          </span>
          <h1 className="font-display text-[24px] font-bold leading-[1.15] tracking-[-0.03em]">
            어디든
          </h1>
        </div>
        <InstallButton />
        <AuthButtons />
      </div>

      {/* 🎫 티켓 카드 — 스텁(정복 현황) · 지도면(룰렛) · 절취선 · 탑승 조건과 CTA.
          overflow-hidden 이 절취선 양끝 원을 반달로 잘라 노치를 만든다. */}
      <section className="relative overflow-hidden rounded-2xl border border-g-border bg-g-surface">
        {/* 🎰 스탯 행 + 정복 지도 룰렛(§7.12) — 좌표만 넘기고 시·군·구 판정은 지도 청크 안에서(번들 보호) */}
        <HomeConquerMap
          visited={store.visited}
          storeReady={store.ready}
          phase={mapPhase}
          landedLat={status.kind === "ok" ? status.data.place.lat : null}
          landedLng={status.kind === "ok" ? status.data.place.lng : null}
        />

        {loading && <SlotMachine />}

        {/* 절취선 — 좌우 끝의 22px 원을 카드 밖으로 반쯤 밀어내면 overflow-hidden 이 잘라 노치가 된다. */}
        <div className="relative flex h-[22px] items-center px-4" aria-hidden>
          <span className="absolute -left-[11px] top-0 h-[22px] w-[22px] rounded-full border border-g-border bg-g-bg" />
          <span className="flex-1 border-t-2 border-dashed border-g-border" />
          <span className="absolute -right-[11px] top-0 h-[22px] w-[22px] rounded-full border border-g-border bg-g-bg" />
        </div>

        <div className="flex flex-col gap-3.5 px-5 pb-5 pt-[18px]">
          {/* 🎫 조건 요약 한 줄(§7.21) — 옛 [아무 데나 | 조건 걸고] 세그먼트 + 959px 인라인
              패널의 자리. 상태를 말하고 시트를 여는 일만 한다(조건 자체는 시트 안에). */}
          <ConditionBar
            summary={summary}
            count={count}
            unit={homeOn ? "개 동네" : "곳"}
            onOpen={() => setCondOpen(true)}
            disabled={loading}
          />

          {/* 유일한 전국 랜덤 뽑기 버튼 — 화면에서 유일하게 채워진 주홍 면(= 행동).
              결과가 뜬 뒤엔 "다시 굴리기"로 라벨·아이콘만 바뀐다(결과 카드에 뽑기 버튼 중복 없음).
              그림자는 이 버튼만 예외로 허용된 틴티드 섀도(designGuide 모양표). */}
          <button
            type="button"
            onClick={() => draw(status.kind === "ok")}
            disabled={loading}
            className="inline-flex h-[60px] w-full items-center justify-center gap-2.5 rounded-[20px] bg-g-accent text-[17px] font-bold tracking-[-0.01em] text-g-on-accent shadow-[0_10px_22px_-12px_rgba(154,56,24,.85),0_1px_2px_rgba(22,50,58,.08)] [corner-shape:squircle] hover:bg-g-accent-hover disabled:cursor-default disabled:opacity-60"
          >
            {loading ? (
              "지도를 굴리는 중…"
            ) : (
              <>
                <Icon name={status.kind === "ok" ? "refresh" : "dice"} size={20} />
                {status.kind === "ok" ? "다시 굴리기" : "지도 굴리기"}
              </>
            )}
          </button>

          {/* 📍 내 위치에서 뽑기(§7.19) — 권한 팝업은 이 클릭에서만 뜬다(방문 즉시 묻지 않는다:
              이유 없이 뜬 권한창은 거절률이 높고, 한 번 거절되면 되돌리기가 번거롭다).
              🍃 TOP5 칩과 같은 별도 진입점이라 조건 패널 상태를 보지 않는다 — near 경로는 서버가
              지역·테마·조건을 무시하므로(§7.6) 조건 모드에서도 동작이 같다. */}
          <button
            type="button"
            onClick={() => void drawFromMyLocation()}
            disabled={loading || geoPending}
            className="inline-flex h-[46px] w-full items-center justify-center gap-2 rounded-2xl border-[1.5px] border-g-primary bg-g-surface text-[14px] font-bold text-g-primary transition-transform duration-200 [corner-shape:squircle] hover:-translate-y-px hover:bg-g-primary-soft disabled:cursor-default disabled:opacity-60"
          >
            <Icon name="pin" size={16} />
            {geoPending ? "내 위치를 찾는 중…" : "내 주변에서 뽑기"}
          </button>
        </div>

        {/* 🎉 방금 정복한 시·도 토스트(§7.8) — 통합 카드 우상단 */}
        {store.ready && filledArea != null && (
          // 밝은 잉크(--g-on-primary)를 얹으므로 --g-primary(4.59:1)가 아니라
          // --g-primary-deep(7.2:1) — designGuide 「대비 함정 1」.
          <div className="animate-fade-up absolute right-3.5 top-3.5 rounded-full bg-g-primary-deep px-3 py-1.5 text-[12px] font-bold text-g-on-primary">
            {AREA_NAME[filledArea]} 정복! · 내 지도 +1
          </div>
        )}
      </section>

      {/* aria-live: 로딩→결과 전환을 같은 컨테이너에서 교체해 스크린리더가 새 결과를 안내.
          결과·에러 카드는 통합 카드 **밖** 아래로(카드는 지도+뽑기 전용). */}
      <div ref={resultRef} aria-live="polite">
        {status.kind === "ok" && (
          <div className="mt-3.5">
            <ResultCard
              key={seq}
              data={status.data}
              onDrawNearby={canDrawNearby ? drawNearby : null}
              anchorTitle={anchor?.title ?? null}
              onOpenCourse={
                hasKoreaCoord(status.data.place) ? openCourse : null
              }
              courseLoading={course.kind === "loading"}
              saved={store.isSaved(status.data.place.contentId)}
              visited={store.isVisited(status.data.place.contentId)}
              onToggleSave={() => store.toggleSave(status.data.place)}
              onToggleVisit={() => handleToggleVisit(status.data.place)}
              onNavigate={() => store.logNavigate(status.data.place)}
            />
          </div>
        )}
        {status.kind === "error" && (
          <div className="mt-3.5">
            <ErrorPanel
              error={status.error}
              onClearConditions={hasCondition ? clearFilters : null}
            />
          </div>
        )}
      </div>

      {/* 🧭 반나절 코스(M20) — 결과 aria-live 컨테이너 밖(중첩·통째 낭독 방지), 결과 있을 때만 */}
      {status.kind === "ok" && course.kind !== "idle" && (
        <div className="mt-3.5">
          <CoursePanel
            state={course}
            onRedrawStep={redrawCourseStep}
            onRetry={openCourse}
            saved={currentCourseKey != null && store.isCourseSaved(currentCourseKey)}
            onToggleSave={toggleSaveCourse}
          />
        </div>
      )}

      {/* 🍃📈 둘러보기(§7.16A·B) — 한적 TOP5 스트립 + 쏠림 진입점을 **한 카드**로 묶고,
          결과 엽서가 뜨면 접는다(§7.21). 오버투어리즘 정면 노출은 유지하되, 뽑고 난 뒤의 화면은
          결과·코스가 주인공이라 상시 점유를 풀었다.
          ⚠️ 임팩트 링크는 스트립 **밖**이다 — 혼잡도 데이터가 stale 이면 스트립이 통째로 사라지는데,
             이 링크는 그와 무관하게 있어야 한다(서사 진입점이 데이터 신선도에 인질 잡히지 않게).
             스트립이 없을 때 윗선만 뜨는 걸 막는 건 first:border-t-0 가 한다(JS 조건 불필요).
          ⚠️ 배수(핸드오프 시안의 "서울은 세종보다 71배")를 여기 박지 않는다 — 그 값은 /impact ①이
             공공 데이터에서 매번 계산하는 값이라 정적 문구로 두면 곧 어긋난다(구현 시점 실측 68.4배로
             이미 시안과 불일치). 홈은 배수를 말하지 않고, 실값은 언제나 /impact ① 캡션이 낸다. */}
      {status.kind !== "ok" && (
        <section className="mt-3.5 overflow-hidden rounded-[14px] border border-g-border bg-g-surface">
          <QuietTopStrip onPick={drawQuietTop} disabled={loading} />
          <div className="flex items-center gap-3 border-t border-g-border bg-[#fffdf7] px-4 py-3.5 first:border-t-0">
            <span className="inline-flex h-8 w-8 flex-none items-center justify-center rounded-full bg-g-warning-soft text-g-warning-text">
              <Icon name="scales" size={16} />
            </span>
            <p className="flex-1 text-[13px] leading-[1.55] text-g-text-2">
              <b className="font-bold text-g-text">전국 방문</b>이 얼마나 쏠렸는지 —{" "}
              <Link
                href="/impact"
                className="font-bold underline underline-offset-2 hover:text-g-primary"
              >
                숫자로 보기
              </Link>
            </p>
          </div>
        </section>
      )}

      {/* 🎫 조건 시트(§7.21) — fixed 오버레이라 티켓 카드의 overflow-hidden 밖(main 끝)에 둔다.
          닫힌 동안은 아무것도 렌더하지 않으므로 🏠 거주지 목록(~20KB) 청크도 열 때 받는다(§7.17E). */}
      <FilterSheet
        open={condOpen}
        count={count}
        unit={homeOn ? "개 동네" : "곳"}
        canClear={hasCondition}
        onClear={clearFilters}
        onClose={() => setCondOpen(false)}
        onDraw={() => {
          setCondOpen(false);
          draw(status.kind === "ok");
        }}
        drawing={loading}
      >
        <FilterPanel
          selectedAreas={areas}
          selectedTypes={types}
          seaside={seaside}
          pet={pet}
          barrierFree={barrierFree}
          seasonal={seasonal}
          festival={festival}
          noRain={noRain}
          quiet={quiet}
          scatter={scatter}
          activeYmd={activeYmd}
          home={homeSigungu.home}
          homeKm={homeKm}
          homeSaving={homeSigungu.saving}
          onSelectHomeKm={setHomeKm}
          onSaveHome={(code) => void homeSigungu.save(code)}
          onToggleArea={toggleArea}
          onToggleType={toggleType}
          onToggleSeaside={() => toggleTarget("seaside")}
          onTogglePet={() => toggleTarget("pet")}
          onToggleBarrierFree={() => toggleTarget("barrierFree")}
          onToggleSeasonal={() => setSeasonal((v) => !v)}
          onToggleFestival={() => setFestival((v) => !v)}
          onToggleNoRain={() => setNoRain((v) => !v)}
          onToggleQuiet={() => setQuiet((v) => !v)}
          onToggleScatter={() => setScatter((v) => !v)}
          onSelectDate={setDateYmd}
        />
      </FilterSheet>
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
  // 실제 키 누락 메시지일 때만 힌트를 붙인다 — code 만 보면 단순 상류 타임아웃까지
  // '설정 고장'처럼 보여 사용자를 엉뚱한 곳으로 보낸다(§6.5).
  const isKeyIssue = error.error.includes("TOUR_API_KEY");
  return (
    <div className="w-full rounded-2xl bg-g-warning-soft p-4 text-center text-[13px] leading-[1.6] text-g-warning-text">
      <p className="inline-flex items-center gap-1.5 font-medium">
        <Icon name="warning" size={14} />
        {error.error}
      </p>
      {isKeyIssue && (
        <p className="mt-2">
          서버의 <code className="font-mono">TOUR_API_KEY</code> 설정을 확인해 주세요. (
          <code className="font-mono">.env.local.example</code> 참고)
        </p>
      )}
      {onClearConditions && (
        <button
          type="button"
          onClick={onClearConditions}
          className="mt-2.5 rounded-[14px] border border-g-warning-text/40 px-3.5 py-2 text-[12px] font-medium [corner-shape:squircle] hover:bg-g-surface"
        >
          조건 초기화
        </button>
      )}
    </div>
  );
}

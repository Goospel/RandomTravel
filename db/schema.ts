// M10 DB 스키마 (Drizzle + Neon Postgres).
// - user/account/session/verificationToken: Auth.js Drizzle 어댑터 표준 스키마.
//   (session 은 JWT 전략이라 실제로는 미사용이나, 어댑터 타입 충족 위해 정의는 둔다.)
// - user_place: 앱 데이터 — 로그인 사용자의 찜/방문 목록(SavedPlace 서버판).

import {
  pgTable,
  text,
  timestamp,
  integer,
  bigint,
  doublePrecision,
  primaryKey,
  unique,
  index,
} from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";

export const users = pgTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  // 카카오 개인 앱 등 이메일 미제공 provider 대응 — nullable. 신원은 account
  // (provider+providerAccountId)로 식별하므로 email 은 필수 아님.
  email: text("email"),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  image: text("image"),
  // 🏠 거주지 시·군·구 통계청 5자리(M28 §7.17A) — 미설정은 null(회원이어도 선택).
  //   좌표가 아니라 **코드**를 저장한다: 뽑기·exclude·only 가 전부 이 축이라 변환 지점이 안 생기고,
  //   집 주소 수준의 위치정보를 보관하지 않아도 된다(§12.4 최소 수집).
  homeSigungu: text("home_sigungu"),
});

export const accounts = pgTable(
  "account",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    primaryKey({ columns: [account.provider, account.providerAccountId] }),
  ],
);

export const sessions = pgTable("session", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_token",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => [primaryKey({ columns: [vt.identifier, vt.token] })],
);

// 앱 데이터: 로그인 사용자의 찜(saved)·방문(visited) 목록.
// SavedPlace(lib/travelStore) 와 필드 대응. (userId, list, contentId) 유일 —
// 한 사용자·종류 안에서 같은 장소는 한 번만.
export const userPlaces = pgTable(
  "user_place",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    list: text("list").$type<"saved" | "visited">().notNull(),
    contentId: text("content_id").notNull(),
    contentTypeId: integer("content_type_id").notNull(),
    title: text("title").notNull(),
    address: text("address").notNull(),
    image: text("image"),
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
    areaCode: integer("area_code"),
    savedAt: bigint("saved_at", { mode: "number" }).notNull(), // epoch ms
    // 📊 재방문 의향 평가(M15) — 1|2|3, 미평가는 null. visited 항목에만 의미.
    rating: integer("rating"),
  },
  (t) => [unique().on(t.userId, t.list, t.contentId)],
);

// ─── 🍃 한적 필터 혼잡도 데이터(M17, plan.md §6.7) ───────────────────────────
// 일 1회 Vercel Cron 배치가 적재하고, 뽑기·후보 수 요청은 DB 조회만(외부 API 0콜).
// ⚠️ 시군구 코드 컬럼은 두 테이블 모두 sigungu_cd 로 통일한다 — API 원어가
//   집중률=signguCd / 방문자수=signguCode 로 서로 달라 오히려 혼동이라 흡수. 값은 법정동 5자리.

// 집중률: 시군구×날짜 집계(관광지 스팟들의 중앙값). PK (sigungu_cd, base_ymd).
export const congestionDaily = pgTable(
  "congestion_daily",
  {
    sigunguCd: text("sigungu_cd").notNull(), // 법정동 signguCd
    baseYmd: text("base_ymd").notNull(), // YYYYMMDD(응답 기준일 그대로 — 날짜 가정 금지)
    spotCount: integer("spot_count").notNull(),
    medianRate: doublePrecision("median_rate").notNull(),
    crowdedShare: doublePrecision("crowded_share").notNull(),
    fetchedAt: bigint("fetched_at", { mode: "number" }).notNull(), // epoch ms — 신선도 축
  },
  (t) => [primaryKey({ columns: [t.sigunguCd, t.baseYmd] })],
);

// 방문자수: 시군구×날짜×관광객구분. ⚖️ 분산 모드(M22 §6.9B)가 외지인 행을 역가중에 쓴다.
export const visitorDaily = pgTable(
  "visitor_daily",
  {
    sigunguCd: text("sigungu_cd").notNull(), // 법정동 signguCode
    baseYmd: text("base_ymd").notNull(),
    // 관광객 구분 — 실값 "1"현지인/"2"외지인/"3"외국인(실측 2026-07: 268행씩 3구분).
    // ⚠️ 이전 주석의 a/b/c 는 오기였다(API 문서 표기와 실응답 불일치) — M22 에서 정정.
    touDivCd: text("tou_div_cd").notNull(),
    touNum: doublePrecision("tou_num").notNull(),
  },
  (t) => [primaryKey({ columns: [t.sigunguCd, t.baseYmd, t.touDivCd] })],
);

// ─── 📈 익명 여행 행동 이벤트(M26 · §12.6 P1, plan.md §7.15) ─────────────────
// POST /api/events 가 적재하고 GET /api/impact 가 집계만 읽는다.
//
// ⚠️ **users 참조를 두지 않는다** — 로그인 계정과 조인 불가를 스키마로 강제해 §12.4
//   "익명정보(집계 통계)" 형태를 유지한다. sessionId 는 브라우저가 만든 익명 UUID다.
//   (FK 를 넣는 순간 익명성은 코드 규율에만 의존하게 되고, 그 규율은 언젠가 샌다.)
// 인덱스 (event, ts) — 집계가 event 로 좁히고, 후속 기간 필터가 ts 로 자른다.
export const travelEvents = pgTable(
  "travel_event",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    event: text("event").notNull(), // draw|redraw|like|navigate|visited (§12.5)
    mode: text("mode"), // pure|filtered — draw·redraw 에만 유효
    areaCode: integer("area_code"),
    contentTypeId: integer("content_type_id"),
    contentId: text("content_id"),
    sessionId: text("session_id").notNull(), // 익명 UUID(기기·개인 식별 불가)
    ts: bigint("ts", { mode: "number" }).notNull(), // 클라 발생 시각(epoch ms)
  },
  (t) => [index("travel_event_event_ts_idx").on(t.event, t.ts)],
);

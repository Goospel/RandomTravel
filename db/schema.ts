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

// 방문자수: 시군구×날짜×관광객구분(a현지인/b외지인/c외국인). M17은 적재만(활용은 후속).
export const visitorDaily = pgTable(
  "visitor_daily",
  {
    sigunguCd: text("sigungu_cd").notNull(), // 법정동 signguCode
    baseYmd: text("base_ymd").notNull(),
    touDivCd: text("tou_div_cd").notNull(), // 관광객 구분 a/b/c
    touNum: doublePrecision("tou_num").notNull(),
  },
  (t) => [primaryKey({ columns: [t.sigunguCd, t.baseYmd, t.touDivCd] })],
);

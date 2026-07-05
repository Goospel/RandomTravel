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

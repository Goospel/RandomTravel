// Neon(서버리스 Postgres) + Drizzle 클라이언트.
// DATABASE_URL 은 실제 쿼리 시점에만 필요하다. 아직 설정 전(스캐폴딩·env 미주입 빌드)
// 이라도 모듈 로드가 throw 하지 않도록, 형식만 유효한 플레이스홀더로 생성한다.
// (플레이스홀더로는 쿼리가 실패하지만, 빌드의 정적 페이지 수집 단계에선 쿼리를 하지 않음.)

import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

const connectionString =
  process.env.DATABASE_URL ?? "postgresql://placeholder:placeholder@localhost/placeholder";

export const db = drizzle(neon(connectionString), { schema });

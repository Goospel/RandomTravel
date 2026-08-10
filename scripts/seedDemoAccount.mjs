// 🎫 심사용 데모 계정 시드(§14.1) — 빈 계정으로 로그인하면 정복 지도·기록 서랍이 전부 비어
// 심사위원이 볼 게 없다. 다녀온 곳 6 + 찜 3(전부 서로 다른 시·도)과 거주지를 미리 채워 둔다.
//
// 실행: node --env-file=.env.local scripts/seedDemoAccount.mjs
//   - DATABASE_URL 은 이 스크립트 안에서만 읽고 **값을 출력하지 않는다**(레포 관례).
//   - ⚠️ 로컬·프로덕션 공용 Neon 이라 실행 즉시 프로덕션에 반영된다(의도된 것).
//   - 멱등: user 는 id, user_place 는 (user_id, list, content_id) 충돌 시 갱신 → 재실행 안전.
//   - 장소 데이터는 실존 관광 콘텐츠를 실제 조회해 고정 기재했다(searchKeyword2 실측 2026-08-10).
//     areaCode 는 응답 areacode 가 자주 비어 lDongRegnCd 로 판별한 값(lib/ldong 과 같은 규칙).

import fs from "node:fs";
import path from "path";
import { fileURLToPath } from "url";
import { neon } from "@neondatabase/serverless";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "..");

// 데모 계정 id 는 lib/demoLogin.ts 가 단일 출처다 — .mjs 에서 TS 를 import 할 수 없어
//   값을 복제하는 대신 **그 파일에서 읽어 온다**(복제하면 언젠가 갈라진다).
function readDemoUserId() {
  const src = fs.readFileSync(path.join(REPO, "lib", "demoLogin.ts"), "utf8");
  const m = src.match(/DEMO_USER_ID\s*=\s*"([0-9a-f-]{36})"/);
  if (!m) throw new Error("lib/demoLogin.ts 에서 DEMO_USER_ID 를 못 찾음 — 상수명이 바뀌었나?");
  return m[1];
}

const HOME_SIGUNGU = "11010"; // 서울 종로구 — 🏠 집에서 갈 만한 곳(M28) 시연용

// savedAt 은 고정값(epoch ms) — 재실행해도 목록 순서가 흔들리지 않게 한다.
const D = (ymd) => Date.parse(`${ymd}T09:00:00+09:00`);

/** 다녀온 곳 6 — 시·도가 전부 다르다(정복 지도에 6조각). rating: 1|2|3|null */
const VISITED = [
  { contentId: "126508", contentTypeId: 12, title: "경복궁", address: "서울특별시 종로구 사직로 161 (세종로)", image: "https://tong.visitkorea.or.kr/cms/resource/98/3487598_image2_1.jpg", lat: 37.5760307, lng: 126.9767219, areaCode: 1, savedAt: D("2026-03-14"), rating: 3 },
  { contentId: "126081", contentTypeId: 12, title: "해운대해수욕장", address: "부산광역시 해운대구 해운대해변로 264", image: "https://tong.visitkorea.or.kr/cms/resource/34/3090534_image2_1.JPG", lat: 35.159084, lng: 129.1602786, areaCode: 6, savedAt: D("2026-04-05"), rating: 2 },
  { contentId: "128019", contentTypeId: 12, title: "남이섬", address: "강원특별자치도 춘천시 남이섬길 1 남이섬", image: "https://tong.visitkorea.or.kr/cms/resource/45/4067545_image2_1.jpg", lat: 37.7962651, lng: 127.5254892, areaCode: 32, savedAt: D("2026-05-02"), rating: 3 },
  { contentId: "126166", contentTypeId: 12, title: "경주 불국사 [유네스코 세계유산]", address: "경상북도 경주시 불국로 385 (진현동)", image: "https://tong.visitkorea.or.kr/cms/resource/70/3506170_image2_1.jpg", lat: 35.7923023, lng: 129.3317254, areaCode: 35, savedAt: D("2026-05-30"), rating: null },
  { contentId: "126730", contentTypeId: 12, title: "순천만습지", address: "전남광주통합특별시 순천시 순천만길 513-25", image: "https://tong.visitkorea.or.kr/cms/resource/14/4088614_image2_1.jpg", lat: 34.8858016, lng: 127.509283, areaCode: 38, savedAt: D("2026-06-21"), rating: 1 },
  { contentId: "126435", contentTypeId: 12, title: "성산일출봉 [유네스코 세계자연유산]", address: "제주특별자치도 서귀포시 성산읍 일출로 284-12", image: "http://tong.visitkorea.or.kr/cms/resource/82/2944282_image2_1.bmp", lat: 33.4581111, lng: 126.9415156, areaCode: 39, savedAt: D("2026-07-19"), rating: 3 },
];

/** 찜 3 — 아직 안 가 본 곳(다녀온 곳과 시·도도 겹치지 않는다). */
const SAVED = [
  { contentId: "2480899", contentTypeId: 12, title: "수원화성 관광특구", address: "경기도 수원시 팔달구 정조로 780 (팔달로2가)", image: "https://tong.visitkorea.or.kr/cms/resource/36/3500936_image2_1.jpg", lat: 37.277614, lng: 127.0167917, areaCode: 31, savedAt: D("2026-07-26"), rating: null },
  { contentId: "127866", contentTypeId: 12, title: "대천해수욕장", address: "충청남도 보령시 머드로 123", image: "https://tong.visitkorea.or.kr/cms/resource/66/3513866_image2_1.jpg", lat: 36.3103, lng: 126.5136, areaCode: 34, savedAt: D("2026-08-01"), rating: null },
  { contentId: "147656", contentTypeId: 12, title: "전주 경기전", address: "전북특별자치도 전주시 완산구 태조로 44 (풍남동3가)", image: "https://tong.visitkorea.or.kr/cms/resource_photo/45/3365745_image2_1.jpg", lat: 35.8141718, lng: 127.1500212, areaCode: 37, savedAt: D("2026-08-08"), rating: null },
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL 미설정 — node --env-file=.env.local 로 실행하세요.");
  }
  const sql = neon(url); // ⚠️ url 을 로그에 남기지 않는다

  const userId = readDemoUserId();

  await sql`
    INSERT INTO "user" (id, name, email, home_sigungu)
    VALUES (${userId}, ${"심사용 계정"}, ${"demo@travelanywhere.local"}, ${HOME_SIGUNGU})
    ON CONFLICT (id) DO UPDATE
      SET name = EXCLUDED.name, email = EXCLUDED.email, home_sigungu = EXCLUDED.home_sigungu
  `;

  for (const [list, rows] of [["visited", VISITED], ["saved", SAVED]]) {
    for (const p of rows) {
      await sql`
        INSERT INTO user_place
          (id, user_id, list, content_id, content_type_id, title, address, image, lat, lng, area_code, saved_at, rating)
        VALUES
          (${crypto.randomUUID()}, ${userId}, ${list}, ${p.contentId}, ${p.contentTypeId},
           ${p.title}, ${p.address}, ${p.image}, ${p.lat}, ${p.lng}, ${p.areaCode},
           ${p.savedAt}, ${p.rating})
        ON CONFLICT (user_id, list, content_id) DO UPDATE
          SET content_type_id = EXCLUDED.content_type_id,
              title = EXCLUDED.title,
              address = EXCLUDED.address,
              image = EXCLUDED.image,
              lat = EXCLUDED.lat,
              lng = EXCLUDED.lng,
              area_code = EXCLUDED.area_code,
              saved_at = EXCLUDED.saved_at,
              rating = EXCLUDED.rating
      `;
    }
  }

  // 적재 확인 — 값이 아니라 개수·목록만 출력한다.
  const [home] = await sql`SELECT home_sigungu FROM "user" WHERE id = ${userId}`;
  const counts = await sql`
    SELECT list, count(*)::int AS n FROM user_place WHERE user_id = ${userId} GROUP BY list ORDER BY list
  `;
  console.log(`거주지: ${home?.home_sigungu ?? "(없음)"}`);
  for (const c of counts) console.log(`${c.list}: ${c.n}건`);
  console.log(
    `시·도 ${new Set([...VISITED, ...SAVED].map((p) => p.areaCode)).size}곳 — 시드 완료`,
  );
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});

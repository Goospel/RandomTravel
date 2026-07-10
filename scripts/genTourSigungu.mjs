// 🔭 빈 곳에서 뽑기(M21, plan.md §7.11) — 앱 시·군·구(통계청 code) ↔ TourAPI sigunguCode 셀 매핑 생성기.
//
// TourAPI areaCode2 를 17개 시·도에 대해 1회씩(총 17콜) 호출해 시(市) 단위 셀(234개)을 얻고,
// 앱 KOREA_SIGUNGU 250개(구 단위)를 (area + 이름 접두) 로 각 셀에 조인한다(N:1 — 고양시 1셀 ← 3구).
//   - ⚠️ 코드값 직결 금지: TourAPI sigunguCode ↔ 통계청 code ↔ 법정동 signguCd 는 서로 다른 3체계.
//     다리는 항상 (area + 이름) 조인. members = 통계청 KOREA_SIGUNGU.code(좌표 검증·exclude 축).
//   - 특례 4건(개명·통합·편입)은 자동조인이 깨져 시드로 선탑재(§6.7 확정):
//       미추홀(앱 '남구'→TourAPI '미추홀구') · 세종('세종시'→'세종특별자치시') ·
//       부천('부천시') · 군위(앱 area 35 경북 → TourAPI area 4 대구).
//   - assert: 250 전수가 정확히 한 셀 소속. 실패 시 미매칭 전수를 한 번에 출력 후 throw.
//
// 재생성: node --env-file=.env.local scripts/genTourSigungu.mjs
//   (Node 20+ --env-file 로 .env.local 의 TOUR_API_KEY 를 읽는다 — 이 스크립트만 키가 필요.)

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "..");

const BASE = "https://apis.data.go.kr/B551011";

/** 17개 시·도 TourAPI areaCode — genKoreaMap 의 PREFIX_TO_AREA 값역과 동일(35/36/37/38 뒤바뀜 주의). */
const AREA_CODES = [1, 2, 3, 4, 5, 6, 7, 8, 31, 32, 33, 34, 35, 36, 37, 38, 39];

// §6.7 특례 4건 — (area+이름) 자동조인이 깨지는 개명·통합·편입.
//   키 = 앱(KOREA_SIGUNGU) 기준 `${area}:${이름}`, 값 = TourAPI 셀 신원 { area, name }.
//   ⚠️ 군위는 CROSS-AREA: 앱 area 35(경북) 이지만 TourAPI 는 대구(4) 소속(실측 '대구 9엔트리').
const SEED = {
  "2:남구": { area: 2, name: "미추홀구" }, // 인천 남구 → 미추홀구(2018 개명)
  "8:세종시": { area: 8, name: "세종특별자치시" }, // 세종시 → 세종특별자치시
  "31:부천시": { area: 31, name: "부천시" }, // 부천시(2016 구 폐지 — 단일 시)
  "35:군위군": { area: 4, name: "군위군" }, // 군위군 → 대구 편입(2023), 앱 area 는 경북(35) 유지
};

/**
 * B551011 게이트웨이 GET 호출(cron/congestion 의 gwFetch 이식 — 타입 제거).
 * Decoding 키를 URLSearchParams.set 으로 1회 인코딩, 성공은 response.header.resultCode==="0000".
 */
async function gwFetch(apiPath, params) {
  const key = process.env.TOUR_API_KEY;
  if (!key) throw new Error("TOUR_API_KEY 미설정 — node --env-file=.env.local 로 실행하세요.");

  const sp = new URLSearchParams();
  sp.set("serviceKey", key); // Decoding 키
  sp.set("MobileOS", "ETC");
  sp.set("MobileApp", "RandomTravel");
  sp.set("_type", "json");
  for (const [k, v] of Object.entries(params)) sp.set(k, String(v));

  const res = await fetch(`${BASE}/${apiPath}?${sp.toString()}`, { cache: "no-store" });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`응답 JSON 파싱 실패(키·인코딩·서비스 신청 확인): ${text.slice(0, 120)}`);
  }
  const code = json.response?.header?.resultCode;
  if (code !== "0000") {
    throw new Error(`${apiPath} 오류: ${json.response?.header?.resultMsg ?? "?"} (code ${code ?? "?"})`);
  }
  const items = json.response?.body?.items;
  if (!items || !items.item) return [];
  return Array.isArray(items.item) ? items.item : [items.item];
}

/** areaCode2 17콜 → 셀 목록 [{ area, sigunguCode, name }]. 로컬 캐시로 재실행 저렴·오프라인. */
async function loadCells() {
  const cache = path.join(REPO, "scripts", ".cache-tourSigungu.json");
  if (fs.existsSync(cache)) return JSON.parse(fs.readFileSync(cache, "utf8"));

  const cells = [];
  for (const area of AREA_CODES) {
    process.stderr.write(`areaCode2 area=${area} …\n`);
    const items = await gwFetch("KorService2/areaCode2", {
      areaCode: area,
      numOfRows: 100,
      pageNo: 1,
    });
    for (const it of items) {
      if (!it.code || !it.name) continue;
      cells.push({ area, sigunguCode: String(it.code), name: String(it.name) });
    }
  }
  try {
    fs.writeFileSync(cache, JSON.stringify(cells));
  } catch {
    /* 캐시 실패 무시 */
  }
  return cells;
}

// ── 앱 250 시·군·구(통계청 code) — .mjs 는 lib/koreaMap.ts(TS)를 import 못 하므로 JSON 투영 재사용.
const MAPPING = path.join(REPO, "scripts", "data", "code-mapping-result.json");
const { matched, unmatchedApp } = JSON.parse(fs.readFileSync(MAPPING, "utf8"));
const APP_SIGUNGU = [...matched.map((m) => m.app), ...unmatchedApp]; // { code, name, area } × 250

const cells = await loadCells();

// 셀 신원(area:name)별 members 누적. members = 통계청 code.
const membersByCell = new Map(); // "area:name" → string[]
const cellByKey = new Map(); // "area:name" → { area, sigunguCode, name }
for (const c of cells) {
  const k = `${c.area}:${c.name}`;
  if (!cellByKey.has(k)) cellByKey.set(k, c); // 중복 신원은 첫 등장 유지(TourAPI 중복 방어)
}

/** 앱 시·군·구 → 소속 셀 신원 "area:name"(없으면 null). 시드 우선, 그다음 동일 area 최장 접두 셀. */
function resolveCell(app) {
  const seedKey = `${app.area}:${app.name}`;
  const seed = SEED[seedKey];
  if (seed) {
    const k = `${seed.area}:${seed.name}`;
    return cellByKey.has(k) ? k : null;
  }
  // 동일 area 셀 중 이름이 app.name 의 접두인 것들 → 가장 긴 것(1:1 우선, 없으면 시-단위 셀).
  let best = null;
  for (const c of cells) {
    if (c.area !== app.area) continue;
    if (!app.name.startsWith(c.name)) continue;
    if (!best || c.name.length > best.name.length) best = c;
  }
  return best ? `${best.area}:${best.name}` : null;
}

const unmatched = [];
for (const app of APP_SIGUNGU) {
  const key = resolveCell(app);
  if (!key) {
    unmatched.push(app);
    continue;
  }
  if (!membersByCell.has(key)) membersByCell.set(key, []);
  membersByCell.get(key).push(app.code);
}

if (unmatched.length > 0) {
  process.stderr.write(`\n❌ 미매칭 앱 시·군·구 ${unmatched.length}건 — 시드/접두 조인 보강 필요:\n`);
  for (const a of unmatched) {
    const sameArea = cells.filter((c) => c.area === a.area).map((c) => c.name);
    process.stderr.write(`   ${a.area}:${a.name} (code ${a.code})  · 동일 area TourAPI 셀: ${sameArea.join(", ")}\n`);
  }
  throw new Error(`미매칭 ${unmatched.length}건 — 위 목록으로 SEED 보강 후 재실행.`);
}

// ── 산출물 조립: members 있는 셀만, 결정적 정렬(area 숫자 → 이름 ko).
const out = [];
let memberTotal = 0;
for (const [k, members] of membersByCell) {
  if (members.length === 0) continue;
  const cell = cellByKey.get(k);
  const sorted = [...members].sort(); // 통계청 code 오름차순(결정적)
  memberTotal += sorted.length;
  out.push({ area: cell.area, sigunguCode: cell.sigunguCode, name: cell.name, members: sorted });
}
out.sort((a, b) => a.area - b.area || a.name.localeCompare(b.name, "ko"));

// 전수·중복 assert.
if (memberTotal !== 250) {
  throw new Error(`members 합계 ${memberTotal} — 250 전수 기대(조인 누락/중복 확인).`);
}
const allMembers = out.flatMap((c) => c.members);
if (new Set(allMembers).size !== 250) {
  throw new Error(`members 중복 발견 — 고유 ${new Set(allMembers).size}/250.`);
}

const cellLines = out
  .map(
    (c) =>
      `  { area: ${c.area}, sigunguCode: ${JSON.stringify(c.sigunguCode)}, name: ${JSON.stringify(
        c.name,
      )}, members: [${c.members.map((m) => JSON.stringify(m)).join(", ")}] },`,
  )
  .join("\n");

const artifact = `// AUTO-GENERATED — 손으로 수정하지 말 것. 재생성: node --env-file=.env.local scripts/genTourSigungu.mjs
// 🔭 빈 곳에서 뽑기(M21, plan.md §7.11) — 앱 시·군·구 ↔ TourAPI sigunguCode 셀 매핑(N:1).
//   area+sigunguCode = TourAPI areaCode2 신원(뽑기 areaBasedList2 쿼리에 그대로 방출).
//   members = 통계청 KOREA_SIGUNGU.code(좌표 검증·exclude 축). ⋃members = 250 전수·중복 0.
//   ⚠️ 코드값 직결 금지 — 세 코드체계의 다리는 (area+이름) 조인뿐(scripts/genTourSigungu.mjs).

export interface TourSigunguCell {
  /** 소속 시·도 TourAPI areaCode */
  area: number;
  /** TourAPI sigunguCode(areaCode2 산출 — areaBasedList2 쿼리에 방출) */
  sigunguCode: string;
  /** TourAPI 시·군·구명 */
  name: string;
  /** 이 셀에 속한 앱 시·군·구 통계청 code(들). N:1 — 고양시 1셀 ← 3구 */
  members: string[];
}

/** TourAPI areaCode2 셀 ← 앱 시·군·구(통계청 code) N:1 매핑. members 있는 셀만. */
export const TOUR_SIGUNGU_CELLS: TourSigunguCell[] = [
${cellLines}
];

/** 셀에 속한 앱 시·군·구 총수 — 회귀 가드(250 전수·중복 0). */
export const TOUR_SIGUNGU_MEMBER_TOTAL = ${memberTotal};
`;

fs.writeFileSync(path.join(REPO, "lib", "tourSigungu.ts"), artifact);
process.stderr.write(
  `✅ lib/tourSigungu.ts 생성 — 셀 ${out.length}개, members ${memberTotal}/250 (TourAPI 셀 원본 ${cells.length}개)\n`,
);

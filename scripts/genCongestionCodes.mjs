// 🍃 한적 필터(M17, plan.md §6.7)용 앱 시·군·구 ↔ 법정동 시군구 코드 매핑 생성기 → lib/congestionCodes.ts.
//
// 손으로 못 옮기는 250행 산출물이라 이 스크립트로 재현한다(격자 대신 위경도만 두는 M11·정복 지도 원칙과 동일).
//   실행: node scripts/genCongestionCodes.mjs
//   입력(단일 출처 = 공식 코드표 xlsx):
//     - scripts/data/한국관광공사_OpenAPI_관광지_시군구_코드정보_v1.0.xlsx  ← 사람이 읽는 원자료(provenance)
//     - scripts/data/code-mapping-result.json  ← 위 xlsx(법정동 codebook)를 KOREA_SIGUNGU(통계청)와
//         (시·도 areaCode + 시군구명)으로 조인한 결정적 산출물. 이 스크립트의 기계 입력.
//         (codebook-sigungu.json = xlsx 파싱본 252행도 동일 폴더에 참조 보존)
//   출력: lib/congestionCodes.ts
//     - CONGESTION_SIGUNGU_CODES: `${area}:${시군구명}` → 집중률 API 법정동 signguCd(들)  (부천만 3코드)
//     - LDONG_TO_APP_AREA: 법정동 signguCd → 앱 시·도 areaCode (시·도 판정용 역인덱스)
//     - CONGESTION_SIGUNGU_TOTAL: 250 (회귀 가드)
//
// ⚠️ 코드 체계 세 개가 서로 다르다(§6.7): TourAPI areaCode / 통계청 5자리 / 법정동 5자리.
//    법정동 11110=종로구 ≠ 통계청 11110=노원구 → 코드값 직결 금지, 키는 항상 (area + 이름).

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "..");

const MAPPING = path.join(REPO, "scripts", "data", "code-mapping-result.json");

// §6.7 특례 4건 — (area+이름) 자동매치 실패분(개명·통합·편입)을 명시 오버라이드로 연결.
//   키 = 앱(KOREA_SIGUNGU) 기준 `${area}:${이름}`, 값 = 법정동 signguCd(들).
const SPECIAL = {
  "2:남구": ["28177"], // ① 인천 남구 → 미추홀구(2018 개명)
  "8:세종시": ["36110"], // ② 세종시 → 세종특별자치시
  "31:부천시": ["41192", "41194", "41196"], // ③ 부천시 → 원미·소사·오정 3구 집계
  "35:군위군": ["27720"], // ④ 군위군 → 대구 편입(2023). 앱 area 는 경북(35) 유지
};

const { matched, unmatchedApp } = JSON.parse(fs.readFileSync(MAPPING, "utf8"));

/** `${area}:${name}` → [법정동 signguCd] */
const codes = {};
/** 법정동 signguCd → 앱 areaCode */
const ldongToArea = {};

function put(area, name, sigunguCds) {
  const key = `${area}:${name}`;
  if (codes[key]) throw new Error(`중복 앱 시군구 키: ${key}`);
  codes[key] = sigunguCds;
  for (const cd of sigunguCds) {
    if (ldongToArea[cd] != null && ldongToArea[cd] !== area) {
      throw new Error(`법정동 ${cd} 가 area ${ldongToArea[cd]}·${area} 양쪽에 매핑됨`);
    }
    ldongToArea[cd] = area;
  }
}

// 246 자동매치: app(area+name) → book.sigunguCd (1:1)
for (const m of matched) put(m.app.area, m.app.name, [m.book.sigunguCd]);

// 특례 4건: unmatchedApp 각각을 SPECIAL 로 연결
for (const a of unmatchedApp) {
  const key = `${a.area}:${a.name}`;
  const cds = SPECIAL[key];
  if (!cds) throw new Error(`특례 매핑 누락(SPECIAL 갱신 필요): ${key}`);
  put(a.area, a.name, cds);
}

const total = Object.keys(codes).length;
if (total !== 250) throw new Error(`앱 시군구 키 ${total}개 — 250 기대(코드표 원자료 확인)`);

// 결정적 출력 — 키 정렬로 재생성 diff 안정. area 우선(숫자) 후 이름.
const sortByKey = (a, b) => {
  const [aa, an] = a[0].split(":");
  const [ba, bn] = b[0].split(":");
  return Number(aa) - Number(ba) || an.localeCompare(bn, "ko");
};
const codesLines = Object.entries(codes)
  .sort(sortByKey)
  .map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`)
  .join("\n");
const ldongLines = Object.entries(ldongToArea)
  .sort((a, b) => a[0].localeCompare(b[0]))
  .map(([k, v]) => `  ${JSON.stringify(k)}: ${v},`)
  .join("\n");

const out = `// AUTO-GENERATED — 손으로 수정하지 말 것. 재생성: node scripts/genCongestionCodes.mjs
// 🍃 한적 필터(M17, plan.md §6.7) — 앱 시·군·구(통계청 area+이름) ↔ 법정동 시군구 코드 매핑.
// 출처: 한국관광공사 관광지_시군구_코드정보 v1.0(활용매뉴얼 동봉, scripts/data/한국관광공사_OpenAPI_관광지_시군구_코드정보_v1.0.xlsx)
//   을 KOREA_SIGUNGU(통계청, lib/koreaMap.ts)와 (시·도 areaCode + 시군구명)으로 조인한 결정적 산출물
//   scripts/data/code-mapping-result.json 에서 생성. 특례 4건(남구→미추홀·세종·부천 3코드·군위→대구)은 §6.7.
// ⚠️ 코드값 직결 금지 — 법정동 11110=종로구 ≠ 통계청 11110=노원구. 키는 항상 (area + 이름).

/** 앱 시·군·구 \`\${area}:\${시군구명}\` → 집중률 API 가 쓰는 법정동 signguCd(들). 부천만 3코드. */
export const CONGESTION_SIGUNGU_CODES: Record<string, string[]> = {
${codesLines}
};

/** 법정동 signguCd → 앱 시·도 areaCode(역인덱스). 시·도 판정(quietAreaCodes)에서 시군구를 시·도로 묶을 때. */
export const LDONG_TO_APP_AREA: Record<string, number> = {
${ldongLines}
};

/** 앱 시·군·구 총수 — 회귀 가드(250 전수 매핑). */
export const CONGESTION_SIGUNGU_TOTAL = ${total};
`;

fs.writeFileSync(path.join(REPO, "lib", "congestionCodes.ts"), out);
process.stderr.write(
  `✅ lib/congestionCodes.ts 생성 — 앱 시군구 ${total}개, 법정동 코드 ${Object.keys(ldongToArea).length}개\n`,
);

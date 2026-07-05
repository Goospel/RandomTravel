// 🧩 전국 정복 지도(M12, plan.md §7.4)용 시·군·구 SVG 조각 + 시·도 외곽선 생성기 → lib/koreaMap.ts.
//
// 손으로 못 옮기는 산출물이라 이 스크립트로 재현한다(격자 대신 위경도만 두는 M11 원칙과 동일).
//   실행: node scripts/genKoreaMap.mjs
//   입력: 통계청 파생 시·군·구/시·도 경계 GeoJSON(southkorea-maps, public domain). 로컬 캐시 없으면 URL에서 받는다.
//   출력: lib/koreaMap.ts
//     - KOREA_MAP_VIEWBOX / KOREA_PROJECTION(방문 좌표를 같은 평면으로 투영하는 파라미터)
//     - KOREA_SIGUNGU: 시·군·구 250개 { code, name, area(TourAPI areaCode), rings(투영 [x,y,...] 평탄배열) }
//     - KOREA_SIDO_OUTLINES: 시·도 17개 외곽선 path d(방향 잡기용 오버레이)
//
// 투영: 위도 보정 등거리 투영(중위도 cos 보정). 시·군·구·시·도를 같은 bbox로 투영해 정확히 겹친다.
// 정복 판정은 런타임에서 방문 좌표를 KOREA_PROJECTION 으로 투영 후 rings 에 even-odd ray casting.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "..");

const MUNI_URL =
  "https://raw.githubusercontent.com/southkorea/southkorea-maps/master/kostat/2018/json/skorea-municipalities-2018-geo.json";
const PROV_URL =
  "https://raw.githubusercontent.com/southkorea/southkorea-maps/master/kostat/2018/json/skorea-provinces-2018-geo.json";

const EPS = Number(process.env.EPS ?? 0.005); // 단순화 허용오차(도) — 약 450m
const KEEP_RATIO = Number(process.env.KEEP ?? 0.02); // 최대 링 대비 이 비율 미만 섬 버림
const TARGET_W = 900;
const PAD = 10;

// 통계청 시도 code(앞 2자리) → TourAPI areaCode. 35/36/37/38 뒤바뀜 주의(전북/전남/경북/경남).
const PREFIX_TO_AREA = {
  "11": 1, "21": 6, "22": 4, "23": 2, "24": 5, "25": 3, "26": 7, "29": 8,
  "31": 31, "32": 32, "33": 33, "34": 34, "35": 37, "36": 38, "37": 35, "38": 36, "39": 39,
};
// 시·도 GeoJSON name → TourAPI areaCode(외곽선용).
const PROV_NAME_TO_AREA = {
  "서울특별시": 1, "인천광역시": 2, "대전광역시": 3, "대구광역시": 4,
  "광주광역시": 5, "부산광역시": 6, "울산광역시": 7, "세종특별자치시": 8,
  "경기도": 31, "강원도": 32, "충청북도": 33, "충청남도": 34,
  "경상북도": 35, "경상남도": 36, "전라북도": 37, "전라남도": 38, "제주특별자치도": 39,
};

async function loadGeo(url, cacheName) {
  const local = path.join(REPO, "scripts", cacheName);
  if (fs.existsSync(local)) return JSON.parse(fs.readFileSync(local, "utf8"));
  process.stderr.write(`fetching ${url}\n`);
  const res = await fetch(url);
  if (!res.ok) throw new Error("fetch failed: " + res.status);
  const text = await res.text();
  try { fs.writeFileSync(local, text); } catch { /* 캐시 실패 무시 */ }
  return JSON.parse(text);
}

function ringArea(r) {
  let a = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += r[j][0] * r[i][1] - r[i][0] * r[j][1];
  return Math.abs(a) / 2;
}
function perpDist(p, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(p[0] - ax, p[1] - ay);
  let t = ((p[0] - ax) * dx + (p[1] - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p[0] - (ax + t * dx), p[1] - (ay + t * dy));
}
// 반복형 Douglas-Peucker
function dp(points, eps) {
  const n = points.length;
  if (n < 3) return points.slice();
  const keep = new Uint8Array(n);
  keep[0] = 1; keep[n - 1] = 1;
  const stack = [[0, n - 1]];
  while (stack.length) {
    const [s, e] = stack.pop();
    let dmax = 0, idx = -1;
    const [ax, ay] = points[s], [bx, by] = points[e];
    for (let i = s + 1; i < e; i++) {
      const d = perpDist(points[i], ax, ay, bx, by);
      if (d > dmax) { dmax = d; idx = i; }
    }
    if (idx !== -1 && dmax > eps) { keep[idx] = 1; stack.push([s, idx]); stack.push([idx, e]); }
  }
  const out = [];
  for (let i = 0; i < n; i++) if (keep[i]) out.push(points[i]);
  return out;
}
// 피처 → 유지된(단순화된) 링 배열
function keptRings(f) {
  const g = f.geometry;
  let all = [];
  if (g.type === "Polygon") all = g.coordinates;
  else if (g.type === "MultiPolygon") for (const poly of g.coordinates) all.push(...poly);
  else throw new Error("unexpected geom: " + g.type);
  const withArea = all.map((r) => ({ r, a: ringArea(r) }));
  const maxA = Math.max(...withArea.map((x) => x.a));
  return withArea.filter((x) => x.a >= maxA * KEEP_RATIO).map((x) => dp(x.r, EPS));
}

const muni = await loadGeo(MUNI_URL, ".cache-muni-geo.json");
const prov = await loadGeo(PROV_URL, ".cache-provinces-geo.json");

// 1) 시·군·구 링 수집
const sigungu = [];
for (const f of muni.features) {
  const code = String(f.properties.code);
  const area = PREFIX_TO_AREA[code.slice(0, 2)];
  if (!area) throw new Error("unmatched sigungu prefix: " + code);
  sigungu.push({ code, name: f.properties.name, area, rings: keptRings(f) });
}
// 시·도 외곽선 링
const provOutlines = [];
for (const f of prov.features) {
  const area = PROV_NAME_TO_AREA[f.properties.name];
  if (!area) throw new Error("unmatched prov: " + f.properties.name);
  provOutlines.push({ area, rings: keptRings(f) });
}

// 2) 투영 bbox — 시·군·구 유지 점 전체(외곽선은 같은 데이터 파생이라 안에 들어옴)
let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
for (const s of sigungu) for (const r of s.rings) for (const [lng, lat] of r) {
  if (lng < minLng) minLng = lng; if (lng > maxLng) maxLng = lng;
  if (lat < minLat) minLat = lat; if (lat > maxLat) maxLat = lat;
}
const midLat = (minLat + maxLat) / 2;
const kx = Math.cos((midLat * Math.PI) / 180);
const scale = TARGET_W / ((maxLng - minLng) * kx);
const H = (maxLat - minLat) * scale;
const px = (lng) => (lng - minLng) * kx * scale + PAD;
const py = (lat) => (maxLat - lat) * scale + PAD;
const r1 = (n) => Math.round(n * 10) / 10;

// 3) 시·군·구 → 투영 평탄 rings([x0,y0,x1,y1,...])
const sigunguOut = sigungu.map((s) => {
  const rings = s.rings.map((r) => {
    const flat = [];
    let prevx = null, prevy = null;
    for (const [lng, lat] of r) {
      const x = r1(px(lng)), y = r1(py(lat));
      if (x === prevx && y === prevy) continue;
      flat.push(x, y); prevx = x; prevy = y;
    }
    return flat;
  }).filter((f) => f.length >= 6); // 3점 미만 링 제거
  return { code: s.code, name: s.name, area: s.area, rings };
});

// 4) 시·도 외곽선 → path d(stroke 오버레이)
const sidoOutlines = {};
for (const p of provOutlines) {
  let d = "";
  for (const r of p.rings) {
    let seg = "", prevx = null, prevy = null;
    for (const [lng, lat] of r) {
      const x = r1(px(lng)), y = r1(py(lat));
      if (x === prevx && y === prevy) continue;
      seg += (seg === "" ? "M" : "L") + x + " " + y + " ";
      prevx = x; prevy = y;
    }
    d += seg.trim() + "Z";
  }
  sidoOutlines[p.area] = d;
}

const viewBox = `0 0 ${r1(TARGET_W + PAD * 2)} ${r1(H + PAD * 2)}`;
const projection = { minLng: r1e(minLng), maxLat: r1e(maxLat), kx: r1e(kx), scale: r1e(scale), pad: PAD };
function r1e(n) { return Math.round(n * 1e7) / 1e7; } // 투영 파라미터는 정밀 유지

// 5) 방출
const sgLines = sigunguOut
  .map((s) => `  { code: "${s.code}", name: ${JSON.stringify(s.name)}, area: ${s.area}, rings: [${s.rings.map((r) => `[${r.join(",")}]`).join(",")}] },`)
  .join("\n");
const outlineLines = Object.keys(sidoOutlines)
  .map((a) => `  ${a}: ${JSON.stringify(sidoOutlines[a])},`)
  .join("\n");

const out = `// AUTO-GENERATED — 손으로 수정하지 말 것. 재생성: node scripts/genKoreaMap.mjs
// 🧩 전국 정복 지도(M12, plan.md §7.4)용 대한민국 시·군·구 SVG 조각 + 시·도 외곽선.
// 출처: southkorea/southkorea-maps (통계청 2018 경계 GeoJSON), public domain.
// 가공: 작은 섬 제거(KEEP=${KEEP_RATIO}) + Douglas-Peucker(EPS=${EPS}°) + 위도 보정 등거리 투영.
// area 는 TourAPI areaCode(통계청 code 앞2자리 매핑, 35/36/37/38 뒤바뀜 반영).

export const KOREA_MAP_VIEWBOX = "${viewBox}";

/** 방문 좌표(lat/lng)를 지도 평면(x,y)으로 옮기는 투영 파라미터 — 정복 판정용 */
export const KOREA_PROJECTION = {
  minLng: ${projection.minLng}, maxLat: ${projection.maxLat},
  kx: ${projection.kx}, scale: ${projection.scale}, pad: ${projection.pad},
} as const;

export interface Sigungu {
  /** 통계청 5자리 코드(고유키) */
  code: string;
  /** 시·군·구 이름 */
  name: string;
  /** 소속 시·도 TourAPI areaCode */
  area: number;
  /** 투영된 링들. 각 링은 평탄 배열 [x0,y0,x1,y1,...] */
  rings: number[][];
}

/** 시·군·구 ${sigunguOut.length}개 — 정복 지도의 퍼즐 조각 */
export const KOREA_SIGUNGU: Sigungu[] = [
${sgLines}
];

/** 전체 시·군·구 수(정복률 분모) */
export const KOREA_SIGUNGU_TOTAL = ${sigunguOut.length};

/** 시·도 17개 외곽선 path d — 방향 잡기용 stroke 오버레이(같은 투영) */
export const KOREA_SIDO_OUTLINES: Record<number, string> = {
${outlineLines}
};
`;

fs.writeFileSync(path.join(REPO, "lib", "koreaMap.ts"), out);
if (process.env.DUMP) {
  fs.writeFileSync(process.env.DUMP, JSON.stringify({ viewBox, projection, sigungu: sigunguOut, sidoOutlines }));
  process.stderr.write(`dumped JSON → ${process.env.DUMP}\n`);
}
const kb = (out.length / 1024).toFixed(1);
process.stderr.write(
  `wrote lib/koreaMap.ts — ${sigunguOut.length} 시군구, viewBox ${viewBox}, ${kb}KB, EPS=${EPS} KEEP=${KEEP_RATIO}\n`,
);

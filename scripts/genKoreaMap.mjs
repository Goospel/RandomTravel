// 🧩 전국 정복 지도(M12)용 시·도 SVG 경로 생성기 — lib/koreaMap.ts 를 만든다.
//
// 손으로 못 옮기는 산출물이라 이 스크립트로 재현한다(격자좌표 대신 위경도만 두는 M11 원칙과 동일).
//   실행: node scripts/genKoreaMap.mjs
//   입력: 통계청 파생 시·도 경계 GeoJSON(southkorea-maps, public domain). 로컬 캐시 없으면 URL에서 받는다.
//   출력: lib/koreaMap.ts (viewBox + areaCode별 path d + 라벨 중심 + 그리기 순서)
//
// 파라미터(환경변수): EPS(단순화 허용오차·도), KEEP(최대 링 대비 이 비율 미만 섬 버림), SRC(로컬 GeoJSON 경로).
// 좌표 변환: 위도 보정 등거리 투영(중위도 cos 보정) — 남한 규모에선 정식 투영과 육안 차이 없음.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "..");

const SRC_URL =
  "https://raw.githubusercontent.com/southkorea/southkorea-maps/master/kostat/2018/json/skorea-provinces-2018-geo.json";
const EPS = Number(process.env.EPS ?? 0.012);
const KEEP_RATIO = Number(process.env.KEEP ?? 0.008);
const TARGET_W = 780;
const PAD = 10;

// GeoJSON name(통계청) → TourAPI areaCode. 숫자 code는 35/36/37/38이 뒤바뀌어 있어 반드시 이름으로 매칭.
const NAME_TO_AREA = {
  "서울특별시": 1, "인천광역시": 2, "대전광역시": 3, "대구광역시": 4,
  "광주광역시": 5, "부산광역시": 6, "울산광역시": 7, "세종특별자치시": 8,
  "경기도": 31, "강원도": 32, "충청북도": 33, "충청남도": 34,
  "경상북도": 35, "경상남도": 36, "전라북도": 37, "전라남도": 38,
  "제주특별자치도": 39,
};

// 큰 도(道)를 먼저, 내부 enclave인 광역시를 나중에 그려 겹칠 때 위로 오게 한다(홀 없이도 정상 렌더).
const DRAW_ORDER = [31, 32, 33, 34, 35, 36, 37, 38, 39, 1, 2, 3, 4, 5, 6, 7, 8];

async function loadGeo() {
  const local = process.env.SRC || path.join(REPO, "scripts", ".cache-provinces-geo.json");
  if (fs.existsSync(local)) return JSON.parse(fs.readFileSync(local, "utf8"));
  process.stderr.write(`fetching ${SRC_URL}\n`);
  const res = await fetch(SRC_URL);
  if (!res.ok) throw new Error("fetch failed: " + res.status);
  const text = await res.text();
  try { fs.writeFileSync(local, text); } catch { /* 캐시 실패는 무시 */ }
  return JSON.parse(text);
}

function ringArea(r) {
  let a = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    a += r[j][0] * r[i][1] - r[i][0] * r[j][1];
  }
  return Math.abs(a) / 2;
}

function perpDist(p, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(p[0] - ax, p[1] - ay);
  let t = ((p[0] - ax) * dx + (p[1] - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p[0] - (ax + t * dx), p[1] - (ay + t * dy));
}

// 반복형 Douglas-Peucker(스택 — 대용량 링 재귀 스택오버플로 회피)
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

const fc = await loadGeo();

// 1) 피처별 링 수집 + 작은 섬 버리기 + DP 단순화
const provinces = [];
for (const f of fc.features) {
  const area = NAME_TO_AREA[f.properties.name];
  if (!area) throw new Error("unmatched province name: " + f.properties.name);
  const g = f.geometry;
  let allRings = [];
  if (g.type === "Polygon") allRings = g.coordinates;
  else if (g.type === "MultiPolygon") for (const poly of g.coordinates) allRings.push(...poly);
  else throw new Error("unexpected geom: " + g.type);

  const withArea = allRings.map((r) => ({ r, a: ringArea(r) }));
  const maxA = Math.max(...withArea.map((x) => x.a));
  const kept = withArea.filter((x) => x.a >= maxA * KEEP_RATIO).map((x) => dp(x.r, EPS));
  provinces.push({ area, rings: kept });
}

// 2) 투영 bbox(유지된 점 전체) — 위도 보정 등거리 투영
let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
for (const p of provinces) for (const r of p.rings) for (const [lng, lat] of r) {
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

// 3) areaCode별 path d + 라벨 중심(최대 링 bbox 중심)
const paths = {};
const labels = {};
for (const p of provinces) {
  let d = "";
  let bestCenter = null, bestA = -1;
  for (const r of p.rings) {
    let seg = "", prev = null;
    for (const [lng, lat] of r) {
      const x = r1(px(lng)), y = r1(py(lat));
      if (prev && prev[0] === x && prev[1] === y) continue;
      seg += (seg === "" ? "M" : "L") + x + " " + y + " ";
      prev = [x, y];
    }
    d += seg.trim() + "Z";
    let mnx = Infinity, mxx = -Infinity, mny = Infinity, mxy = -Infinity;
    for (const [lng, lat] of r) {
      const x = px(lng), y = py(lat);
      if (x < mnx) mnx = x; if (x > mxx) mxx = x; if (y < mny) mny = y; if (y > mxy) mxy = y;
    }
    const a = (mxx - mnx) * (mxy - mny);
    if (a > bestA) { bestA = a; bestCenter = { x: r1((mnx + mxx) / 2), y: r1((mny + mxy) / 2) }; }
  }
  paths[p.area] = d;
  labels[p.area] = bestCenter;
}

const viewBox = `0 0 ${r1(TARGET_W + PAD * 2)} ${r1(H + PAD * 2)}`;

// 4) lib/koreaMap.ts 방출
const pathLines = DRAW_ORDER.map((a) => `  ${a}: ${JSON.stringify(paths[a])},`).join("\n");
const labelLines = DRAW_ORDER.map((a) => `  ${a}: { x: ${labels[a].x}, y: ${labels[a].y} },`).join("\n");

const out = `// AUTO-GENERATED — 손으로 수정하지 말 것. 재생성: node scripts/genKoreaMap.mjs
// 🧩 전국 정복 지도(M12, plan.md §7.4)용 대한민국 17개 시·도 SVG 윤곽.
// 출처: southkorea/southkorea-maps (통계청 2018 시·도 경계 GeoJSON), public domain.
// 가공: 작은 섬 링 제거(KEEP=${KEEP_RATIO}) + Douglas-Peucker 단순화(EPS=${EPS}°) + 위도 보정 등거리 투영.
// 키는 TourAPI areaCode(SavedPlace.areaCode와 동일) — 통계청 code(35/36/37/38 뒤바뀜)와 다르니 주의.

export const KOREA_MAP_VIEWBOX = "${viewBox}";

/** 큰 도를 먼저, 내부 enclave 광역시를 나중에 그려 겹침 시 위로 오게 하는 순서 */
export const KOREA_DRAW_ORDER: number[] = [${DRAW_ORDER.join(", ")}];

/** areaCode → 시·도 윤곽 SVG path d */
export const KOREA_PROVINCE_PATHS: Record<number, string> = {
${pathLines}
};

/** areaCode → 라벨 중심 좌표(viewBox 기준) */
export const KOREA_PROVINCE_LABELS: Record<number, { x: number; y: number }> = {
${labelLines}
};
`;

fs.writeFileSync(path.join(REPO, "lib", "koreaMap.ts"), out);
process.stderr.write(
  `wrote lib/koreaMap.ts — viewBox ${viewBox}, ${(out.length / 1024).toFixed(1)}KB, EPS=${EPS} KEEP=${KEEP_RATIO}\n`,
);

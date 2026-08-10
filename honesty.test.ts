import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// 🔒 정직성·출처 문구 잠금 — 화면이 거짓말을 시작하는 지점을 막는 계측기.
//
//   plan.md §6.7(예측 사칭 금지) · §7.15(설계 확률/표본/인과 고지) · §14.2(출처 표기)가
//   "지우면 안 된다"고 못 박은 문구들인데, 지금까지 이걸 지키는 테스트가 **0건**이었다.
//   실측(2026-08-10): `(예측)` 삭제 · `실측 아님`→`조용한 확률` · `연관이지 인과가 아니에요`→`인과예요`
//   로 바꿔도 606건이 전부 통과했다. 카피 축약 작업에서 조용히 사라질 수 있다는 뜻이다.
//
//   ⚠️ 이 테스트는 **소스 문자열**을 본다(렌더가 아니라) — 순수 함수만 단위 테스트하는 이 저장소의
//   규약을 지키면서(jsdom·RTL 등 신규 의존성 0) 삭제만큼은 확실히 잡는 최소 계측기다.
//   문구를 바꿔야 하면 여기 기대값도 같이 고친다 — 그 순간이 "정말 지워도 되나"를 묻는 자리다.
//   ⚠️ **주석은 걷어내고 본다.** 안 그러면 화면 문구를 지워도 "지우지 말 것" 주석이 남아 테스트가
//   통과한다 — 돌연변이 실측에서 실제로 2건이 그렇게 살아남았다(2026-08-10).
//   `//` 는 줄 맨 앞(들여쓰기 허용)만 지운다 — 문자열 안 URL(`https://…`)을 잘라먹지 않게.
const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");

const read = (rel: string) =>
  stripComments(readFileSync(join(__dirname, rel), "utf8"));

const LOCKED: { file: string; must: string; why: string }[] = [
  {
    file: "components/FilterPanel.tsx",
    must: "한적한 곳 (예측)",
    why: "🍃 토글 설명문을 전부 지운 뒤 '(예측)'이 유일한 고지다 (§6.7)",
  },
  {
    file: "components/QuietTopStrip.tsx",
    must: "예측",
    why: "한적 스트립 우측 메타의 '예측 + 기준일' — 없으면 실시간 관측으로 읽힌다 (§6.7)",
  },
  {
    file: "components/QuietTopStrip.tsx",
    must: "공공데이터",
    why: "기능을 만난 순간에 출처를 제공한다는 결정 (§7.9 · §14.2)",
  },
  {
    file: "app/impact/page.tsx",
    must: "설계 확률 — 실측 아님",
    why: "②는 해석적 설계값이라 이 태그가 없으면 실측처럼 읽힌다 (§7.15)",
  },
  {
    file: "app/impact/page.tsx",
    must: "표본",
    why: "③ 표본 수 상시 노출 (§7.15)",
  },
  {
    file: "app/impact/page.tsx",
    must: "연관이지 인과가 아니에요",
    why: "③ 퍼널을 인과로 읽는 오해를 막는 유일한 문장 (§7.15)",
  },
  {
    file: "app/layout.tsx",
    must: "ⓒ한국관광공사",
    why: "공사 회신 2026-07-29 지침의 출처 표기 의무 (§14.2)",
  },
];

describe("정직성·출처 문구 잠금 (지우면 화면이 거짓말한다)", () => {
  for (const { file, must, why } of LOCKED) {
    it(`${file} — "${must}"`, () => {
      // toContain 이 아니라 boolean 단언 — 실패 시 파일 전문이 diff 로 쏟아지는 걸 막고
      // 대신 why(왜 지우면 안 되는지)가 실패 메시지로 나오게 한다.
      expect(read(file).includes(must), why).toBe(true);
    });
  }
});

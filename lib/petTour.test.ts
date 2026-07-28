import { describe, it, expect } from "vitest";
import {
  normalizePetInfo,
  isPreferredPetType,
  pickPreferred,
} from "@/lib/petTour";

describe("normalizePetInfo — 🐕 detailPetTour2 동반 필드 정규화 (§6.11)", () => {
  it("채워진 필드만 고정 순서 칩으로", () => {
    expect(
      normalizePetInfo({
        acmpyTypeCd: "전구역 동반가능",
        acmpyPsblCpam: "5kg 이하 소형견",
      }),
    ).toEqual({
      chips: [
        { label: "동반 유형", value: "전구역 동반가능" },
        { label: "동반 가능 동물", value: "5kg 이하 소형견" },
      ],
    });
  });

  it("네 필드 전부 있으면 순서는 유형 → 가능 동물 → 필요사항 → 기타", () => {
    const info = normalizePetInfo({
      etcAcmpyInfo: "기타",
      acmpyNeedMtr: "목줄 필수",
      acmpyPsblCpam: "소형견",
      acmpyTypeCd: "동반가능",
    });
    expect(info?.chips.map((c) => c.label)).toEqual([
      "동반 유형",
      "동반 가능 동물",
      "동반 시 필요사항",
      "기타 안내",
    ]);
  });

  it("빈 문자열·공백만인 필드는 버린다", () => {
    expect(
      normalizePetInfo({ acmpyTypeCd: "동반가능", acmpyPsblCpam: "   " }),
    ).toEqual({ chips: [{ label: "동반 유형", value: "동반가능" }] });
  });

  it("HTML 태그·&nbsp;·연속 공백을 정리한다(상류 텍스트 그대로 노출 금지)", () => {
    expect(normalizePetInfo({ acmpyNeedMtr: "목줄<br/>&nbsp; 배변봉투" })).toEqual({
      chips: [{ label: "동반 시 필요사항", value: "목줄 배변봉투" }],
    });
  });

  it("전부 비었거나 undefined 면 null(배지 미노출)", () => {
    expect(normalizePetInfo({})).toBeNull();
    expect(normalizePetInfo({ acmpyTypeCd: "", etcAcmpyInfo: " " })).toBeNull();
  });
});

describe("isPreferredPetType — 🐕 관광지성 우선 판정 (§6.11)", () => {
  it("관광지·문화시설·여행코스·레포츠는 관광지성", () => {
    for (const t of [12, 14, 25, 28]) expect(isPreferredPetType(t)).toBe(true);
  });

  it("숙박·쇼핑·음식점은 상업 — 우선 대상 아님", () => {
    for (const t of [32, 38, 39]) expect(isPreferredPetType(t)).toBe(false);
  });

  it("타입 미상(0·NaN)은 우선 대상 아님(보수적)", () => {
    expect(isPreferredPetType(0)).toBe(false);
    expect(isPreferredPetType(Number.NaN)).toBe(false);
  });
});

describe("pickPreferred — 관광지성 우선 '소프트 편향'(하드 제외 아님, §6.11)", () => {
  /** 배열을 순서대로 뱉는 공급자 — 네트워크 없이 루프 규칙만 검증 */
  const supplier = (queue: (string | null)[]) => {
    let i = 0;
    return { next: async () => queue[i++] ?? null, calls: () => i };
  };
  const good = (s: string) => s.startsWith("관광");

  it("관광지성이 나오면 즉시 수용하고 남은 예산을 안 쓴다", async () => {
    const s = supplier(["쇼핑A", "관광B", "관광C"]);
    expect(await pickPreferred(4, s.next, good)).toBe("관광B");
    expect(s.calls()).toBe(2); // 3·4번째는 부르지 않음
  });

  it("예산이 소진되면 마지막 상업 후보를 그대로 수용(빈 결과보다 낫다)", async () => {
    const s = supplier(["쇼핑A", "쇼핑B", "쇼핑C", "쇼핑D", "관광E"]);
    expect(await pickPreferred(4, s.next, good)).toBe("쇼핑D");
    expect(s.calls()).toBe(4); // 예산만큼만
  });

  it("거부된 후보(null)는 예산만 쓰고 보관 대상이 아니다", async () => {
    const s = supplier(["쇼핑A", null, null]);
    expect(await pickPreferred(3, s.next, good)).toBe("쇼핑A");
  });

  it("전부 null 이면 null(호출부가 EMPTY_POOL 로 이어간다)", async () => {
    expect(await pickPreferred(3, supplier([null, null, null]).next, good)).toBeNull();
  });

  it("예산 0이면 공급자를 아예 안 부른다(경계)", async () => {
    const s = supplier(["관광A"]);
    expect(await pickPreferred(0, s.next, good)).toBeNull();
    expect(s.calls()).toBe(0);
  });
});

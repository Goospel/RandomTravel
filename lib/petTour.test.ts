import { describe, it, expect } from "vitest";
import { normalizePetInfo } from "@/lib/petTour";

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

import { describe, it, expect } from "vitest";
import { isDrawablePlace, BLOCKED_CAT3 } from "@/lib/placeFilter";

// §6.10 비여행지 거부 필터 — TourAPI 풀에 섞인 생활·행정 시설(청소년수련원·도서관 등)을
// 뽑기 결과에서 걷어낸다. cat3 코드가 빈 항목이 실제로 있어 코드+제목 2겹으로 거부한다.

describe("isDrawablePlace", () => {
  it("차단 cat3 6종을 전부 거부한다", () => {
    for (const cat3 of BLOCKED_CAT3) {
      expect(isDrawablePlace({ cat3, title: "평범한 이름" })).toBe(false);
    }
  });

  it("cat3 가 비어도 제목의 생활시설 키워드로 거부한다", () => {
    // 실측 항목 — cat3 가 빈 채로 오는 케이스
    expect(isDrawablePlace({ cat3: "", title: "강남청소년센터" })).toBe(false);
    expect(isDrawablePlace({ title: "곡성군청소년야영장" })).toBe(false);
    expect(isDrawablePlace({ cat3: undefined, title: "경기도청소년수련원" })).toBe(
      false,
    );
    expect(isDrawablePlace({ title: "○○시립도서관" })).toBe(false);
    expect(isDrawablePlace({ title: "△△구민체육센터" })).toBe(false);
  });

  it("정상 여행지는 통과시킨다", () => {
    expect(isDrawablePlace({ cat3: "A01011200", title: "해운대해수욕장" })).toBe(
      true,
    );
    expect(isDrawablePlace({ title: "가덕도" })).toBe(true);
    expect(isDrawablePlace({ cat3: "A02010700", title: "경복궁" })).toBe(true);
  });

  it("차단 키워드가 없는 이름은 오폭하지 않는다", () => {
    expect(isDrawablePlace({ title: "서울월드컵경기장" })).toBe(true);
    expect(isDrawablePlace({ title: "국립아쿠아리움센터" })).toBe(true);
    expect(isDrawablePlace({ title: "한국민속촌" })).toBe(true);
  });

  it("title 이 없으면 거부하지 않는다(malformed 는 별도 계층 소관)", () => {
    expect(isDrawablePlace({ title: undefined as unknown as string })).toBe(
      true,
    );
    expect(isDrawablePlace({ cat3: "A01011200", title: "" })).toBe(true);
  });
});

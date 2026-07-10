import { describe, it, expect } from "vitest";
import { httpsImage, buildShareFeed, shareText } from "@/lib/kakaoShare";
import type { Place } from "@/types/tour";

function place(over: Partial<Place> = {}): Place {
  return {
    contentId: "123",
    contentTypeId: 12,
    title: "홍련암",
    address: "강원특별자치도 양양군 강현면",
    image: "http://tong.visitkorea.or.kr/cms/full.jpg",
    lat: 38.06,
    lng: 128.66,
    areaCode: 32,
    overview: "설악산 자락의 암자.",
    ...over,
  };
}

const CTX = {
  appUrl: "https://travelanywhere-kr.vercel.app",
  mapUrl: "https://map.kakao.com/link/map/%ED%99%8D%EB%A0%A8%EC%95%94,38.06,128.66",
  fallbackImage: "https://travelanywhere-kr.vercel.app/icon-512.png",
};

describe("httpsImage — 카톡 피드 이미지 https 강제", () => {
  it("http → https 로 업그레이드", () => {
    expect(httpsImage("http://img/a.jpg")).toBe("https://img/a.jpg");
  });
  it("https 는 그대로", () => {
    expect(httpsImage("https://img/a.jpg")).toBe("https://img/a.jpg");
  });
  it("null·빈문자·공백은 undefined", () => {
    expect(httpsImage(null)).toBeUndefined();
    expect(httpsImage("")).toBeUndefined();
    expect(httpsImage("   ")).toBeUndefined();
  });
  it("http 는 앞부분만 교체(경로 내 http 문자열 보존)", () => {
    expect(httpsImage("http://x/redirect?u=http://y")).toBe(
      "https://x/redirect?u=http://y",
    );
  });
});

describe("buildShareFeed — 카카오 feed 기본 템플릿", () => {
  it("objectType feed + 제목/설명(주소)/링크(mapUrl)", () => {
    const f = buildShareFeed(place(), CTX);
    expect(f.objectType).toBe("feed");
    expect(f.content.title).toBe("홍련암");
    expect(f.content.description).toBe("강원특별자치도 양양군 강현면");
    expect(f.content.link.webUrl).toBe(CTX.mapUrl);
    expect(f.content.link.mobileWebUrl).toBe(CTX.mapUrl);
  });

  it("이미지 http → https 로 실린다", () => {
    const f = buildShareFeed(place(), CTX);
    expect(f.content.imageUrl).toBe("https://tong.visitkorea.or.kr/cms/full.jpg");
  });

  it("이미지 없으면 fallbackImage", () => {
    const f = buildShareFeed(place({ image: null }), CTX);
    expect(f.content.imageUrl).toBe(CTX.fallbackImage);
  });

  it("주소 없으면 overview, 둘 다 없으면 기본 문구", () => {
    expect(buildShareFeed(place({ address: "" }), CTX).content.description).toBe(
      "설악산 자락의 암자.",
    );
    const none = buildShareFeed(
      place({ address: "", overview: null }),
      CTX,
    ).content.description;
    expect(none).toContain("여행지");
    expect(none.length).toBeGreaterThan(0);
  });

  it("긴 overview 는 축약(…)", () => {
    const long = "가".repeat(200);
    const d = buildShareFeed(place({ address: "", overview: long }), CTX).content
      .description;
    expect(d.length).toBeLessThanOrEqual(80);
    expect(d.endsWith("…")).toBe(true);
  });

  it("버튼: mapUrl 있으면 2개(지도에서 보기 + 나도 뽑기)", () => {
    const f = buildShareFeed(place(), CTX);
    expect(f.buttons).toHaveLength(2);
    expect(f.buttons[0].title).toContain("지도");
    expect(f.buttons[0].link.webUrl).toBe(CTX.mapUrl);
    expect(f.buttons[1].title).toContain("뽑기");
    expect(f.buttons[1].link.webUrl).toBe(CTX.appUrl);
  });

  it("버튼: mapUrl 없으면 1개(나도 뽑기)만 + 링크는 앱 홈", () => {
    const f = buildShareFeed(place(), { ...CTX, mapUrl: null });
    expect(f.buttons).toHaveLength(1);
    expect(f.buttons[0].title).toContain("뽑기");
    expect(f.content.link.webUrl).toBe(CTX.appUrl);
  });

  it("제목이 비면 기본값", () => {
    expect(buildShareFeed(place({ title: "  " }), CTX).content.title).toContain(
      "여행지",
    );
  });
});

describe("shareText — 폴백(Web Share/클립보드) 평문", () => {
  it("제목·주소·앱URL 포함", () => {
    const t = shareText(place(), CTX.appUrl);
    expect(t).toContain("홍련암");
    expect(t).toContain("강원특별자치도 양양군 강현면");
    expect(t).toContain(CTX.appUrl);
  });
  it("주소 없으면 주소 줄 생략(빈 줄 없음)", () => {
    const t = shareText(place({ address: "" }), CTX.appUrl);
    expect(t).toContain("홍련암");
    expect(t).not.toMatch(/\n\n/); // 빈 줄 안 생김
  });
});

// 🍃 분산 서사(M18, plan.md §7.9 원칙 2) — 외부 노출면(공유)에 한적 근거 1줄.
//   "이해 가능한 단어 선행" + 기준일 필수 어순: "🍃 한적 예측 · 집중률 하위 N% (M/D 기준)".
const CONGESTION = {
  sigunguName: "양양군",
  pctBelow: 12,
  baseYmd: "20260710",
  targetYmd: "20260710",
};

describe("buildShareFeed — 🍃 한적 근거 줄(congestion)", () => {
  it("congestion 있으면 설명에 주소 선행 + 한적 예측 줄 후행", () => {
    const d = buildShareFeed(place(), { ...CTX, congestion: CONGESTION }).content
      .description;
    // 주소(실용 정보)가 앞줄
    expect(d.startsWith("강원특별자치도 양양군 강현면")).toBe(true);
    // '이해 가능한 단어'(한적 예측)가 '집중률 하위'보다 앞
    expect(d).toContain("🍃 한적 예측 · 집중률 하위 12% (7/10 기준)");
    expect(d.indexOf("한적 예측")).toBeLessThan(d.indexOf("집중률 하위"));
  });

  it("congestion 없으면 설명 무변(주소만)", () => {
    expect(
      buildShareFeed(place(), { ...CTX, congestion: null }).content.description,
    ).toBe("강원특별자치도 양양군 강현면");
    // congestion 필드 자체가 없어도(하위호환) 무변
    expect(buildShareFeed(place(), CTX).content.description).toBe(
      "강원특별자치도 양양군 강현면",
    );
  });
});

describe("shareText — 🍃 한적 근거 줄(congestion)", () => {
  it("congestion 있으면 주소 다음·앱URL 앞에 한적 예측 줄", () => {
    const t = shareText(place(), CTX.appUrl, CONGESTION);
    expect(t).toContain("🍃 한적 예측 · 집중률 하위 12% (7/10 기준)");
    // 순서: 주소 < 한적 줄 < 앱URL
    expect(t.indexOf("강현면")).toBeLessThan(t.indexOf("한적 예측"));
    expect(t.indexOf("한적 예측")).toBeLessThan(t.indexOf(CTX.appUrl));
  });

  it("congestion 없으면 평문 무변(빈 줄 없음)", () => {
    const t = shareText(place(), CTX.appUrl, null);
    expect(t).not.toContain("한적 예측");
    expect(t).not.toMatch(/\n\n/);
  });
});

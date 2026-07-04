import { describe, it, expect } from "vitest";
import manifest from "@/app/manifest";

// PWA 설치에 필수인 매니페스트 필드가 빠지지 않도록 회귀 방지(값 자체보다 계약 검증).
describe("웹 매니페스트 — 설치 필수 필드", () => {
  const m = manifest();

  it("이름·시작 URL·standalone 디스플레이", () => {
    expect(m.name).toBeTruthy();
    expect(m.short_name).toBeTruthy();
    expect(m.start_url).toBe("/");
    expect(m.display).toBe("standalone");
  });

  it("테마·배경색이 있다(스플래시/상태바)", () => {
    expect(m.theme_color).toMatch(/^#/);
    expect(m.background_color).toMatch(/^#/);
  });

  it("192·512 아이콘 + maskable 하나 이상", () => {
    const icons = m.icons ?? [];
    expect(icons.some((i) => i.sizes === "192x192")).toBe(true);
    expect(icons.some((i) => i.sizes === "512x512")).toBe(true);
    expect(icons.some((i) => String(i.purpose).includes("maskable"))).toBe(true);
    // 모든 아이콘 src 는 실제 서빙되는 public 경로여야
    for (const i of icons) expect(i.src).toMatch(/^\/icon-.*\.png$/);
  });
});

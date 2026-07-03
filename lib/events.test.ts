import { describe, it, expect } from "vitest";
import {
  makeEvent,
  appendEvent,
  type TravelEvent,
} from "@/lib/events";

// §12.5 이벤트 스키마 — P0 은 localStorage 에만 기록(서버 전송 없음, §12.6).
// 순수 부분: 스키마 빌드(누락 필드 null 정규화) + 링버퍼 append(상한).

describe("makeEvent — §12.5 스키마 빌드", () => {
  it("모든 필드를 채운 draw 이벤트", () => {
    const ev = makeEvent({
      event: "draw",
      mode: "filtered",
      areaCode: 39,
      contentTypeId: 12,
      contentId: "555",
      sessionId: "sess-uuid",
      ts: 1717000000000,
    });
    expect(ev).toEqual({
      event: "draw",
      mode: "filtered",
      areaCode: 39,
      contentTypeId: 12,
      contentId: "555",
      sessionId: "sess-uuid",
      ts: 1717000000000,
    });
  });

  it("선택 필드 누락 시 null 로 정규화한다", () => {
    const ev = makeEvent({
      event: "like",
      sessionId: "s",
      ts: 1,
    });
    expect(ev.mode).toBeNull();
    expect(ev.areaCode).toBeNull();
    expect(ev.contentTypeId).toBeNull();
    expect(ev.contentId).toBeNull();
    expect(ev.event).toBe("like");
    expect(ev.sessionId).toBe("s");
    expect(ev.ts).toBe(1);
  });
});

describe("appendEvent — 링버퍼(상한 시 오래된 것 제거)", () => {
  const base: TravelEvent = {
    event: "draw",
    mode: "pure",
    areaCode: null,
    contentTypeId: 12,
    contentId: "1",
    sessionId: "s",
    ts: 1,
  };

  it("맨 뒤에 추가(시간순 유지)", () => {
    const out = appendEvent([{ ...base, ts: 1 }], { ...base, ts: 2 }, 10);
    expect(out.map((e) => e.ts)).toEqual([1, 2]);
  });

  it("상한을 넘으면 가장 오래된 앞쪽을 버린다", () => {
    const list = [1, 2, 3].map((ts) => ({ ...base, ts }));
    const out = appendEvent(list, { ...base, ts: 4 }, 3);
    expect(out.map((e) => e.ts)).toEqual([2, 3, 4]);
    expect(out).toHaveLength(3);
  });

  it("원본을 변형하지 않는다", () => {
    const list = [{ ...base, ts: 1 }];
    appendEvent(list, { ...base, ts: 2 }, 10);
    expect(list).toHaveLength(1);
  });

  it("cap=0 이면 빈 배열(방금 추가한 것도 유실 안 되게 0 방어)", () => {
    expect(appendEvent([{ ...base, ts: 1 }], { ...base, ts: 2 }, 0)).toEqual([]);
  });

  it("음수 cap 은 0 으로 방어 — 빈 배열", () => {
    expect(appendEvent([{ ...base, ts: 1 }], { ...base, ts: 2 }, -5)).toEqual([]);
  });
});

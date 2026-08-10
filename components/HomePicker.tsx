"use client";

// 🏠 거주지 고르기 (M28, plan.md §7.17E) — 시·도 optgroup 하나짜리 네이티브 select.
//
// ⚠️ 이 파일은 **동적 import 전용**이다(조건 패널이 next/dynamic 으로 싣는다).
//   TOUR_SIGUNGU_CELLS(~20KB)를 홈 초기 번들에 넣지 않기 위한 분리 — 거주지를 이미 고른
//   사용자는 이 목록이 영영 필요 없다(코드만 저장돼 있고 표시명은 서버가 준다).
//
// 옵션 단위 = TourAPI 셀(N:1). 값은 members[0](통계청 code) — 고양시처럼 3개 구가 한 셀인
//   곳은 "고양시" 하나로 뜬다. 거리 판정이 시·군·구 중심 기준이라 구 단위 구분은 무의미하다.

import { useState } from "react";
import { TOUR_SIGUNGU_CELLS } from "@/lib/tourSigungu";
import { AREA_CODES } from "@/lib/constants";

// 시·도 순서는 AREA_CODES(패널의 지역 칩과 같은 순서) — 사용자가 이미 아는 배열을 재사용.
const BY_AREA = AREA_CODES.map((a) => ({
  area: a,
  cells: TOUR_SIGUNGU_CELLS.filter((c) => c.area === a.code).sort((x, y) =>
    x.name.localeCompare(y.name, "ko"),
  ),
})).filter((g) => g.cells.length > 0);

export default function HomePicker({
  current,
  saving,
  onSelect,
}: {
  /** 현재 저장된 통계청 code(변경 모드일 때 선택 상태로 보이게) */
  current: string | null;
  saving: boolean;
  onSelect: (code: string) => void;
}) {
  const [value, setValue] = useState(current ?? "");

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* 이미 surface-3 인셋(조건 패널) 안이라 필드는 흰 면으로 띄운다 — 꺼진 칩과 같은 논리.
          높이를 저장 버튼과 같은 38px 로 고정해 wrap 돼도 두 컨트롤이 어긋나지 않는다. */}
      <select
        aria-label="사는 시·군·구"
        value={value}
        disabled={saving}
        onChange={(e) => setValue(e.target.value)}
        className="h-[38px] min-w-[180px] rounded-[14px] border border-g-border bg-g-surface px-3.5 text-[13px] leading-[1.3] text-g-text disabled:opacity-60"
      >
        <option value="">사는 곳을 고르세요</option>
        {BY_AREA.map((g) => (
          <optgroup key={g.area.code} label={g.area.name}>
            {g.cells.map((c) => (
              <option key={`${c.area}-${c.sigunguCode}`} value={c.members[0]}>
                {c.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      {/* ⚠️ 면이 --g-primary 였는데 그 위 --g-on-primary 는 4.59:1 로 모자란다
          (designGuide 「대비 함정 1」 — 밝은 잉크는 --g-primary-deep 위에만, 7.13:1). */}
      <button
        type="button"
        disabled={!value || saving}
        onClick={() => onSelect(value)}
        className="inline-flex h-[38px] items-center rounded-[14px] bg-g-primary-deep px-4 text-[13px] font-bold leading-[1.2] text-g-on-primary [corner-shape:squircle] hover:bg-g-primary-hover disabled:cursor-default disabled:opacity-50"
      >
        {saving ? "저장 중…" : "저장"}
      </button>
    </div>
  );
}

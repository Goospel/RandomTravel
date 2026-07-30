"use client";

// 🏠 거주지 상태 훅 (M28, plan.md §7.17A) — 로그인 사용자의 거주 시·군·구 1개.
//   서버(/api/home)가 단일 출처다. localStorage 캐시를 두지 않는다 — 값 하나뿐이라
//   오프라인 이득이 미미한데 stale 표시(옛 동네 기준으로 뽑는 것처럼 보임)의 대가가 크다.
//   비로그인은 home=null → 조건 패널이 섹션 자체를 감춘다(회원 전용 기능).

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";

export interface HomeSigungu {
  /** 통계청 시·군·구 5자리. null = 아직 안 고름 */
  code: string | null;
  /** "서울 종로구" 표시용(서버가 준다 — 클라는 지도 데이터를 안 싣는다) */
  name: string | null;
}

export interface UseHomeSigungu {
  /** null = 비로그인 또는 아직 조회 전 */
  home: HomeSigungu | null;
  saving: boolean;
  /** 거주지 저장(성공 시 home 갱신). 실패는 조용히 무시 — 재시도는 사용자가 다시 고르면 된다. */
  save: (code: string) => Promise<void>;
}

export function useHomeSigungu(): UseHomeSigungu {
  const { data: session, status } = useSession();
  const userId = status === "authenticated" ? (session?.user?.id ?? null) : null;
  // 소유자 id 와 함께 담는다 — 로그아웃·계정 전환 시 옛 사용자의 거주지가 화면에 남지 않게
  //   **파생**으로 걸러낸다(effect 안에서 동기 setState 로 회수하면 연쇄 렌더가 된다).
  const [row, setRow] = useState<{ id: string; home: HomeSigungu } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    void (async () => {
      try {
        const res = await fetch("/api/home");
        if (!res.ok) return;
        const d = (await res.json()) as HomeSigungu;
        if (alive) {
          setRow({ id: userId, home: { code: d.code ?? null, name: d.name ?? null } });
        }
      } catch {
        // 부가 기능이라 실패해도 앱 흐름을 끊지 않는다(섹션이 안 뜰 뿐).
      }
    })();
    return () => {
      alive = false;
    };
  }, [userId]);

  const save = useCallback(
    async (code: string) => {
      if (!userId) return;
      setSaving(true);
      try {
        const res = await fetch("/api/home", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        });
        if (!res.ok) return;
        const d = (await res.json()) as HomeSigungu;
        setRow({ id: userId, home: { code: d.code ?? null, name: d.name ?? null } });
      } catch {
        // 저장 실패 — 화면은 이전 값을 유지한다(거짓 성공 표시 금지).
      } finally {
        setSaving(false);
      }
    },
    [userId],
  );

  // 로그인 전·조회 전은 null = 섹션 미노출(회원 전용이라 깜빡임보다 오노출이 나쁘다).
  const home = userId && row?.id === userId ? row.home : null;
  return { home, saving, save };
}

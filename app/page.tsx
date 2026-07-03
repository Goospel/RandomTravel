"use client";

import { useState } from "react";
import type { RandomResponse, ErrorResponse } from "@/types/tour";
import { ModeToggle, type Mode } from "@/components/ModeToggle";
import { FilterPanel } from "@/components/FilterPanel";
import { ResultCard } from "@/components/ResultCard";
import { buildRandomQuery } from "@/lib/query";

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok"; data: RandomResponse }
  | { kind: "error"; error: ErrorResponse };

export default function Home() {
  const [mode, setMode] = useState<Mode>("pure");
  const [areas, setAreas] = useState<Set<number>>(new Set());
  const [types, setTypes] = useState<Set<number>>(new Set());
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const toggleArea = (code: number) =>
    setAreas((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  const toggleType = (code: number) =>
    setTypes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  const clearFilters = () => {
    setAreas(new Set());
    setTypes(new Set());
  };

  async function draw() {
    setStatus({ kind: "loading" });

    // 조건 0개면 빈 문자열 → 파라미터 없이 = 완전 랜덤(§2 불변식). lib/query.ts 단위 테스트로 고정.
    const qs = buildRandomQuery(mode, areas, types);
    const url = qs ? `/api/random?${qs}` : "/api/random";

    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        const error = (await res.json().catch(() => ({
          error: "알 수 없는 오류가 발생했어요.",
        }))) as ErrorResponse;
        setStatus({ kind: "error", error });
        return;
      }
      const data = (await res.json()) as RandomResponse;
      setStatus({ kind: "ok", data });
    } catch {
      setStatus({
        kind: "error",
        error: { error: "네트워크 오류 — 연결을 확인하고 다시 시도해 주세요." },
      });
    }
  }

  const loading = status.kind === "loading";

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center gap-6 px-5 py-10">
      <header className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">🎲 RandomTravel</h1>
        <p className="mt-2 text-sm text-zinc-500">
          어디 갈지 고민될 때, 운명에 맡겨.
        </p>
      </header>

      <ModeToggle mode={mode} onChange={setMode} />

      {mode === "filtered" && (
        <FilterPanel
          selectedAreas={areas}
          selectedTypes={types}
          onToggleArea={toggleArea}
          onToggleType={toggleType}
          onClear={clearFilters}
        />
      )}

      <button
        type="button"
        onClick={draw}
        disabled={loading}
        className="w-full rounded-2xl bg-indigo-600 px-6 py-5 text-lg font-semibold text-white shadow-lg shadow-indigo-600/20 transition-colors hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-60"
      >
        {loading ? "여행지를 뽑는 중…" : "🎲 뽑기"}
      </button>

      {status.kind === "ok" && <ResultCard data={status.data} onRedraw={draw} />}
      {status.kind === "error" && <ErrorPanel error={status.error} />}
      {status.kind === "idle" && (
        <p className="text-center text-sm text-zinc-400">
          {mode === "pure"
            ? "버튼을 눌러 전국 어디든 랜덤으로 한 곳을 받아보세요."
            : "조건을 고르고 뽑거나, 아무것도 안 고르면 완전 랜덤이에요."}
        </p>
      )}
    </main>
  );
}

function ErrorPanel({ error }: { error: ErrorResponse }) {
  const isKeyIssue = error.code === "UPSTREAM_ERROR";
  return (
    <div className="w-full rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
      <p className="font-medium">{error.error}</p>
      {isKeyIssue && (
        <p className="mt-2 text-amber-700 dark:text-amber-300">
          서버의 <code className="font-mono">TOUR_API_KEY</code> 설정을 확인해
          주세요. (<code className="font-mono">.env.local.example</code> 참고)
        </p>
      )}
    </div>
  );
}

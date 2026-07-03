"use client";

import { useState } from "react";
import type { RandomResponse, ErrorResponse } from "@/types/tour";
import { AREA_NAME, CONTENT_TYPE_NAME } from "@/lib/constants";

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok"; data: RandomResponse }
  | { kind: "error"; error: ErrorResponse };

export default function Home() {
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function draw() {
    setStatus({ kind: "loading" });
    try {
      const res = await fetch("/api/random", { cache: "no-store" });
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
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center gap-8 px-5 py-12">
      <header className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">🎲 RandomTravel</h1>
        <p className="mt-2 text-sm text-zinc-500">
          어디 갈지 고민될 때, 운명에 맡겨.
        </p>
      </header>

      <button
        onClick={draw}
        disabled={loading}
        className="w-full rounded-2xl bg-indigo-600 px-6 py-5 text-lg font-semibold text-white shadow-lg shadow-indigo-600/20 transition-colors hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-60"
      >
        {loading ? "여행지를 뽑는 중…" : "🎲 뽑기"}
      </button>

      {status.kind === "ok" && <ResultCard data={status.data} onRedraw={draw} />}
      {status.kind === "error" && <ErrorPanel error={status.error} />}
      {status.kind === "idle" && (
        <p className="mt-4 text-center text-sm text-zinc-400">
          버튼을 눌러 전국 어디든 랜덤으로 한 곳을 받아보세요.
        </p>
      )}
    </main>
  );
}

function ResultCard({
  data,
  onRedraw,
}: {
  data: RandomResponse;
  onRedraw: () => void;
}) {
  const { place } = data;
  const areaName =
    place.areaCode != null ? AREA_NAME[place.areaCode] : undefined;
  const typeName = CONTENT_TYPE_NAME[place.contentTypeId];
  const mapHref =
    place.lat != null && place.lng != null
      ? `https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}`
      : null;

  return (
    <article className="w-full overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="aspect-video w-full bg-zinc-100 dark:bg-zinc-800">
        {place.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={place.image}
            alt={place.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-4xl">
            🏞️
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 p-5">
        <div className="flex flex-wrap items-center gap-2">
          {areaName && (
            <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
              {areaName}
            </span>
          )}
          {typeName && (
            <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              {typeName}
            </span>
          )}
        </div>

        <h2 className="text-xl font-bold leading-snug">{place.title}</h2>
        {place.address && (
          <p className="text-sm text-zinc-500">{place.address}</p>
        )}
        {place.overview && (
          <p className="line-clamp-4 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            {place.overview}
          </p>
        )}

        <div className="mt-2 flex gap-2">
          <button
            onClick={onRedraw}
            className="flex-1 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-500"
          >
            🎲 다시 뽑기
          </button>
          {mapHref && (
            <a
              href={mapHref}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center rounded-xl border border-zinc-300 px-4 py-3 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              지도에서 보기
            </a>
          )}
        </div>
      </div>
    </article>
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

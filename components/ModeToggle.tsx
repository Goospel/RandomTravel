"use client";

export type Mode = "pure" | "filtered";

const OPTIONS: { key: Mode; label: string }[] = [
  { key: "pure", label: "🎰 순수 랜덤" },
  { key: "filtered", label: "🎯 조건 랜덤" },
];

export function ModeToggle({
  mode,
  onChange,
}: {
  mode: Mode;
  onChange: (m: Mode) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="랜덤 모드 선택"
      className="flex w-full rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800"
    >
      {OPTIONS.map((o) => (
        <button
          key={o.key}
          type="button"
          role="radio"
          aria-checked={mode === o.key}
          onClick={() => onChange(o.key)}
          className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
            mode === o.key
              ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-950 dark:text-white"
              : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

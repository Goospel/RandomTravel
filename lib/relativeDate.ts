// 📅 상대 날짜(M16) — 다녀온 곳 리스트의 "언제 다녀왔나" 표기. 순수 함수.
//   now 를 주입받아 결정적으로 테스트한다(Date.now() 는 호출부에서).

const DAY = 86400000; // 1일(ms)

/**
 * savedAt(ms) 과 now(ms) 로 사람이 읽는 경과 표기.
 *  - 오늘/미래(음수 경과): "오늘"
 *  - 1일: "어제"
 *  - 2~29일: "N일 전"
 *  - 30일+: "N달 전"(30일=1달 근사)
 * savedAt 이 비유한수면 빈 문자열.
 */
export function relativeDay(savedAt: number, now: number): string {
  if (!Number.isFinite(savedAt)) return "";
  const d = Math.floor((now - savedAt) / DAY);
  if (d <= 0) return "오늘";
  if (d === 1) return "어제";
  if (d < 30) return `${d}일 전`;
  return `${Math.floor(d / 30)}달 전`;
}

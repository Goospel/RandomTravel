// 📈 임팩트 대시보드(M26, plan.md §7.15) — "랜덤 추천이 실제 분산을 만드는가"의 정량 방어 화면.
//
// 서버 컴포넌트 + DB 조회만(TourAPI 0콜). 차트는 순수 div 가로 막대 — 차트 라이브러리 0(M12 선례).
//
// ⚠️ 정직성 규칙(§7.15) — 이 파일에서 지워지면 화면이 거짓말을 시작한다:
//   ② 는 "설계 확률 — 실측 아님" + "시·도 선택 기준" 라벨 필수(후보 0 지역 스킵이라 근사).
//   ③ 은 표본 수 상시 노출 + n<100 이면 "표본 누적 중" + 퍼널은 "연관이지 인과 아님".
//   카피에 공사·KTO 지칭 금지(§14.2) — 출처는 "공공 관광 데이터" 수준(상세는 푸터 공통 표기).

import type { Metadata } from "next";
import Link from "next/link";
import { getImpactData, SMALL_SAMPLE } from "@/db/impact";
import { AREA_NAME } from "@/lib/constants";
import { Icon } from "@/components/icons";

// 방문자·이벤트 집계는 DB 조회라 빌드 시점에 프리렌더하지 않는다(캐시는 db/impact 의 1h).
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "임팩트 대시보드 — 어디든",
  description:
    "전국 방문이 얼마나 기울어 있는지, 어디든의 뽑기가 확률을 어떻게 나누는지, 그리고 실제로 어떻게 뽑혔는지.",
};

const CARD = "rounded-2xl border border-g-border bg-g-surface";
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

/**
 * 가로 막대 1행. refShare 를 주면 그 위치에 세로 기준선(설계 균등 확률)을 겹친다.
 * bar 로 막대 색을 바꾼다 — ①은 편중 자체를 색으로 보여준다(상위=주홍 / 하위=연한 틸).
 */
function ShareRow({
  label,
  share,
  refShare,
  bar = "bg-g-primary",
}: {
  label: string;
  share: number;
  refShare?: number;
  bar?: string;
}) {
  return (
    <li className="flex items-center gap-2.5">
      <span className="w-[54px] flex-none text-[12px] font-medium leading-[1.5] text-g-text-2">
        {label}
      </span>
      <span className="relative h-[14px] flex-1 overflow-hidden rounded bg-g-ring-track">
        <span
          className={`absolute inset-y-0 left-0 rounded ${bar}`}
          style={{ width: `${Math.min(100, share * 100)}%` }}
        />
        {refShare !== undefined && (
          <span
            className="absolute inset-y-0 w-0.5 bg-g-text opacity-50"
            style={{ left: `${Math.min(100, refShare * 100)}%` }}
          />
        )}
      </span>
      <span className="w-[46px] flex-none text-right font-display text-[12px] font-bold tabular-nums">
        {pct(share)}
      </span>
    </li>
  );
}

function Panel({
  step,
  title,
  lead,
  aside,
  children,
}: {
  /** 원형 숫자 배지에 들어갈 순번(1·2·3) */
  step: number;
  title: string;
  lead: string;
  /** 헤더 우측에 붙는 태그류(③ 표본 수) */
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className={`${CARD} p-5`}>
      <div className="flex items-center gap-2.5">
        <span className="inline-flex h-7 w-7 flex-none items-center justify-center rounded-full bg-g-text font-display text-[13px] font-bold text-g-on-primary">
          {step}
        </span>
        <h2 className="font-display text-[17px] font-bold leading-[1.35] tracking-[-0.02em]">
          {title}
        </h2>
        {aside && <div className="ml-auto flex flex-wrap justify-end gap-1.5">{aside}</div>}
      </div>
      <p className="mt-2.5 text-[13px] leading-[1.6] text-g-text-2">{lead}</p>
      {children}
    </section>
  );
}

function Tag({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "warn" }) {
  const cls =
    tone === "warn"
      ? "bg-g-warning-soft text-g-warning-text"
      : "bg-g-ring-track text-g-text-2";
  return (
    <span
      className={`inline-flex h-6 items-center whitespace-nowrap rounded-md px-[9px] text-[11px] font-bold leading-none ${cls}`}
    >
      {children}
    </span>
  );
}

export default async function ImpactPage() {
  const { visitor, design, actual, notices } = await getImpactData();
  const uniform = design[0]?.uniform ?? 0;
  // ① 캡션의 극단 배율 — 점유율은 내림차순이라 양 끝이 곧 최대·최소다.
  // ⚠️ 캡션에서 지역명 뒤에 은/는·이/가 조사를 붙이지 않는다 — 이름이 데이터에서 오는데
  //   받침 유무가 갈려 "서울는" 같은 문장이 나온다(실측 2026-07-28).
  const extremeRatio =
    visitor && visitor.length > 1
      ? visitor[0].share / visitor[visitor.length - 1].share
      : null;
  const funnel = actual?.funnel;

  return (
    <main className="mx-auto flex w-full max-w-[720px] flex-1 flex-col gap-3 px-4 py-7 sm:px-5">
      <header className="flex flex-col gap-2">
        <Link
          href="/"
          className="inline-flex w-fit items-center gap-1.5 text-[13px] font-medium text-g-primary hover:text-g-primary-hover"
        >
          <Icon name="arrowLeft" size={14} />
          뽑기로 돌아가기
        </Link>
        <h1 className="flex items-center gap-2 font-display text-[24px] font-bold leading-[1.2] tracking-[-0.03em] sm:text-[32px] sm:leading-[1.15]">
          <Icon name="target" size={26} className="text-g-primary" />
          쏠림을 숫자로
        </h1>
      </header>

      {notices.length > 0 && (
        <div className="flex items-start gap-2 rounded-2xl bg-g-warning-soft px-4 py-3 text-[13px] leading-[1.6] text-g-warning-text">
          <Icon name="warning" size={15} className="mt-0.5 flex-none" />
          <div className="flex flex-col gap-1">
            {notices.map((n) => (
              <p key={n}>{n}</p>
            ))}
          </div>
        </div>
      )}

      {/* ① 문제 — 현실의 방문 편중 */}
      <Panel
        step={1}
        title="현실 — 방문은 이만큼 기울어 있어요"
        lead="공공 관광 데이터 · 외지인 방문자 점유율"
      >
        {visitor ? (
          <>
            <ul className="mt-4 flex flex-col gap-[7px]">
              {visitor.map((s, i) => (
                <ShareRow
                  key={s.areaCode}
                  label={AREA_NAME[s.areaCode]}
                  share={s.share}
                  // 편중을 색으로 — 상위 2개는 주홍, 하위 3개는 거의 안 보이는 연한 틸.
                  bar={
                    i < 2
                      ? "bg-g-accent-bright"
                      : i >= visitor.length - 3
                        ? "bg-g-primary-soft-border"
                        : "bg-g-primary"
                  }
                />
              ))}
            </ul>
            {/* ⚠️ 지역명 뒤에 조사를 붙이지 않는다 — 이름이 데이터에서 오는데 받침 유무가 갈려
                "제주과" 같은 문장이 나온다(실측 2026-07-28). 그래서 '서울과 세종의 차이'가
                아니라 구분자만 쓴다. */}
            {extremeRatio !== null && (
              <p className="mt-3.5 rounded-[10px] bg-g-accent-soft px-3.5 py-[11px] text-[13px] leading-[1.6] text-g-accent-text">
                최다 {AREA_NAME[visitor[0].areaCode]} · 최소{" "}
                {AREA_NAME[visitor[visitor.length - 1].areaCode]} — 차이{" "}
                <b className="font-display text-[15px] font-bold tabular-nums">
                  {extremeRatio.toFixed(1)}배
                </b>
              </p>
            )}
          </>
        ) : (
          <p className="mt-4 text-[13px] leading-[1.6] text-g-text-2">
            표시할 방문자 데이터가 아직 없어요.
          </p>
        )}
      </Panel>

      {/* ② 설계 — 뽑기 확률(해석적 계산) */}
      <Panel
        step={2}
        title="설계 — 뽑기는 확률을 이렇게 나눠요"
        lead="기본은 17개 시·도 균등 · 분산 모드는 방문자 적은 곳에 가중"
      >
        {/* ⚠️ 이 두 태그는 지우면 안 된다(§7.15) — 없으면 해석적 설계값이 실측처럼 읽힌다. */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Tag tone="warn">설계 확률 — 실측 아님</Tag>
          <Tag>시·도 선택 기준</Tag>
        </div>
        <ul className="mt-4 flex flex-col gap-[7px]">
          {design.map((d) => (
            <ShareRow
              key={d.areaCode}
              label={AREA_NAME[d.areaCode]}
              share={d.weighted ?? d.uniform}
              refShare={d.weighted !== null ? uniform : undefined}
            />
          ))}
        </ul>
        <p className="mt-3 text-[12px] leading-[1.6] text-g-text-3">
          {design[0]?.weighted !== null && design.length > 0 ? (
            <>
              막대 = 분산 모드 · 세로선 = 균등{" "}
              <b className="font-display font-bold tabular-nums">{pct(uniform)}</b>
            </>
          ) : (
            <>
              막대 = 균등{" "}
              <b className="font-display font-bold tabular-nums">{pct(uniform)}</b>
            </>
          )}
        </p>
      </Panel>

      {/* ③ 실측 — 실사용 분포·반응 퍼널 */}
      <Panel
        step={3}
        title="실측 — 실제로는 이렇게 뽑혔어요"
        lead="실제 제안된 여행지의 시·도 분포 · 익명 집계"
        // ⚠️ 표본 수는 상시 노출(§7.15) — n<100 이면 '표본 누적 중'까지. 지우면 화면이 거짓말한다.
        aside={
          <>
            <Tag>표본 {(actual?.total ?? 0).toLocaleString("ko-KR")}건</Tag>
            {(actual?.total ?? 0) < SMALL_SAMPLE && <Tag tone="warn">표본 누적 중</Tag>}
          </>
        }
      >
        {actual && actual.shares.length > 0 ? (
          <>
            <ul className="mt-4 flex flex-col gap-[7px]">
              {actual.shares.map((s) => (
                <ShareRow
                  key={s.areaCode}
                  label={AREA_NAME[s.areaCode]}
                  share={s.share}
                  refShare={uniform}
                />
              ))}
            </ul>
            <p className="mt-3 text-[12px] leading-[1.6] text-g-text-3">
              막대 = 실제 제안 · 세로선 = 균등{" "}
              <b className="font-display font-bold tabular-nums">{pct(uniform)}</b>
            </p>
          </>
        ) : (
          <p className="mt-4 text-[13px] leading-[1.6] text-g-text-2">
            아직 집계할 기록이 충분하지 않아요. 뽑기가 쌓이면 여기에 실제 분포가 나타나요.
          </p>
        )}

        {funnel && (
          <div className="mt-4 border-t border-dashed border-g-border pt-4">
            <h3 className="font-display text-[15px] font-bold leading-[1.35] tracking-[-0.02em]">
              제안 다음에 무슨 일이 생겼나
            </h3>
            <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { label: "제안", value: funnel.proposed },
                { label: "찜", value: funnel.liked },
                { label: "길찾기", value: funnel.navigated },
                { label: "다녀옴", value: funnel.visited },
              ].map((s) => (
                <div
                  key={s.label}
                  className="rounded-xl border border-g-border bg-g-surface-3 p-3"
                >
                  <dt className="text-[11px] font-bold leading-[1.3] text-g-text-3">
                    {s.label}
                  </dt>
                  <dd className="mt-1.5 font-display text-[22px] font-bold leading-[1.1] tracking-[-0.03em] tabular-nums">
                    {s.value.toLocaleString("ko-KR")}
                  </dd>
                </div>
              ))}
            </dl>
            {/* ⚠️ 이 한 줄은 지우면 안 된다(§7.15) — 퍼널을 인과로 읽는 오해를 막는 유일한 문장이다. */}
            <p className="mt-3 text-[12px] leading-[1.6] text-g-text-3">
              <b className="font-bold">연관이지 인과가 아니에요</b>
            </p>
          </div>
        )}
      </Panel>

      <p className="px-1 text-[12px] leading-[1.6] text-g-text-2">
        ①은 공공 관광 데이터, ③은 이 서비스의 익명 사용 기록을 집계한 값이에요. 무엇을 어떻게
        모으는지는{" "}
        <Link href="/privacy" className="underline underline-offset-2 hover:text-g-primary">
          수집 안내
        </Link>
        에 적어 두었어요.
      </p>
    </main>
  );
}

# 학습 노트 — 작업 중 모르고 물어봐서 배운 것들

> 면접에서 본인이 직접 설명할 수 있는 수준으로 본인 이해 확립.
> 같은 질문 두 번 안 묻기.

## 📑 목차

1. [지도 폴리곤 단순화가 해안선을 깎아 point-in-polygon이 새는 문제 — 최근접 경계 스냅](#1-지도-폴리곤-단순화가-해안선을-깎아-point-in-polygon이-새는-문제--최근접-경계-스냅)
2. [카카오 JS SDK v2 모듈은 init 후에야 붙는다](#2-카카오-js-sdk-v2-모듈은-init-후에야-붙는다)
3. [정적 큐레이션 테이블은 '등재 자격'을 테스트 가드로 박아 검수 회귀를 막는다](#3-정적-큐레이션-테이블은-등재-자격을-테스트-가드로-박아-검수-회귀를-막는다)
4. [필터가 좁히는 축(지역)과 사용자가 기대하는 약속(품목)의 granularity 갭 — 좁은 축 + 보강 축](#4-필터가-좁히는-축지역과-사용자가-기대하는-약속품목의-granularity-갭--좁은-축--보강-축)
5. [effect 내 동기 setState 대신 useSyncExternalStore — 마운트 시 브라우저 환경값 읽기의 정석](#5-effect-내-동기-setstate-대신-usesyncexternalstore--마운트-시-브라우저-환경값-읽기의-정석)
6. [같은 set-state-in-effect라도 처방이 다르다 — prop 변화에 내부 상태 리셋은 '이전 렌더 값 저장' 렌더-시점 패턴](#6-같은-set-state-in-effect라도-처방이-다르다--prop-변화에-내부-상태-리셋은-이전-렌더-값-저장-렌더-시점-패턴)
7. [Auth.js v5의 redirect_uri는 요청 host로 조립된다 — Vercel Preview마다 redirect_uri_mismatch, AUTH_REDIRECT_PROXY_URL로 봉쇄](#7-authjs-v5의-redirect_uri는-요청-host로-조립된다--vercel-preview마다-redirect_uri_mismatch-auth_redirect_proxy_url로-봉쇄)
8. [구글 OAuth "액세스 차단됨"은 한 화면 여러 원인 — 상태코드·발생단계로 가른다](#8-구글-oauth-액세스-차단됨은-한-화면-여러-원인--상태코드발생단계로-가른다)

---

## 1. 지도 폴리곤 단순화가 해안선을 깎아 point-in-polygon이 새는 문제 — 최근접 경계 스냅

**한 줄 요약**: 행정경계 폴리곤을 Douglas-Peucker로 단순화하면 들쭉날쭉한 해안선이 **안쪽으로 깎여**, 실제 해안·반도·소도서에 있는 좌표가 단순화된 폴리곤 **밖**으로 떨어진다. 그러면 "이 점이 어느 구역인가"를 판정하는 point-in-polygon이 `null`을 낸다. 정확 판정이 실패하면 **가장 가까운 경계까지 거리가 임계 이내면 그 폴리곤으로 스냅**해 구제하고, 임계값은 감이 아니라 **실측(실제 미스 거리 vs 먼바다 거리)** 으로 잡는다.

### 왜 생기나 (배경)

M12 정복 지도는 방문 좌표(lat/lng)를 지도 평면으로 투영한 뒤, 250개 시·군·구 폴리곤 중 어디에 들어가는지 **even-odd ray casting(point-in-polygon)** 으로 판정한다. 그런데 지도 데이터를 만들 때 파일 크기를 줄이려고 경계를 **Douglas-Peucker**(허용오차 EPS 이내면 중간 점 제거)로 단순화한다. 이 단순화는 본질적으로 **꼭짓점을 지우면서 경계를 직선으로 펴는** 작업이라, 오목하게 들어온 만(灣)이나 가늘게 튀어나온 반도의 끝이 **잘려 안쪽으로 후퇴**한다.

실제 사고: 사용자가 방문한 **인천 월미도 관광지**(`37.4738, 126.5984`)가 핀 지도엔 정상인데 정복 지도엔 0으로 나왔다. 디버깅해 보니 이 점이 인천 중구 폴리곤 **경계 밖 0.04px**에 있었다 — 단순화(EPS ≈ 450m)가 월미도 해안을 깎아낸 것. 관광지 좌표는 정의상 늘 육지·해안에 있는데, 단순화된 폴리곤은 실제 해안선보다 안쪽이라 새는 것이다.

### 왜 단순 nudge로는 부족한가

처음엔 "판정 실패 시 상하좌우·대각 8방향으로 2px씩 밀어서 다시 판정(nudge)"하는 폴백을 뒀다. 인접 구역 경계를 각자 단순화해 생기는 **서브픽셀 갭**(어느 쪽에도 안 속하는 틈)은 이걸로 잡힌다. 하지만 nudge는 "민 지점이 폴리곤 **안**에 들어가야" 성공하는데, **월미도처럼 뾰족한 돌출부**에선 어느 방향으로 밀어도 여전히 폴리곤 밖(바다)이라 실패한다. 즉 nudge는 "폴리곤이 근처에 크게 있다"를 전제한다.

### 해법 — 최근접 경계 스냅 (nearest-edge snap)

정확 판정이 실패하면, **점에서 각 시·군·구 링의 선분(edge)까지 최단거리**를 재서, 그 최솟값이 임계 이내인 폴리곤으로 스냅한다.
- 점→선분 거리는 선분에 내린 수선의 발을 [0,1]로 clamp해서 계산(`segDist`).
- bbox를 임계만큼 확장해 프리필터 → 후보만 거리 계산(성능).
- 이 방식은 nudge를 **포함**한다(임계 ≥ nudge 반경이면 nudge가 잡던 건 다 잡힘) + 돌출부도 잡는다.

### 임계값은 실측으로 (핵심 교훈)

"몇 px까지 스냅?"을 감으로 정하면 위험하다 — 너무 크면 **바다 한가운데 점이 엉뚱한 구역에 붙고**, 너무 작으면 해안을 못 구제한다. 그래서 대표 좌표들의 **실제 최근접 경계 거리를 측정**해 분리 가능한 구간을 찾았다:

| 케이스 | 폴리곤 안? | 최근접 경계 거리 |
|---|---|---|
| 월미도 방문(구제 대상) | ❌ | **0.04px** |
| 동해 한가운데(배제 대상) | ❌ | **102.9px** |
| 원점(0,0)·국경 밖 | ❌ | 3285~18820px |

구제 대상(0.04px)과 배제 대상(103px+) 사이가 크게 벌어져, **12px(~7.5km)** 임계면 해안·소도서는 구제하고 먼바다는 배제한다. 이 실측 좌표(월미도)를 **회귀 테스트**로 못 박아 재발을 막았다.

### 일반화 포인트 (면접용)

- **손실 압축은 도메인 불변식을 깬다**: 좌표 단순화는 "점이 경계에 있다"는 위상 관계를 보존하지 않는다. 시각화용으로 단순화한 폴리곤을 **판정(hit-test)에 재사용**하면 이런 새는 현상이 구조적으로 생긴다. 근본 해결은 위상 보존 단순화(topojson) 또는 판정용 원본 유지지만, 재미 프로젝트에선 **스냅으로 실용 구제**가 비용 대비 낫다.
- **임계값 튜닝은 측정으로**: "구제해야 할 최악 케이스"와 "배제해야 할 최악 케이스"의 지표를 실제로 재서 그 사이를 고른다 — 매직 넘버를 감으로 박지 않는다.
- **폴백은 전제를 점검**: nudge는 "폴리곤이 근처에 크게 있다"를 전제해 돌출부에서 깨졌다. 폴백 설계 시 그 폴백이 어떤 가정 위에 서 있는지 봐야 한다.

### 코드 위치

- `lib/conquer.ts` — `sigunguAt`(정확 판정 → 실패 시 `nearestWithin`), `nearestWithin`, `segDist`
- `lib/conquer.test.ts` — 월미도 실좌표 회귀, 동해 한가운데 배제
- 지도 생성기(단순화 발생 지점): `scripts/genKoreaMap.mjs`(Douglas-Peucker `dp`, `EPS`)
- PR #13 (fix), 설계 맥락 `plan.md` §7.4

### 관련 노트

- (아직 없음 — 추후 "even-odd ray casting", "지도 투영/등거리 근사" 노트 생기면 링크)

---

## 2. 카카오 JS SDK v2 모듈은 init 후에야 붙는다

**한 줄 요약**: 카카오 JS SDK v2(`kakao.min.js`)를 `<script>`로 로드만 하면 `window.Kakao`엔 `VERSION·cleanup·init·isInitialized` 4개뿐이다. `Share`·`Auth`·`API` 같은 **기능 모듈은 `Kakao.init(appKey)`를 호출한 뒤에야** `Kakao` 객체에 붙는다. 그래서 `Kakao.Share.sendDefault`를 쓰기 전에 **반드시 `init` 먼저** — 안 그러면 `Kakao.Share`가 `undefined`라 터진다.

### 문제 / 배경

카톡 공유(M13)에서 `Kakao.Share.sendDefault`로 공유 카드를 띄운다. SDK를 로드하고 `window.Kakao`를 봤더니 로드는 분명 성공(객체 존재, `VERSION` 2.7.6)인데 **`Share`만 `undefined`**였다.

### 원인

카카오 v2 SDK는 로드 시 **코어(`init`/`isInitialized` 등)만** 노출하고, `Kakao.init(appKey)`가 실행되면서 `Share`/`Auth`/`API`/`Channel`/`Navi` 등 모듈을 `Kakao` 객체에 **등록**한다. 즉 `init`은 "앱 키 저장" 이상으로 **모듈 등록 트리거**다. init 전엔 모듈 접근이 곧 `undefined` 참조.

실측:
- init 전 `Object.keys(Kakao)` = `[VERSION, cleanup, init, isInitialized]`
- init 후 = `[…, Auth, API, Share, Channel, Navi, Picker, Cert]`

### 해법

호출 순서를 **init → 모듈 사용**으로 고정하고, 중복 init은 `isInitialized()`로 가드:

```js
if (!Kakao.isInitialized()) Kakao.init(JS_KEY);
Kakao.Share.sendDefault(template); // 이제 Kakao.Share 존재
```

### 테스트에서 얻은 별도 교훈 — 전역 스텁 오염

로컬 검증 때 `window.Kakao`를 통째로 스텁(`{ init, isInitialized, Share: { sendDefault } }`)해 페이로드를 가로챘다. 그 뒤 **같은 페이지**에서 진짜 SDK를 로드해 "Share 있나?"를 확인했더니 `true`가 나와 "SDK에 Share 있음"으로 오판했다. 실제로는 카카오 SDK 부트스트랩이 `window.Kakao = window.Kakao || {}` 식이라 **내 스텁의 `Share`가 살아남아** 거짓 양성을 만든 것. 진상은 스텁 없는 새 페이지(프로덕션)에서 확인해야 드러났다. → **SDK를 검증할 땐 스텁·목을 완전히 걷어낸 격리 상태에서 실측**한다.

### 일반화 포인트 (면접용)

- **"로드 성공 ≠ 사용 준비 완료"**: 서드파티 SDK는 로드와 초기화가 분리된 경우가 많다(모듈 지연 등록·핸드셰이크·권한). 전역이 생겼다고 바로 쓰지 말고 문서가 요구하는 init/ready 단계를 지나야 한다.
- **전역 오염은 테스트를 거짓말하게 만든다**: 스텁으로 전역을 덮은 뒤 "진짜"를 확인하면 잔재가 섞인다. 검증은 오염 없는 격리 상태에서.
- **부작용 없는 실검증**: 프로덕션 공유를 확인할 때 `window.open`을 가로채 `sharer.kakao.com/picker/link` 호출만 잡으면, 실제 팝업·전송 없이 end-to-end 성공을 증명할 수 있다.

### 코드 위치

- `hooks/useKakaoShare.ts` — `loadSdk`(1회 주입)·`share`(init→`Kakao.Share.sendDefault`, 폴백 Web Share/클립보드)
- `lib/mapView.ts` — `KAKAO_JS_SDK`(URL + 실측 sha384 integrity)
- 지도 SDK(별개)와의 대조: `hooks/useKakaoLoader.ts`(`window.kakao.maps`)
- PR #14, 설계 맥락 `plan.md` §7.5

### 관련 노트

- (추후 "SRI(subresource integrity)로 CDN 스크립트 무결성 고정" 노트 생기면 링크)

---

## 3. 정적 큐레이션 테이블은 '등재 자격'을 테스트 가드로 박아 검수 회귀를 막는다

**한 줄 요약**: `SEASONAL_CALENDAR` 같은 **사람이 손으로 채우는 정적 큐레이션 테이블**은, "무엇을 넣을지"의 **등재 자격(inclusion policy)** 이 코드가 아니라 **작성자의 머릿속**에만 있다. 이 자격을 주석으로만 적어두면 나중 검수·확장 때 조용히 깨진다 → **자격을 실행 가능한 테스트(denylist/술어)로 못 박으면**, 검수하다 부적격 항목이 다시 들어와도 CI가 잡는다. "데이터에 대한 단위 테스트".

### 문제 / 배경

제철 필터(M6)는 `constants.ts`의 정적 테이블 `SEASONAL_CALENDAR`(품목→제철 월→주산지)로 "이번 달 제철 산지"를 낸다. 이 테이블은 공공 API가 없어 **상식 기반으로 손수 편성**했고, plan.md §13에 "달력 검수"가 백로그로 남아 **나중에 사람이 다시 손댈 예정**이다.

그런데 초기 편성에 **마늘**이 들어가 있었다. 마늘은 사철 유통되는 향신료라 '제철이라 특별히 맛있는' 여행 유인이 아닌데, 표만 보면 "6·7월 제철"로 그럴듯해 보인다. 즉 **등재 자격("여행 동기가 되는 계절 별미만")이 명시되지 않아** 부적격 항목이 섞였다.

### 왜 주석·삭제만으론 부족한가

마늘을 그냥 지우고 "향신료는 빼세요" 주석만 달면, §13 검수 때 다른 사람(또는 미래의 나)이 자료를 교차검증하며 **고추·양파·생강을 '제철 채소'로 다시 추가**할 수 있다. 주석은 강제력이 없다. 큐레이션 테이블의 위험은 **항목이 하나하나는 그럴듯해서 리뷰로 걸러지지 않는다**는 것 — 자격 위반이 무성(silent)하다.

### 해법 — 자격을 실행 가능한 술어로

등재 **금지 목록(denylist)** 을 테스트로 박았다:

```ts
it("연중 상비 향신료·양념(마늘·고추 등)은 제철 품목이 아니다", () => {
  const YEAR_ROUND_AROMATICS = ["마늘","고추","양파","생강","대파","쪽파","부추","파","청양고추"];
  const items = SEASONAL_CALENDAR.map((s) => s.item);
  for (const a of YEAR_ROUND_AROMATICS) expect(items).not.toContain(a);
});
```

- 이제 검수하다 고추를 추가하면 **CI가 즉시 실패** → 정책이 문서가 아니라 **게이트**가 된다.
- 기존에도 데이터 정합성 테스트("12개월 모두 최소 1품목 커버", "months∈[1,12]")가 있었는데, 이건 **형식**(빈 달 없나) 검증이고 새 가드는 **의미**(자격 위반) 검증이라 층위가 다르다.

### 일반화 포인트 (면접용)

- **데이터도 테스트 대상이다**: 로직만 테스트하고 상수 테이블은 "그냥 데이터"라 방치하기 쉽다. 하지만 손으로 채우는 큐레이션 데이터는 **버그가 값에 산다** — 형식(스키마)뿐 아니라 **도메인 규칙(자격)** 을 술어로 검증해야 한다.
- **암묵 규칙을 실행 가능하게(executable spec)**: "이런 건 넣지 마"가 사람 기억/주석에만 있으면 반드시 샌다. 규칙을 CI 게이트로 만들면 **문서-코드 드리프트**가 구조적으로 불가능해진다(전역 CLAUDE.md의 MEMORY 인덱스 자동생성과 같은 사고).
- **무성 실패를 시끄럽게**: 큐레이션 오류는 조용히 그럴듯해서 위험하다. 부적격을 **실패로 승격**시켜 리뷰어의 눈 대신 파이프라인이 잡게 한다.
- **denylist의 한계 인지**: 열거한 것만 막는다(마늘·고추는 잡지만 '깻잎'은 못 잡음). 완전하진 않지만 **알려진 재발 케이스를 못 박는 회귀 방지**로는 충분 — 완벽한 술어(예: 산지 계절성 데이터로 판정)는 과설계.

### 코드 위치

- `lib/constants.ts` — `SEASONAL_CALENDAR`(마늘 제거, 품목 자격 정책 주석)
- `lib/season.test.ts` — "연중 상비 향신료·양념은 제철 품목이 아니다" 가드 + 기존 정합성 테스트
- PR #22, 설계 맥락 `plan.md` §6.4(품목 자격)·§13(달력 검수 백로그)

### 관련 노트

- (추후 "스키마 검증 vs 도메인 규칙 검증", "실행 가능한 명세(executable spec)" 노트 생기면 링크)

---

## 4. 필터가 좁히는 축(지역)과 사용자가 기대하는 약속(품목)의 granularity 갭 — 좁은 축 + 보강 축

**한 줄 요약**: 제철 필터는 "제철 품목의 주산지 **시·도**"로 **지역 단위**로만 풀을 좁혔는데, 사용자가 "제철 산지 맛집"에서 기대하는 건 **품목 단위**("그 제철 재료를 파는 집")다. 이 **granularity(입도) 갭** 때문에 '수박 제철 지역의 횟집'처럼 **조건은 만족하지만 약속은 못 지키는** 결과가 나온다. 해법: 값싼 축(지역)으로 1차로 좁히고, **세부(품목↔식당)는 다른 API 축(키워드 검색)으로 보강**해 갭을 메운다. 단 모든 품목이 그 축으로 보강되진 않으므로(수박=식당 없음) **보강 불가 케이스는 정직하게 폴백**한다(못 지킬 약속은 지킨 척도 안 함 — 배지 제거).

### 문제 / 배경

제철+음식점 조합에서, `narrowBySeasonal`은 이번 달 제철 품목의 산지 `areaCode`(시·도) 집합으로 지역 풀을 교집합한다. 그다음 음식점(39)은 `areaBasedList2`로 그 시·도의 **랜덤 식당 1건**을 뽑는다. 지역은 맞지만 "이 지역이 그 재료 산지"라는 사실과 "뽑힌 식당이 그 재료를 판다"는 기대 사이에 **연결이 없다**. 그래서 수박 산지(충남)에서 횟집이 뽑히고 `지금 제철 🍉수박` 배지가 붙는다.

### 원인 / 개념 — 판정 축 ≠ 가치 축

필터가 **좁히는 축**(지역)과 사용자의 **가치 축**(품목-식당 매칭)이 다른 게 근본 원인이다. 지역으로 좁히는 건 **값싸고**(로컬 상수) **결정적**이지만, 그 지역 안에서 "제철 재료를 파는 집"을 고르려면 **식당↔재료라는 별도 정보**가 필요하다. TourAPI는 식당에 재료 태그를 주지 않는다 → 대신 **품목명을 키워드로 식당 텍스트를 검색**(`searchKeyword2`)해 근사 매칭한다.

### 해법 — 좁은 축 + 보강 축, 그리고 정직한 폴백

1. **1차(값싼 축)**: 지역 좁히기(기존 `narrowBySeasonal`).
2. **2차(보강 축)**: 그 지역 제철 품목명으로 `searchKeyword2(contentTypeId=39, areaCode)` → 실제 그 재료 다루는 식당.
3. **보강 자격**: 모든 제철 품목이 식당 매칭되진 않는다(수박·사과=농산물, "○○ 맛집" 없음) → `SeasonalItem.dish` 플래그로 회·해산물만 검색 대상.
4. **정직한 폴백**: dish 품목이 없거나 키워드 0건이면 일반 식당으로 폴백하되 **제철 배지를 제거**한다. 매칭 성공 시엔 배지를 **매칭된 그 품목만** 노출(지역 전체가 아니라 뽑힌 집과 일치).

실측(7월, dish 제철=전복/전남뿐): 전남 → 완도 **명품전복궁** + 🐚전복 배지 / 충남(수박) → 칠갑산골, **배지 없음**.

### 일반화 포인트 (면접용)

- **granularity 갭을 의식하라**: 필터가 "무슨 축으로 좁히는가"와 사용자가 "무엇을 기대하는가"의 입도가 다르면, **조건은 통과하지만 체감은 틀린** 결과가 난다. 좁힌 축 ≠ 약속한 축.
- **좁은 축 + 보강 축**: 값싸고 결정적인 축(로컬 상수 지역)으로 1차 필터, 비싸고 정밀한 축(원격 키워드 검색)으로 세부 보강. 전부 정밀 축이면 느리고, 전부 값싼 축이면 약속을 못 지킨다.
- **근사 매칭의 구멍은 정직하게**: 키워드 매칭 같은 근사법은 늘 커버리지 구멍이 있다(수박=식당 없음). 구멍에서 "있는 척"(엉뚱한 배지)하지 말고 조용히 폴백 — **틀리게 채우는 것보다 비우는 게 낫다**.
- **판정 축을 데이터에 심어라**: `dish` 플래그처럼 "이 항목이 어느 축에서 유효한가"를 데이터에 명시하면 코드가 분기 지식을 안 떠안는다(노트 3의 '등재 자격을 데이터에 executable하게'와 같은 결).

### 코드 위치

- `lib/season.ts` — `dishSeasonalItemsForArea`(보강 대상 = dish 제철 품목 선별)
- `lib/tourapi.ts` — `pickSeasonalRestaurant`(searchKeyword2 보강)·`drawByType`(링크·폴백·배지 정합)
- `lib/constants.ts` — `SeasonalItem.dish`
- PR #23, 설계 맥락 `plan.md` §6.4

### 관련 노트

- [3. 정적 큐레이션 테이블은 '등재 자격'을 테스트 가드로](#3-정적-큐레이션-테이블은-등재-자격을-테스트-가드로-박아-검수-회귀를-막는다) — `dish`도 '정책·축을 데이터에 심는' 같은 결.

---

## 5. effect 내 동기 setState 대신 useSyncExternalStore — 마운트 시 브라우저 환경값 읽기의 정석

**한 줄 요약**: 마운트 시점에 브라우저 환경값(설치 여부 `display-mode: standalone`, iOS 판정 `navigator.userAgent`)을 읽어 **렌더에 쓰려고** `useEffect` 안에서 `setState`하면, React의 lint 규칙 `react-hooks/set-state-in-effect`가 "cascading render 유발"로 막는다. 이건 **외부 시스템(브라우저)의 상태를 React 렌더로 끌어오는** 전형적 패턴이고, 정확히 그걸 위해 만들어진 훅이 **`useSyncExternalStore`** 다. `getServerSnapshot`으로 **SSR 안전**(서버엔 `window`가 없음)까지 공짜로 얻고, `standalone`처럼 도중에 바뀌는 값은 `subscribe`로 **자동 반영**된다.

### 문제 / 배경

PWA 설치 버튼(`InstallButton`)은 "설치를 유도할지"를 정하려 마운트 시 세 브라우저 값을 읽어야 한다: `matchMedia("(display-mode: standalone)")`(이미 설치돼 앱으로 실행 중인가), `navigator.standalone`(iOS 설치 여부), `navigator.userAgent`(+`platform`/`maxTouchPoints`로 iOS 판정). 이 값들은 **SSR 시점엔 존재하지 않아**(`window`/`navigator` undefined) `useState` 초기화로 못 넣는다. 그래서 반사적으로 쓴 게 `useEffect(() => { setStandalone(...); setIos(...); }, [])`.

그런데 eslint가 정확히 그 두 줄을 물었다:

```
error  Calling setState synchronously within an effect can trigger cascading renders  react-hooks/set-state-in-effect
```

### 왜 규칙이 막나 — effect의 목적은 "동기화"지 "값 계산"이 아니다

effect 본문에서 동기적으로 `setState`하면 **렌더 → effect 실행 → setState → 재렌더**의 연쇄가 매 마운트마다 돈다(React가 커밋 후 effect를 돌리고, 거기서 상태가 또 바뀌어 다시 렌더). React 공식 가이드 *"You Might Not Need an Effect"* 의 지침은 명확하다 — effect는 **외부 시스템과 동기화**(구독/정리)에 쓰고, "외부 값을 읽어 렌더에 반영"하려면 **`useSyncExternalStore`** 를 쓰라는 것.

### 왜 lazy `useState`도 답이 아닌가

"그럼 `useState(() => getSnapshot())`로 초기화하면?" — **안 된다.** 초기화 함수는 **SSR에서도 실행**되어 서버에서 `window.matchMedia`를 건드려 렌더가 크래시한다. 설령 클라이언트 전용으로 우회해도, 서버(값 없음)와 클라이언트(값 있음)의 초기 렌더가 달라 **hydration mismatch**가 난다. 클라이언트 전용 값을 초기 상태에 욱여넣는 건 SSR 프레임워크(Next)에서 구조적으로 위험하다.

### 해법 — `useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)`

세 인자가 정확히 이 문제의 세 축을 가른다:

```ts
// 값이 도중에 바뀜(설치되면 standalone 전환) → 구독
const standalone = useSyncExternalStore(
  (onChange) => {                       // subscribe: 외부 변화 구독
    const mq = window.matchMedia("(display-mode: standalone)");
    mq.addEventListener("change", onChange);
    window.addEventListener("appinstalled", onChange);
    return () => { /* 정리 */ };
  },
  () => window.matchMedia?.("(display-mode: standalone)").matches === true
        || navigator.standalone === true,  // getSnapshot: 클라 현재값
  () => false,                             // getServerSnapshot: SSR 초기값
);

// 값이 안 바뀜(iOS 판정은 고정) → subscribe는 no-op, 스냅샷만
const ios = useSyncExternalStore(() => () => {}, getIsIOS, () => false);
```

- **effect 내 setState가 사라져** 규칙을 통과한다(상태 계산이 훅 내부로 들어감).
- **SSR 안전**: 서버는 `getServerSnapshot`(=false)만 쓰고, hydration 후 클라 스냅샷으로 교체하는 걸 React가 **tearing 없이** 처리한다.
- **자동 반영**: 설치가 끝나 `appinstalled`가 뜨면 `subscribe`의 리스너가 `onChange`를 불러 스냅샷이 재평가 → 버튼이 스스로 사라진다.
- **안 변하는 값도 이 훅으로 감싸면 SSR-safe**: iOS 판정은 마운트 후 불변이라 `subscribe`를 no-op으로 두고 `getSnapshot`만 쓴다. lazy `useState`가 못 하던 "클라 전용 값의 안전한 초기 확보"를 대신한다.

### 일반화 포인트 (면접용)

- **외부 가변 상태를 렌더에 쓰는 정석은 `useSyncExternalStore`다**: media query, `navigator.onLine`, `localStorage`, 서드파티 스토어처럼 **React 밖에서 바뀌는 값**을 렌더에 반영할 때의 1급 도구. `useEffect`+`setState`는 그 하위호환 수동 구현이고, 동시성 렌더에서 **tearing**(같은 렌더 안에서 값이 갈림)이 날 수 있다.
- **SSR에선 "클라 전용 값"을 초기 상태에 넣지 마라**: `useState` 초기화 함수는 서버에서도 돈다 → `window` 접근 크래시 + hydration mismatch. `getServerSnapshot`으로 **서버 초기값을 명시 분리**하는 게 정답.
- **lint 규칙은 벌이 아니라 설계 유도다**: `set-state-in-effect`를 만났을 때 반사적으로 `eslint-disable`하지 않고 "왜 막지?"를 물으니 **더 나은 원시(`useSyncExternalStore`)** 로 안내됐다. 규칙을 억누르기 전에 규칙이 가리키는 패턴을 먼저 본다.
- **effect는 동기화, 렌더는 계산**: "외부 값을 읽어 화면에 쓴다"는 건 계산이지 부작용이 아니다. 부작용 훅(effect)에 계산을 욱여넣으면 연쇄 렌더로 샌다.

### 코드 위치

- `components/InstallButton.tsx` — `subscribeStandalone`·`getStandalone`(가변, 구독), `getIsIOS`+`noopSubscribe`(불변), `useSyncExternalStore` 2회
- `lib/pwaInstall.ts` — 순수 판정 `installMode`·`isIOS`(DOM 없이 테스트, TDD 13케이스)
- PR #26, 설계 맥락 `plan.md` §11 M9(PWA 보강)

### 관련 노트

- [6. 같은 set-state-in-effect라도 처방이 다르다](#6-같은-set-state-in-effect라도-처방이-다르다--prop-변화에-내부-상태-리셋은-이전-렌더-값-저장-렌더-시점-패턴) — 같은 lint 규칙, **다른 처방**: #5는 외부 시스템 값(브라우저)→store 구독, #6은 React prop 변화→렌더-시점 리셋.
- (추후 "hydration mismatch", "React 동시성 렌더의 tearing", "부작용 vs 파생 상태" 노트 생기면 링크)

---

## 6. 같은 set-state-in-effect라도 처방이 다르다 — prop 변화에 내부 상태 리셋은 '이전 렌더 값 저장' 렌더-시점 패턴

**한 줄 요약**: 노트 5와 **같은 lint 규칙**(`react-hooks/set-state-in-effect`)에 또 걸렸지만 **처방이 다르다**. 5는 "외부 시스템(브라우저) 값을 렌더에 반영"이라 `useSyncExternalStore`가 답이었고, 이번은 "**prop이 바뀌면 그 컴포넌트의 내부 상태를 리셋**(+1회성 통지)"이다 — 이건 React 공식 패턴 **"이전 렌더 정보 저장(storing information from previous renders)"**, 즉 **렌더 도중** `prev` 값과 현재 prop을 비교해 조건부로 `setState`하는 것이다. `useEffect`가 아니라 **렌더 본문**에서 하기 때문에 규칙에 안 걸리고, effect 특유의 "한 프레임 늦은 리셋(깜빡임)"도 없다.

### 문제 / 배경

M20 반나절 코스의 `CoursePanel`은 상위(page)가 소유한 `state`(생성 lifecycle: `idle`→`loading`→`ok`/`error`)를 prop으로 받는다. **새 코스가 준비되면**(`ok` 전환) sr-only live region에 "반나절 코스가 준비됐어요"를 통지하고, 이전 코스의 **행별 재뽑기 상태(busy·행 에러)를 리셋**해야 한다. 반사적으로 쓴 게:

```tsx
useEffect(() => {
  setBusy(null); setRowErr(null);
  if (state.kind === "ok") setLive("반나절 코스가 준비됐어요.");
}, [state.kind]);
```

그리고 노트 5와 **똑같은 에러**가 떴다: `Calling setState synchronously within an effect can trigger cascading renders (react-hooks/set-state-in-effect)`.

### 왜 5의 해법(useSyncExternalStore)이 여기선 안 맞나

5는 변화의 **출처가 React 밖**(matchMedia·navigator)이었다 → 외부 스토어를 구독하는 게 맞다. 그런데 여기서 변화의 출처는 **React prop(`state.kind`) 자체**다. prop은 이미 React가 렌더로 흘려주는 값이라 "구독"할 외부 스토어가 없다. 이건 전형적인 **"prop이 바뀌면 파생/리셋 상태를 조정"** 문제고, React 문서가 이걸 위해 안내하는 건 store가 아니라 **렌더 중 setState**다.

### 해법 — 렌더 도중 prev와 비교 (key 리마운트의 경량 대안)

```tsx
const [prevKind, setPrevKind] = useState(state.kind);
if (prevKind !== state.kind) {   // 렌더 본문 — effect 아님
  setPrevKind(state.kind);
  setBusy(null);
  setRowErr(null);
  setLive(state.kind === "ok" ? "반나절 코스가 준비됐어요."
        : state.kind === "error" ? state.message : "");
}
```

- **왜 렌더 중 setState가 합법인가**: 조건(`prevKind !== state.kind`)이 **다음 렌더엔 거짓**이 되므로 무한루프가 아니다. React는 이 setState를 보면 **커밋·페인트 전에** 곧바로 그 컴포넌트만 재렌더한다(자식 effect·DOM 안 건드림) — effect처럼 "그린 다음 고쳐 다시 그리는" 연쇄가 아니다. 그래서 **깜빡임 없고** lint도 통과한다.
- **재뽑기는 안 걸린다**: 스텝 재뽑기는 `state.kind`가 `ok`로 **불변**이라 이 블록이 안 돈다 → 재뽑기 중 busy·행 에러가 리셋으로 날아가지 않는다. "리셋 트리거"를 `kind` 전환으로 못 박은 게 정확히 이래서다.
- **key 리마운트와의 트레이드오프**: `<CoursePanel key={anchorId}>`로 통째 리마운트해도 리셋은 되지만, DOM을 버리고 다시 만들며 **1회성 통지(live)를 태우기 어렵다**. prev-비교는 **상태만 골라 리셋**하고 통지도 같은 자리에서 얹는다.

### 일반화 포인트 (면접용)

- **같은 lint, 다른 처방 — 변화의 출처를 봐라**: `set-state-in-effect`를 만나면 "외부 시스템發인가(→ `useSyncExternalStore`) vs React prop發인가(→ 렌더 중 prev 비교)"로 가른다. 규칙 하나에 정답 하나가 아니다.
- **"이전 렌더 정보 저장"은 1급 패턴이다**: `getDerivedStateFromProps`의 함수형 컴포넌트판. prop 변화에 상태를 맞추는 표준 도구이고, `useEffect`+`setState`는 그 **깜빡이는 하위호환**이다(effect는 페인트 후라 stale 프레임이 샌다).
- **렌더 중 setState = 무한루프? 아니다**: 조건이 수렴하면(다음 렌더에 거짓) 안전하다. React가 커밋 전에 흡수한다. "렌더는 순수해야"의 예외가 아니라, **동기적 자기 보정**으로 문서가 허용한 범위다.
- **리셋 트리거를 좁게 못 박아라**: `[state.kind]`로 트리거를 잡아 "새 코스"만 리셋하고 "같은 코스 내 재뽑기"는 건드리지 않았다 — 트리거 축을 잘못 넓히면(예: `[state]` 전체) 재뽑기마다 상태가 날아간다.

### 코드 위치

- `components/CoursePanel.tsx` — `prevKind` 렌더-시점 리셋 블록(`busy`·`rowErr`·`live` 통지)
- 대조: `components/InstallButton.tsx`(노트 5 — 외부값은 `useSyncExternalStore`)
- PR #31, 설계 맥락 `plan.md` §7.10(M20 코스)

### 관련 노트

- [5. effect 내 동기 setState 대신 useSyncExternalStore](#5-effect-내-동기-setstate-대신-usesyncexternalstore--마운트-시-브라우저-환경값-읽기의-정석) — 같은 규칙의 **다른 절반**(외부 시스템發 변화).

---

## 7. Auth.js v5의 redirect_uri는 요청 host로 조립된다 — Vercel Preview마다 redirect_uri_mismatch, AUTH_REDIRECT_PROXY_URL로 봉쇄

**한 줄 요약**: Auth.js v5(next-auth v5)는 `AUTH_URL`/`redirectProxyUrl`이 없으면 OAuth `redirect_uri`를 **요청이 도착한 host**로 매번 조립한다(Vercel에선 `VERCEL=1`이라 `trustHost`가 자동 on → `x-forwarded-host`를 그대로 신뢰). 그래서 배포마다 도메인이 바뀌는 **Vercel Preview**에서 로그인하면 `redirect_uri`가 그 Preview 도메인이 되고, 구글/카카오 콘솔엔 그 도메인을 미리 등록할 수 없어 **`400 redirect_uri_mismatch`**가 난다. 해법은 `AUTH_REDIRECT_PROXY_URL`(프로덕션·Preview **양쪽** 동일값)로 콜백을 **안정적 프로덕션 URL에 프록시**하는 것 — 원래 Preview URL은 `state`에 담겨 검증 후 복귀한다.

### 문제 / 배경

운영(`travelanywhere-kr.vercel.app`)에선 구글 로그인이 잘 되는데, "왜 어떤 환경에선 로그인 중 400이 뜰 여지가 있나"를 조사했다. `auth.ts`의 `NextAuth({...})`엔 `AUTH_URL`·`trustHost`·`redirectProxyUrl`·`basePath`가 하나도 없고, `Google`을 인자 없이 `providers.push`한다(콜백 URL 커스텀 없음). 즉 **redirect_uri를 프로덕션으로 못 박는 장치가 코드·설정 어디에도 없다.**

### 왜 나는가 — redirect_uri는 코드에 고정돼 있지 않다

`@auth/core`는 `AUTH_URL`/`NEXTAUTH_URL`이 없으면 `createActionURL`에서 origin을 `x-forwarded-host ?? host`로 만든다. 그리고 `trustHost`는 `AUTH_URL ?? AUTH_TRUST_HOST ?? VERCEL ?? …`로 결정되는데 Vercel은 `VERCEL=1`이 상시라 **자동 true** → forwarded-host를 검증 없이 신뢰한다. 결과적으로 `redirect_uri = https://{방문한 도메인}/api/auth/callback/google`이라, **어느 도메인으로 앱을 열었느냐에 따라 redirect_uri가 떠다닌다.** 운영 도메인은 콘솔에 등록돼 통과하지만, Preview 도메인(`…-git-<브랜치>-goospel.vercel.app`, `…-<해시>-goospel.vercel.app`)은 미등록이라 구글이 직접 400을 서빙한다(우리 앱 `?error=`가 아니라 **구글측** 400).

### 왜 Preview는 콘솔 등록으로 못 막나

Preview URL은 **브랜치·커밋마다 새로 생성**돼 값을 예측·고정할 수 없고, 구글 "승인된 리디렉션 URI"는 **와일드카드를 허용하지 않는다**(정확 문자열 매칭). 그래서 "Preview 도메인을 콘솔에 등록"은 비현실적이다.

### 해법 — redirect proxy (한 곳으로 모아 되돌리기)

`AUTH_REDIRECT_PROXY_URL`을 두면 Auth.js가 Preview에서 시작한 로그인의 `redirect_uri`를 **이 안정적 URL로 설정**하고, 원래 Preview URL은 `state`에 저장한다. 구글은 안정적(프로덕션) 콜백으로 돌아오고, 프로덕션이 `state`를 검증해 원래 Preview로 최종 리다이렉트한다. 요건(문서 실측):
- **값 형식**: 프로덕션 URL + `/api/auth` **경로까지** 포함 → `https://travelanywhere-kr.vercel.app/api/auth`
- **설정 위치**: Vercel Production·Preview **둘 다** 동일값(프로덕션에 없으면 프록시가 **아예 미작동** — 프로덕션이 콜백 수신자이므로). 로컬 `.env.local`엔 비워 둠(localhost 콜백 그대로).
- **전제**: `AUTH_SECRET`이 Production·Preview 동일해야 `state` 서명 검증이 된다.
- 콘솔엔 프로덕션 콜백만 있으면 됨(Preview 등록 불필요).

코드는 `redirectProxyUrl: process.env.AUTH_REDIRECT_PROXY_URL` 한 줄(값 미설정 시 `undefined` → 프록시 비활성 = 기존 동작 그대로).

### 일반화 포인트 (면접용)

- **`trustHost`와 forwarded-host의 트레이드오프**: 리버스 프록시(Vercel) 뒤에선 클라이언트가 host 헤더를 위조할 수 있어 기본은 안 믿지만, 플랫폼을 감지하면 자동 신뢰한다. 그 대가로 **redirect_uri가 방문 도메인에 종속**된다. "편의(자동 host)"가 "OAuth 콜백 고정"과 충돌하는 지점.
- **"환경은 여럿, 콜백은 하나"는 OAuth의 구조적 마찰**: preview/staging마다 도메인이 다른데 provider 콜백은 정확 매칭이라, **한 곳(프로덕션)으로 모아 되돌리는 프록시**가 표준 해법이다.
- **"운영은 되는데 특정 환경만 깨진다"는 host 의존 신호**: 재현은 반드시 그 도메인에서 해야 하고, network로 실제 나가는 `redirect_uri`를 캡처하면 즉시 판별된다.

### 코드 위치

- `auth.ts` — `redirectProxyUrl: process.env.AUTH_REDIRECT_PROXY_URL` (+ 배경 주석)
- `.env.local.example` — `AUTH_REDIRECT_PROXY_URL` 값 형식·설정 위치·전제
- PR #33 (fix)

### 관련 노트

- [8. 구글 OAuth "액세스 차단됨"은 한 화면 여러 원인](#8-구글-oauth-액세스-차단됨은-한-화면-여러-원인--상태코드발생단계로-가른다) — 같은 조사에서 나온 이웃 원인(계정 후 403). 이 노트(7)는 그중 (a) 계정 전 400 경로의 봉쇄책.

---

## 8. 구글 OAuth "액세스 차단됨"은 한 화면 여러 원인 — 상태코드·발생단계로 가른다

**한 줄 요약**: 구글 OAuth의 "액세스 차단됨(Access blocked)" 페이지는 **겉모습이 같아도 원인이 여럿**이라, "400번대 떴다"로 뭉뚱그리면 원인이 안 갈린다. 두 축으로 분해한다 — **HTTP 상태코드**와 **발생 단계**. (a) 계정 선택 **전** + `400 redirect_uri_mismatch`/`invalid_request` = 앱이 보낸 `redirect_uri`를 구글이 거부(주소·콘솔 설정). (b) 계정 선택 **후** + `403 access_denied` = 동의화면 **테스트 모드 + 미등록 테스트 사용자**, 또는 **관리형(조직) 계정** 정책 차단(`admin_policy_enforced`).

### 배경

"어제 구글 로그인 중 400번대 에러를 봤는데 오늘은 정상"이라는 간헐 증상을 진단했다. 사용자 증언이 흐릿했다 — 정확한 코드(401/403?), 계정 선택 전인지 후인지, 어느 계정을 골랐는지 모두 "가물가물". 이럴 때 추측을 쌓기보다 **판별 축**으로 분해해야 한다.

### 두 진단 축

1. **발생 단계(값싼 이분법)**: 구글은 `redirect_uri`·`client_id`를 **먼저** 검증한다 → 통과해야 **계정 선택 화면** → 계정을 골라야 **동의/차단** 단계. 따라서 "**계정 선택 화면을 봤는지**"가 핵심 분기다. 계정 화면 **전**에 막혔으면 redirect_uri 계열, **후**면 access_denied 계열.
2. **상태코드**: `redirect_uri_mismatch`/`invalid_request` = **400**, `access_denied`/`admin_policy_enforced` = **403**. "정확히 400"과 "400번대(401/403)"는 다르다 — 사용자가 403을 "400번대"로 뭉뚱그리기 쉽다.

### 원인별 처방

| 상태코드 | 단계 | 원인 | 처방 |
|---|---|---|---|
| `400 redirect_uri_mismatch` | 계정 **전** | Preview/미등록 도메인에서 로그인 | redirect proxy (노트 7) |
| `403 access_denied` | 계정 **후** | 동의화면 테스트 모드 + 미등록 테스트 사용자 | 테스트 사용자 등록, 또는 동의화면 "게시"(비민감 스코프면 검증 없이 즉시) |
| `403 admin_policy_enforced` | 계정 **후** | 회사·학교(Workspace) 계정의 조직 정책 차단 | 개인 계정 사용 |

### 실측으로 가르는 법

기억이 흐릿할 때 결정타는 **재현/실측**이다. 운영 주소에서 로그인 흐름을 실제로 태워 **network로 나가는 `redirect_uri`를 캡처**했더니 `https://travelanywhere-kr.vercel.app/api/auth/callback/google`로 정확했고 **계정 선택 화면까지 도달**했다 → redirect_uri(전 단계)는 정상이라는 실증. 그러면 남는 건 계정 **후** 403뿐이고, "구글 로고 + 액세스 차단됨" 증언과 합쳐 **동의화면 테스트 모드 + 미등록 계정**으로 좁혀졌다.

### 일반화 포인트 (면접용)

- **같은 에러 화면, 다른 원인 — 사용자 증언은 부정확하다**: "400번대"는 401·403을 뭉뚱그린 것일 수 있다. **판별 축(상태코드·발생 단계)**으로 분해해야 원인이 하나로 수렴한다.
- **OAuth는 다단계 핸드셰이크 — "어디서 끊겼나"가 원인의 절반**: redirect_uri 검증 → 계정 선택 → 동의/차단. "계정 화면을 봤나?"는 비용 0의 이분법이다.
- **재현 > 기억**: 흐릿한 기억으로 가설을 늘리지 말고, 그 기기·도메인·계정으로 재현해 **그 순간의 URL·문구·상태코드**를 캡처한다. network 캡처는 증언을 대체하는 사실이다.
- **코드 버그와 설정 이슈를 가른다**: (a)는 앱 설정(redirect_uri 고정)으로, (b)는 **Google Cloud Console**(동의화면 게시상태·테스트 사용자)로 해결한다 — 둘 다 `auth.ts` 로직 버그가 아니다.

### 코드 위치

- 진단 방법론 노트(코드 변경 없음). (a) 경로의 봉쇄책은 노트 7 / PR #33.
- 조사 맥락: 구글 로그인 400번대 진단 세션(2026-07-13).

### 관련 노트

- [7. Auth.js v5의 redirect_uri는 요청 host로 조립된다](#7-authjs-v5의-redirect_uri는-요청-host로-조립된다--vercel-preview마다-redirect_uri_mismatch-auth_redirect_proxy_url로-봉쇄) — (a) 계정 전 400 경로의 원인·해법.

---

## 🔄 누적 갱신

| 일자 | 추가 항목 |
|---|---|
| 2026-07-05 | 초안 — 1. 지도 단순화 해안 침식 → 최근접 경계 스냅 |
| 2026-07-05 | 2. 카카오 JS SDK v2 — init 후에야 Share 모듈이 붙는다 (+ 스텁 오염 오탐) |
| 2026-07-06 | 3. 정적 큐레이션 테이블의 등재 자격을 denylist 테스트 가드로 박기 (제철 달력 마늘 제외) |
| 2026-07-06 | 4. granularity 갭(지역↔품목) — 좁은 축(지역)+보강 축(키워드 검색)+정직한 폴백 (제철+음식점 매칭) |
| 2026-07-06 | 5. effect 내 동기 setState 대신 useSyncExternalStore — 마운트 시 브라우저 환경값 읽기·SSR 안전 (PWA 설치 버튼) |
| 2026-07-10 | 6. 같은 set-state-in-effect라도 처방이 다르다 — prop 변화 리셋은 '이전 렌더 값 저장' 렌더-시점 패턴 (M20 코스 패널) |
| 2026-07-13 | 7. Auth.js v5 redirect_uri는 요청 host로 조립 → Vercel Preview redirect_uri_mismatch, AUTH_REDIRECT_PROXY_URL로 봉쇄 (PR #33) |
| 2026-07-13 | 8. 구글 OAuth "액세스 차단됨"은 한 화면 여러 원인 — 상태코드(400/403)·발생단계(계정 전/후)로 가른다 (진단 방법론) |

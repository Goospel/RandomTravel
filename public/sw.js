// RandomTravel 최소 서비스워커 (M9 PWA) — 설치 가능 + 오프라인 앱 셸.
//
// 캐시 원칙(적대적 리뷰 반영):
//  - 랜덤 결과 /api/* : 캐시 금지(매번 달라야 함).
//  - 페이지 이동      : 네트워크 우선. **200(res.ok)·비리다이렉트일 때만** 셸 캐시
//                       → 5xx·점검·로그인 리다이렉트 HTML 이 오프라인 셸로 굳는 사고 방지.
//                       캐시 키는 요청 URL(경로별) → 라우트가 늘어도 폴백이 엉키지 않음.
//  - /_next/static/*  : 콘텐츠 해시라 불변 → 캐시 우선.
//  - 그 외(아이콘·매니페스트·폰트 등): 패스스루 → 항상 네트워크 최신(스테일 방지).
//    ⚠️ 캐시 전략을 바꿀 땐 CACHE 버전을 올려야 activate 의 옛 캐시 청소가 동작한다.

const CACHE = "rt-shell-v2";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      // 셸 프리캐시는 best-effort — 실패해도 설치를 막지 않는다.
      .then((c) => c.add("/").catch(() => {}))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

function offlinePage() {
  return new Response(
    "<!doctype html><meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1'>" +
      "<title>오프라인</title><body style=\"font-family:system-ui,sans-serif;padding:2rem;text-align:center;color:#3f3f46\">" +
      "<p style=font-size:2rem>📡</p><p>오프라인 상태예요.<br>네트워크에 연결한 뒤 다시 시도해 주세요.</p></body>",
    { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // 랜덤 결과는 캐시 금지 — 네트워크 그대로.
  if (url.pathname.startsWith("/api/")) return;

  // 페이지 이동: 네트워크 우선, 정상 응답만 캐시, 오프라인이면 셸 폴백.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok && !res.redirected) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() =>
          caches
            .match(req)
            .then((hit) => hit || caches.match("/"))
            .then((hit) => hit || offlinePage()),
        ),
    );
    return;
  }

  // 콘텐츠 해시로 불변인 Next 정적 자산만 캐시 우선.
  if (
    url.origin === self.location.origin &&
    url.pathname.startsWith("/_next/static/")
  ) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }

  // 그 외(아이콘·매니페스트·폰트 등)는 패스스루 — 브라우저 HTTP 캐시가 최신성 관리.
});

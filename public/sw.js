// RandomTravel 최소 서비스워커 (M9 PWA) — 설치 가능 + 오프라인 앱 셸.
// 원칙: 랜덤 결과 API(/api/*)는 절대 캐시하지 않고, 정적 자산은 캐시 우선,
// 페이지 이동은 네트워크 우선(오프라인이면 캐시된 셸로 폴백).

const CACHE = "rt-shell-v1";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(["/"]))
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

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // 랜덤 결과는 매번 달라야 하므로 캐시 금지 — 네트워크 그대로.
  if (url.pathname.startsWith("/api/")) return;

  // 페이지 이동: 네트워크 우선, 실패(오프라인) 시 캐시된 앱 셸.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put("/", copy));
          return res;
        })
        .catch(() => caches.match("/")),
    );
    return;
  }

  // 정적 자산(해시 파일명이라 불변): 캐시 우선, 없으면 네트워크 후 캐시.
  event.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok && url.origin === self.location.origin) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});

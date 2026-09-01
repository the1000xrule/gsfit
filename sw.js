/* GS Fit 서비스워커 - 앱 껍데기를 캐싱해서 인터넷이 없을 때도 앱을 열고 기록할 수 있게 한다.
   구글 시트 동기화 같은 외부 API 호출은 절대 캐시하지 않고 그대로 네트워크로 보낸다(캐시된
   옛 응답을 쓰면 동기화가 꼬일 수 있으므로). 이 파일은 GitHub Pages 같은 곳에 온라인으로
   올렸을 때만 의미가 있고, index.html을 로컬 file://로 직접 열면 아예 등록되지 않는다. */
var CACHE_NAME = "gsfit-cache-v1";
var APP_SHELL = ["./", "./index.html", "./manifest.json"];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function (cache) { return cache.addAll(APP_SHELL); })
      .catch(function () { /* 오프라인 상태로 처음 설치되는 경우 등은 조용히 넘어간다 */ })
  );
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k !== CACHE_NAME; })
            .map(function (k) { return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", function (event) {
  if (event.request.method !== "GET") return;
  var url = new URL(event.request.url);
  // 이 앱과 다른 도메인(구글 로그인/시트 API 등)은 캐시하지 않고 그대로 네트워크로 보낸다.
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then(function (cached) {
      var networkFetch = fetch(event.request).then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(CACHE_NAME).then(function (cache) { cache.put(event.request, copy); });
        }
        return res;
      }).catch(function () { return cached; });
      // 캐시가 있으면 즉시 보여주고, 뒤에서 네트워크로 최신 버전을 받아 캐시를 갱신한다
      // (stale-while-revalidate). 캐시가 없으면 네트워크 응답을 기다린다.
      return cached || networkFetch;
    })
  );
});

/*!
 * 站点静态资源缓存
 * HTML 走网络优先（保证文章即时更新），带版本号的 CSS/JS/图片走缓存优先并在后台更新。
 * 跨域请求不接管，避免缓存统计 / 评论等第三方脚本。
 */
const VERSION = '20261122a'
const STATIC_CACHE = 'hg-static-' + VERSION
const PAGE_CACHE = 'hg-page-' + VERSION
const STATIC_PATH = /^\/(?:css|js|fonts?|img|lib)\//
const ASSET_EXT = /\.(?:css|js|mjs|woff2?|ttf|otf|webp|avif|png|jpe?g|gif|svg|ico)$/i

self.addEventListener('install', function () {
  self.skipWaiting()
})

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (key) {
        if (key !== STATIC_CACHE && key !== PAGE_CACHE) return caches.delete(key)
        return null
      }))
    }).then(function () {
      return self.clients.claim()
    })
  )
})

self.addEventListener('fetch', function (event) {
  const request = event.request
  if (request.method !== 'GET' || request.headers.has('range')) return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then(function (response) {
        if (response && response.ok) {
          const copy = response.clone()
          caches.open(PAGE_CACHE).then(function (cache) { cache.put(request, copy) })
        }
        return response
      }).catch(function () {
        return caches.match(request).then(function (hit) {
          return hit || caches.match('/')
        })
      })
    )
    return
  }

  if (!STATIC_PATH.test(url.pathname) && !ASSET_EXT.test(url.pathname)) return

  event.respondWith(
    caches.open(STATIC_CACHE).then(function (cache) {
      return cache.match(request).then(function (hit) {
        const network = fetch(request).then(function (response) {
          if (response && response.ok) cache.put(request, response.clone())
          return response
        }).catch(function () { return hit })
        return hit || network
      })
    })
  )
})
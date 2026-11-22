/*! 注册静态资源缓存（首屏加载完成后再注册，不抢带宽） */
(function (w) {
  'use strict'
  if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return

  w.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch(function () {})
  })
})(window)
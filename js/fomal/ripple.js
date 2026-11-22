/* 点击涟漪：按下处泛开两圈同心水纹，短动画放完自己消失。
   无 RAF、无定时器循环、无常驻元素；关掉时连 pointerdown 监听都不挂。默认开启。 */
(function (w, d) {
  'use strict'
  if (w.FOMAL_RIPPLE) { w.FOMAL_RIPPLE.refresh(); return }
  var KEY = 'hgRippleOn'
  var LAYER_ID = 'ripple-layer'
  var MAX_LIVE = 6
  var TTL = 700
  var layer = null, live = [], wanted = false, bound = false
  var motion = typeof w.matchMedia === 'function' ? w.matchMedia('(prefers-reduced-motion: reduce)') : null

  function read () {
    try {
      var v = w.localStorage.getItem(KEY)
      return v === null ? true : v === '1'
    } catch (e) { return true }
  }
  function quiet () { return !wanted || !!(motion && motion.matches) }

  function ensureLayer () {
    if (layer && layer.parentNode === d.body) return layer
    if (!d.body) return null
    layer = d.createElement('div')
    layer.id = LAYER_ID
    layer.className = 'ripple-layer'
    layer.setAttribute('aria-hidden', 'true')
    layer.setAttribute('role', 'presentation')
    d.body.appendChild(layer)
    live.length = 0
    return layer
  }
  function drop (burst) {
    var i = live.indexOf(burst)
    if (i >= 0) live.splice(i, 1)
    if (burst._ttl) { w.clearTimeout(burst._ttl); burst._ttl = 0 }
    if (burst.parentNode) burst.parentNode.removeChild(burst)
  }
  function clear () {
    while (live.length) drop(live[0])
    if (layer && layer.parentNode) layer.parentNode.removeChild(layer)
    layer = null
  }
  function spawn (x, y) {
    if (quiet()) return
    var host = ensureLayer()
    if (!host) return
    while (live.length >= MAX_LIVE) drop(live[0])
    var burst = d.createElement('div')
    burst.className = 'ripple-burst'
    burst.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0)'
    for (var i = 0; i < 2; i++) {
      var ring = d.createElement('i')
      ring.className = i === 0 ? 'ripple-ring' : 'ripple-ring is-late'
      burst.appendChild(ring)
    }
    host.appendChild(burst)
    live.push(burst)
    burst._ttl = w.setTimeout(function () { burst._ttl = 0; drop(burst) }, TTL)
  }
  function onPointerDown (event) {
    if (!event || event.isPrimary === false) return
    if (typeof event.button === 'number' && event.button > 0) return
    if (typeof event.clientX !== 'number' || typeof event.clientY !== 'number') return
    spawn(event.clientX, event.clientY)
  }
  function bind () {
    if (bound) return
    d.addEventListener('pointerdown', onPointerDown, { passive: true })
    bound = true
  }
  function unbind () {
    if (!bound) return
    d.removeEventListener('pointerdown', onPointerDown)
    bound = false
  }
  function syncControls () {
    var control = d.getElementById('rippleSet')
    if (control) control.checked = wanted
    var hint = d.getElementById('rippleSetHint')
    if (hint) {
      hint.textContent = !wanted ? '点一下，泛起一圈小波纹'
        : (motion && motion.matches ? '已开启 · 减少动态效果偏好下暂停' : '已开启 · 点击处泛起波纹')
    }
  }
  function paint () {
    if (quiet()) { unbind(); clear() } else bind()
    syncControls()
  }
  function refresh () { wanted = read(); paint() }
  function setEnabled (on) {
    wanted = on === true
    try { w.localStorage.setItem(KEY, wanted ? '1' : '0') } catch (e) {}
    paint()
  }
  w.FOMAL_RIPPLE = { setEnabled: setEnabled, refresh: refresh, syncControls: syncControls }
  d.addEventListener('pjax:complete', refresh)
  w.addEventListener('storage', function (event) {
    if (event && event.key !== null && event.key !== KEY) return
    refresh()
  })
  if (motion) {
    if (typeof motion.addEventListener === 'function') motion.addEventListener('change', paint)
    else if (typeof motion.addListener === 'function') motion.addListener(paint)
  }
  if (!d.body) d.addEventListener('DOMContentLoaded', refresh, { once: true })
  refresh()
})(window, document)
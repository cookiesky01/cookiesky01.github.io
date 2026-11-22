/* 萤火虫微光：低密度 CSS 动画，无 canvas / RAF / 定时器循环。
   默认关闭；开启时自动关掉落雪（两者都在背景层，叠在一起会糊成一片）。 */
(function (w, d) {
  'use strict'
  if (w.FOMAL_FIREFLIES) { w.FOMAL_FIREFLIES.refresh(); return }
  var KEY = 'hgFirefliesOn'
  var layer = null, count = 0, wanted = false, away = false
  var motion = typeof w.matchMedia === 'function' ? w.matchMedia('(prefers-reduced-motion: reduce)') : null

  function read () {
    try { return w.localStorage.getItem(KEY) === '1' } catch (e) { return false }
  }
  function snowOn () {
    try {
      var v = w.localStorage.getItem('hgSnowOn')
      return v === null ? true : v === '1'
    } catch (e) { return true }
  }
  function remove () {
    if (layer && layer.parentNode) layer.parentNode.removeChild(layer)
    layer = null
    count = 0
  }
  function disableSnow () {
    try { w.localStorage.setItem('hgSnowOn', '0') } catch (e) {}
    var snow = d.getElementById('snow')
    if (snow) snow.style.display = 'none'
    var check = d.getElementById('snowSet')
    if (check) check.checked = false
    if (w.FOMAL_SNOW && w.FOMAL_SNOW.refresh) w.FOMAL_SNOW.refresh()
  }
  function syncControls () {
    var control = d.getElementById('firefliesSet')
    if (control) control.checked = wanted
    var snowControl = d.getElementById('snowSet')
    if (snowControl) snowControl.checked = snowOn()
    var hint = d.getElementById('firefliesSetHint')
    if (hint) hint.textContent = wanted && motion && motion.matches ? '已开启 · 减少动态效果偏好下暂停' : '下方微光 · 与雪花互斥'
  }
  function paint () {
    if (!wanted) { remove(); syncControls(); return }
    if (snowOn()) disableSnow()
    var paused = away || d.hidden || !!(motion && motion.matches)
    if (layer && layer.parentNode !== d.body) { layer = null; count = 0 }
    var n = w.innerWidth <= 600 ? 8 : 14
    if (!paused && d.body && (!layer || count !== n)) {
      remove()
      layer = d.createElement('div')
      layer.id = 'fireflies-stage'
      layer.setAttribute('aria-hidden', 'true')
      layer.setAttribute('role', 'presentation')
      for (var i = 0; i < n; i++) {
        var mote = d.createElement('span'), glow = d.createElement('i')
        mote.className = 'ff-mote'
        glow.className = 'ff-glow'
        mote.style.left = (3 + i * 90 / n + Math.random() * 4) + '%'
        mote.style.top = (12 + Math.random() * 70) + '%'
        mote.style.setProperty('--ff-drift-time', (20 + Math.random() * 14).toFixed(2) + 's')
        mote.style.setProperty('--ff-delay', (-Math.random() * 30).toFixed(2) + 's')
        mote.style.setProperty('--ff-breathe-time', (4 + Math.random() * 4).toFixed(2) + 's')
        mote.style.setProperty('--ff-size', (2.2 + Math.random() * 1.4).toFixed(2) + 'px')
        mote.style.setProperty('--ff-color', i % 3 === 0 ? '178, 241, 158' : '255, 214, 117')
        mote.appendChild(glow)
        layer.appendChild(mote)
      }
      count = n
      d.body.appendChild(layer)
    }
    if (layer) {
      layer.hidden = !!paused
      layer.setAttribute('data-paused', paused ? 'true' : 'false')
    }
    syncControls()
  }
  function refresh () {
    wanted = read()
    paint()
  }
  function setEnabled (on) {
    wanted = on === true
    try { w.localStorage.setItem(KEY, wanted ? '1' : '0') } catch (e) {}
    if (wanted) disableSnow()
    paint()
  }
  w.FOMAL_FIREFLIES = { setEnabled: setEnabled, refresh: refresh, syncControls: syncControls }
  d.addEventListener('visibilitychange', paint)
  d.addEventListener('pjax:complete', refresh)
  w.addEventListener('resize', paint)
  w.addEventListener('pagehide', function () { away = true; paint() })
  w.addEventListener('pageshow', function () { away = false; refresh() })
  w.addEventListener('storage', function (event) {
    if (event.key !== null && event.key !== KEY && event.key !== 'hgSnowOn') return
    refresh()
  })
  if (motion) {
    if (typeof motion.addEventListener === 'function') motion.addEventListener('change', paint)
    else if (typeof motion.addListener === 'function') motion.addListener(paint)
  }
  if (!d.body) d.addEventListener('DOMContentLoaded', refresh, { once: true })
  refresh()
})(window, document)
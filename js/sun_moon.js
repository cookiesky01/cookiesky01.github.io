/*
 * 昼夜切换（日月动画）
 *
 * Butterfly 5.x 兼容说明：
 * 5.x 把 activateDarkMode / activateLightMode / saveToLocal 收进了 head 内联脚本的
 * 局部作用域，只挂到 window.btf 上，全局已经没有 activateDarkMode() 这个函数；
 * 而且切换主题后还要执行 globalFn.themeChange，否则评论、图表等第三方组件不会跟着换肤。
 * 下面统一走 5.x 的接口，同时保留对 4.x 全局函数的回退。
 */

function btfSwitchTheme(toDark) {
  const mode = toDark ? 'dark' : 'light'
  const btf = window.btf || {}
  const activate = toDark
    ? (btf.activateDarkMode || window.activateDarkMode)
    : (btf.activateLightMode || window.activateLightMode)

  if (typeof activate === 'function') activate()
  else document.documentElement.setAttribute('data-theme', mode)

  const save = btf.saveToLocal || window.saveToLocal
  if (save && typeof save.set === 'function') save.set('theme', mode, 2)
  else {
    try {
      localStorage.setItem('theme', JSON.stringify({ value: mode, expiry: Date.now() + 2 * 86400000 }))
    } catch (e) {}
  }

  // 等价于主题 main.js 里的 handleThemeChange，让评论 / 图表等同步换肤
  const themeChange = (window.globalFn || {}).themeChange
  if (themeChange) {
    Object.keys(themeChange).forEach(key => {
      const fn = themeChange[key]
      if (typeof fn !== 'function') return
      if (key === 'disqus' || key === 'disqusjs') setTimeout(() => fn(mode), 300)
      else fn(mode)
    })
  }
}

// 导航栏和右下角各有一个 #modeicon，两个都要跟着换
function btfSetModeIcons(href) {
  document.querySelectorAll('#modeicon').forEach(icon => icon.setAttribute('xlink:href', href))
}

// 原来的弹窗依赖 Vue + Element UI，站点未引入时安全降级
function btfNightToast(toDark) {
  const title = toDark ? '关灯啦🌙' : '开灯啦🌞'
  const message = toDark ? '当前已成功切换至夜间模式！' : '当前已成功切换至白天模式！'

  // 2026-11-21 统一弹窗：优先用站内 fomalNotify（全站唯一的提示样式）
  if (typeof window.fomalNotify === 'function') {
    try {
      window.fomalNotify({
        title: title,
        message: message,
        position: 'top-left',
        offset: 50,
        showClose: true,
        type: 'success',
        duration: 4000
      })
      return
    } catch (e) {}
  }

  if (typeof window.Vue === 'function') {
    try {
      new window.Vue({
        data: function () {
          this.$notify({
            title: title,
            message: message,
            position: 'top-left',
            offset: 50,
            showClose: true,
            type: 'success',
            duration: 5000
          })
        }
      })
      return
    } catch (e) {}
  }

  try {
    const btf = window.btf || {}
    const gcfg = window.GLOBAL_CONFIG || {}
    if (typeof btf.snackbarShow === 'function' && gcfg.Snackbar && typeof window.Snackbar !== 'undefined') {
      btf.snackbarShow(title + ' ' + message)
    }
  } catch (e) {}
}

/* ===== 2026-11-21 昼夜切换 2.0：移植 fomal「黄昏落幕」三拍剧本 =====
   与 source/css/custom.css 里的 .dm-stage 块一一对应：
   BEAT1 450ms 日落/日出 → BEAT2 450ms 暮色 + 第一批星 → BEAT3 600ms 星夜铺满，
   1150ms 起圆形揭幕 350ms，合计 1500ms；转昼整体 ×0.8。
   darkTransition=off 直接换肤；=light 走旧的 Cuteen 转盘（兜底）。 */
var DM = {
  TIER_KEY: 'darkTransition',
  TIERS: ['off', 'light', 'standard', 'flourish'],
  TOTAL: 1500,
  REVEAL_AT: 1150,
  REVEAL: 350,
  STAR_MAX: 40,
  NOTIFY_GAP: 150
}

var dmLastPoint = { x: 0, y: 0, has: false }
document.addEventListener('pointerdown', function (e) {
  dmLastPoint = { x: e.clientX, y: e.clientY, has: true }
}, true)

function dmTier() {
  try {
    var t = localStorage.getItem(DM.TIER_KEY)
    return DM.TIERS.indexOf(t) >= 0 ? t : 'standard'
  } catch (e) { return 'standard' }
}

function dmPoint() {
  var w = window.innerWidth || 1280
  var h = window.innerHeight || 800
  if (dmLastPoint.has) return { x: dmLastPoint.x, y: dmLastPoint.y }
  return { x: Math.round(w / 2), y: Math.round(h / 2) }
}

function dmClearStage() {
  var old = document.querySelector('.dm-stage')
  if (old && old.parentNode) old.parentNode.removeChild(old)
}

function dmBuildStage(toDark, tier) {
  var small = (window.innerWidth || 1280) <= 600
  var p = dmPoint()
  var stage = document.createElement('div')
  stage.className = 'dm-stage'
  stage.setAttribute('data-to', toDark ? 'dark' : 'light')
  stage.setAttribute('data-tier', tier)
  stage.style.setProperty('--dm-x', p.x + 'px')
  stage.style.setProperty('--dm-y', p.y + 'px')

  var sky = document.createElement('div'); sky.className = 'dm-sky'
  var dusk = document.createElement('div'); dusk.className = 'dm-dusk'
  var stars = document.createElement('div'); stars.className = 'dm-stars'
  var sun = document.createElement('div'); sun.className = 'dm-sun'
  var moon = document.createElement('div'); moon.className = 'dm-moon'
  var clouds = document.createElement('div'); clouds.className = 'dm-clouds'
  clouds.appendChild(document.createElement('i'))
  clouds.appendChild(document.createElement('i'))
  var horizon = document.createElement('div'); horizon.className = 'dm-horizon'
  var glow = document.createElement('div'); glow.className = 'dm-glow'
  var meteor = document.createElement('div'); meteor.className = 'dm-meteor'

  var count = tier === 'flourish' ? DM.STAR_MAX : (tier === 'standard' ? 28 : 14)
  if (small) count = Math.round(count / 2)
  for (var i = 0; i < count; i++) {
    var st = document.createElement('i')
    st.className = 'dm-star'
    st.style.setProperty('--dm-sx', (Math.random() * 100).toFixed(2) + '%')
    st.style.setProperty('--dm-sy', (Math.random() * 70).toFixed(2) + '%')
    st.style.setProperty('--dm-ss', (Math.random() * 2 + 1).toFixed(2) + 'px')
    st.style.setProperty('--dm-sd', Math.round(Math.random() * 700) + 'ms')
    st.style.setProperty('--dm-so', (Math.random() * 0.4 + 0.55).toFixed(2))
    stars.appendChild(st)
  }

  var layers = [sky, dusk, stars, sun, moon, clouds, horizon, glow, meteor]
  for (var k = 0; k < layers.length; k++) stage.appendChild(layers[k])
  return stage
}

/* 旧的「日月转盘」实现，保留给 darkTransition=light 档与兜底 */
function dmLegacySwitch(toDark) {
  var body = document.querySelector('body')
  body.insertAdjacentHTML('beforeend', '<div class="Cuteen_DarkSky"><div class="Cuteen_DarkPlanet"><div id="sun"></div><div id="moon"></div></div></div>')
  body.classList.toggle('DarkMode', toDark)
  try { localStorage.setItem('isDark', toDark ? '1' : '0') } catch (e) {}
  btfSetModeIcons(toDark ? '#icon-sun' : '#icon-moon')
  var sun = document.getElementById('sun')
  var moon = document.getElementById('moon')
  if (sun) sun.style.opacity = toDark ? '1' : '0'
  if (moon) moon.style.opacity = toDark ? '0' : '1'
  setTimeout(function () {
    if (sun) sun.style.opacity = toDark ? '0' : '1'
    if (moon) moon.style.opacity = toDark ? '1' : '0'
  }, 450)
  btfSwitchTheme(toDark)
  setTimeout(function () {
    var sky = document.querySelector('.Cuteen_DarkSky')
    if (!sky) return
    sky.style.transition = 'opacity 0.75s ease'
    sky.style.opacity = '0'
    setTimeout(function () { if (sky.parentNode) sky.parentNode.removeChild(sky) }, 750)
  }, 750)
  setTimeout(function () { if (typeof btfNightToast === 'function') btfNightToast(toDark) }, 1500)
  if (typeof utterancesTheme === 'function') utterancesTheme()
  if (typeof FB === 'object' && window.loadFBComment) window.loadFBComment()
  if (window.DISQUS && document.getElementById('disqus_thread') && document.getElementById('disqus_thread').children.length) setTimeout(function () { window.disqusReset() }, 200)
}

function switchNightMode() {
  var toDark = document.documentElement.getAttribute('data-theme') !== 'dark'
  var tier = dmTier()

  if (tier === 'off') {
    btfSwitchTheme(toDark)
    try { localStorage.setItem('isDark', toDark ? '1' : '0') } catch (e) {}
    btfSetModeIcons(toDark ? '#icon-sun' : '#icon-moon')
    if (typeof btfNightToast === 'function') btfNightToast(toDark)
    return
  }
  if (tier === 'light') { dmLegacySwitch(toDark); return }

  dmClearStage()
  var stage = dmBuildStage(toDark, tier)
  document.body.appendChild(stage)
  void stage.offsetWidth // 强制回流，让动画从头开始

  btfSwitchTheme(toDark)
  try { localStorage.setItem('isDark', toDark ? '1' : '0') } catch (e) {}
  btfSetModeIcons(toDark ? '#icon-sun' : '#icon-moon')

  var k = toDark ? 1 : 0.8
  window.setTimeout(function () { stage.classList.add('is-reveal') }, Math.round(DM.REVEAL_AT * k))
  window.setTimeout(function () {
    if (typeof btfNightToast === 'function') btfNightToast(toDark)
  }, Math.round((DM.TOTAL - DM.NOTIFY_GAP) * k))
  window.setTimeout(function () {
    if (stage.parentNode) stage.parentNode.removeChild(stage)
  }, Math.round((DM.TOTAL + DM.REVEAL + 120) * k))
}

// head 里的主题脚本会按 localStorage 恢复 data-theme，但模板里的日月图标是写死的月亮，
// 所以刷新 / PJAX 换页后要再同步一次，避免「已经是深色却还显示月亮」
function btfSyncModeIcons() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark'
  btfSetModeIcons(isDark ? '#icon-sun' : '#icon-moon')
}

btfSyncModeIcons()
document.addEventListener('DOMContentLoaded', btfSyncModeIcons)
if (window.btf && typeof window.btf.addGlobalFn === 'function') {
  window.btf.addGlobalFn('pjaxComplete', btfSyncModeIcons, 'sunMoonIconSync')
}

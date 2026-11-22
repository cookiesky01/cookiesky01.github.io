/*!
 * 昼夜切换 2.0「黄昏落幕」——自包含实现（不依赖任何外部 CSS）
 * 日月沿同一条圆弧升/降，落点为画面正上方同一位置；共 1500ms，末段从点击处圆形揭幕。
 * 档位 localStorage.darkTransition：off / light / standard / flourish（默认 standard）
 * 减弱动态效果（prefers-reduced-motion: reduce）保留过场但压到约 45% 时长。
 */
(function () {
  'use strict'

  var TOTAL = 1500
  var REVEAL_AT = 1150
  var REVEAL = 350
  var running = false
  var overlay = null
  var revealTimer = 0
  var finishTimer = 0
  var cleanupTimer = 0
  var overlayGuard = 0
  var revealRAF = 0
  var runGen = 0
  var pending = false
  var STYLE_KEY = 'hgNightStyle'

  function root () { return document.documentElement }
  function isDark () { return root().getAttribute('data-theme') === 'dark' }
  function reduced () {
    try { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch (e) { return false }
  }
  function tier () {
    var t = 'standard'
    try { t = window.localStorage.getItem('darkTransition') || 'standard' } catch (e) {}
    return ['off', 'light', 'standard', 'flourish'].indexOf(t) >= 0 ? t : 'standard'
  }

  // 过场样式：scene=山河日月（默认） / cuteen=图形（旧版转盘）
  function style () {
    var v = 'scene'
    try { v = window.localStorage.getItem(STYLE_KEY) || 'scene' } catch (e) {}
    return v === 'cuteen' ? 'cuteen' : 'scene'
  }

  function applyTheme (toDark) {
    var btf = window.btf || {}
    var mode = toDark ? 'dark' : 'light'
    var activate = toDark ? (btf.activateDarkMode || window.activateDarkMode)
      : (btf.activateLightMode || window.activateLightMode)
    if (typeof activate === 'function') {
      try { activate() } catch (e) { root().setAttribute('data-theme', mode) }
    } else {
      root().setAttribute('data-theme', mode)
    }
    var save = btf.saveToLocal || window.saveToLocal
    if (save && typeof save.set === 'function') {
      try { save.set('theme', mode, 2) } catch (e) {}
    } else {
      try { localStorage.setItem('theme', JSON.stringify({ value: mode, expiry: Date.now() + 2 * 86400000 })) } catch (e) {}
    }
    try {
      document.body.classList.toggle('DarkMode', !!toDark)
      localStorage.setItem('isDark', toDark ? 'true' : 'false')
      if (window.globalFn && typeof window.globalFn.themeChange === 'function') window.globalFn.themeChange()
    } catch (e) {}
    var icons = document.querySelectorAll('#modeicon, use#modeicon')
    for (var i = 0; i < icons.length; i++) {
      try { icons[i].setAttribute('xlink:href', toDark ? '#icon-sun' : '#icon-moon') } catch (e) {}
      try { icons[i].setAttribute('href', toDark ? '#icon-sun' : '#icon-moon') } catch (e) {}
    }
  }

  function el (css, parent) {
    var d = document.createElement('div')
    d.setAttribute('style', css)
    if (parent) parent.appendChild(d)
    return d
  }

  function anim (node, frames, opts) {
    try {
      if (node && node.animate) return node.animate(frames, opts)
    } catch (e) {}
    return null
  }

  function cleanup () {
    var hadPending = pending
    pending = false
    window.clearTimeout(revealTimer)
    window.clearTimeout(finishTimer)
    window.clearTimeout(cleanupTimer)
    window.clearTimeout(overlayGuard)
    if (revealRAF) { try { cancelAnimationFrame(revealRAF) } catch (e) {} revealRAF = 0 }
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay)
    overlay = null
    running = false
    if (hadPending) {
      window.setTimeout(function () { pending = false; run() }, 40)
    }
  }

  // 结束揭幕：无论 rAF 是否被节流（切标签页/后台），都由这里兜底收尾
  function finishReveal (gen) {
    if (gen !== undefined && gen !== runGen) return
    if (!overlay) return
    var mask = 'radial-gradient(circle 160vmax at 50% 50%, transparent 99%, #000 100%)'
    overlay.style.webkitMaskImage = mask
    overlay.style.maskImage = mask
    overlay.style.visibility = 'hidden'
    running = false
    window.clearTimeout(revealTimer)
    window.clearTimeout(finishTimer)
    var g = runGen
    cleanupTimer = window.setTimeout(function () { if (g === runGen) cleanup() }, 80)
  }

  // 2026-11-21 统一弹窗：全站唯一提示样式 fomalNotify（昼夜 / 美化面板 / 性能模式同一套）
  function nightToast (toDark) {
    if (typeof window.fomalNotify !== 'function') return
    try {
      window.fomalNotify({
        title: toDark ? '关灯啦🌙' : '开灯啦🌞',
        message: toDark ? '当前已切换至夜间模式' : '当前已切换至白天模式',
        position: 'top-left',
        offset: 50,
        showClose: true,
        type: 'success',
        duration: 4000
      })
    } catch (e) {}
  }

  function run () {
    if (running) {
      // 动画进行中再点：记一个待办，等这一轮收尾后立刻补一次，避免“点了没反应”
      if (overlay) { pending = true; return }
      running = false
    }
    running = true
    // 任何异常（浏览器兼容/第三方脚本干扰）都不能把 running 卡死，否则之后所有点击都“没反应”
    try { startRun() } catch (e) { cleanup() }
  }

  function startRun () {
    var my = ++runGen
    var toDark = !isDark()
    var t = tier()

    cleanup()
    running = true

    if (t === 'off') { applyTheme(toDark); running = false; return }

    // 图形（旧版 Cuteen 转盘）：插入旧版 DOM，走主题自带的 Cuteen 动画
    if (style() === 'cuteen') { runCuteen(my, toDark, t); return }

    var pt = window.__dmPoint || { x: Math.round(window.innerWidth / 2), y: Math.round(window.innerHeight * 0.42) }
    var k = (reduced() ? 0.45 : 1) * (t === 'light' ? 0.75 : 1)
    var total = TOTAL * k
    var revealAt = REVEAL_AT * k
    var reveal = REVEAL * k
    var starCount = (t === 'flourish' ? 44 : t === 'standard' ? 30 : 14)
    if (window.innerWidth <= 600) starCount = Math.round(starCount / 2)
    var flourish = t === 'flourish'

    // 全屏幕布（不透明底，避免网页内容透出）
    overlay = el('position:fixed;inset:0;z-index:88888890;overflow:hidden;pointer-events:none;background:#241f45;', null)
    document.body.appendChild(overlay)

    // ① 黄昏底色
    var dawn = el('position:absolute;inset:0;background:'
      + 'linear-gradient(to top,#ffb26b 0%,#ef7d67 20%,#c06a83 42%,#7b5480 62%,#4b3a72 82%,#2b2450 100%);', overlay)

    // ② 夜空层
    var night = el('position:absolute;inset:0;background:'
      + 'linear-gradient(to top,#070d26 0%,#101a3e 30%,#1d2a52 58%,#2f2c58 80%,#3b3163 100%);', overlay)

    // ③ 地平线余光
    var horizon = el('position:absolute;left:0;right:0;bottom:0;height:56%;opacity:0;background:radial-gradient(75% 100% at 50% 100%, rgba(255,196,120,.85) 0%, rgba(244,132,120,.55) 30%, rgba(120,70,140,.25) 58%, rgba(20,20,50,0) 82%);', overlay)

    // ④ 星星
    var stars = el('position:absolute;inset:0;', overlay)
    for (var i = 0; i < starCount; i++) {
      var sx = (Math.random() * 100).toFixed(2) + '%'
      var sy = (Math.random() * 66).toFixed(2) + '%'
      var ss = (1 + Math.random() * 1.8).toFixed(2) + 'px'
      el('position:absolute;left:' + sx + ';top:' + sy + ';width:' + ss + ';height:' + ss + ';border-radius:50%;background:#fff;opacity:0;'
        + 'box-shadow:0 0 6px rgba(255,255,255,.8),0 0 14px rgba(160,200,255,.35);', stars)
    }

    // ⑤ 太阳 / 月亮：容器放在左上角，用 translate 走弧形轨迹（统一从左往右）
    var W = window.innerWidth
    var H = window.innerHeight
    var D = function (x, y) { return 'translate(' + Math.round(x * W) + 'px,' + Math.round(y * H) + 'px)' }

    // 落下：左上 → 右下（从左往右，逐渐沉入地平线）
    var SET_PATH = [D(0.24, 0.26), D(0.44, 0.32), D(0.68, 0.56), D(0.88, 0.84)]
    // 升起：左下 → 右上（从左往右，逐渐升到天空）
    var RISE_PATH = [D(0.10, 0.86), D(0.28, 0.68), D(0.54, 0.44), D(0.76, 0.28)]

    function celestial (size, style, haloSize, haloStyle) {
      var wrap = el('position:absolute;left:0;top:0;width:0;height:0;will-change:transform;', overlay)
      var halo = el('position:absolute;left:' + (-haloSize / 2) + 'px;top:' + (-haloSize / 2) + 'px;width:' + haloSize + 'px;height:' + haloSize + 'px;border-radius:50%;opacity:0;' + haloStyle, wrap)
      var disc = el('position:absolute;left:' + (-size / 2) + 'px;top:' + (-size / 2) + 'px;width:' + size + 'px;height:' + size + 'px;border-radius:50%;' + style, wrap)
      return { wrap: wrap, halo: halo, disc: disc }
    }

    var sunSet = celestial(92,
      'background:radial-gradient(circle at 38% 34%,#fff8d6 0 14%,#ffe483 42%,#ffb43d 74%,#f0851a 100%);'
      + 'box-shadow:0 0 46px 14px rgba(255,190,90,.5),0 0 120px 40px rgba(255,150,60,.18);',
      360,
      'background:radial-gradient(circle,rgba(255,205,120,.55) 0%,rgba(255,170,90,.22) 42%,rgba(255,150,60,0) 72%);')

    var moonSet = celestial(84,
      'background:radial-gradient(circle at 34% 30%,#fff 0 34%,#e8eefc 64%,#c2ccdf 100%);'
      + 'box-shadow:0 0 34px 10px rgba(190,210,255,.3),inset -6px -8px 18px rgba(120,140,190,.35);',
      240,
      'background:radial-gradient(circle,rgba(200,220,255,.35) 0%,rgba(160,190,255,.12) 45%,rgba(120,150,255,0) 72%);')

    var sun = sunSet.disc
    var sunHalo = sunSet.halo
    var sunWrap = sunSet.wrap
    var moon = moonSet.disc
    var moonHalo = moonSet.halo
    var moonWrap = moonSet.wrap

    // ⑥ 远山剪影
    el('position:absolute;left:0;right:0;bottom:0;height:32%;opacity:.94;background-repeat:no-repeat;background-position:bottom center;background-size:100% 100%;'
      + 'background-image:url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 1440 200\' preserveAspectRatio=\'none\'><path fill=\'%230b1022\' d=\'M0 200V152l126-24 132 30 138-44 148 36 140-30 152 34 158-26 150 32 152-20 144 24V200Z\'/><path fill=\'%23222a4e\' d=\'M0 200V116l150-34 132 44 156-62 138 48 152-66 152 56 160-38 142 46 158-28 100 22V200Z\'/></svg>");', overlay)

    var ease = 'cubic-bezier(.42,.05,.28,1)'

    // 先落一帧再切主题
    void overlay.offsetWidth
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { play() })
    })

    function play () {
      if (!overlay) return
      applyTheme(toDark)
      nightToast(toDark)

      var starEls = stars.children
      var pathFrames = function (path) {
        return [
          { transform: path[0], offset: 0 },
          { transform: path[1], offset: 0.36 },
          { transform: path[2], offset: 0.70 },
          { transform: path[3], offset: 1 }
        ]
      }
      var travel = function (node, path, dur, delay) {
        return anim(node, pathFrames(path), { duration: dur, delay: delay || 0, easing: 'linear', fill: 'forwards' })
      }

      if (toDark) {
        // 入夜：太阳从左往右落下；月亮从左往右升起
        dawn.style.opacity = '1'
        night.style.opacity = '0'
        horizon.style.opacity = '0'
        sun.style.opacity = '1'
        sunHalo.style.opacity = '1'
        sunWrap.style.transform = SET_PATH[0]
        moonWrap.style.transform = RISE_PATH[0]

        travel(sunWrap, SET_PATH, 640 * k, 0)
        travel(moonWrap, RISE_PATH, 560 * k, 620 * k)
        anim(sun, [{ opacity: 1 }, { opacity: 1, offset: .5 }, { opacity: 0 }],
          { duration: 660 * k, easing: 'ease-in', fill: 'forwards' })
        anim(sunHalo, [{ opacity: 1 }, { opacity: .9, offset: .4 }, { opacity: 0 }],
          { duration: 660 * k, easing: 'ease-in', fill: 'forwards' })
        anim(moon, [{ opacity: 0 }, { opacity: 1 }],
          { duration: 220 * k, delay: 640 * k, easing: 'ease-out', fill: 'forwards' })
        anim(moonHalo, [{ opacity: 0 }, { opacity: 1 }],
          { duration: 260 * k, delay: 640 * k, easing: 'ease-out', fill: 'forwards' })
        anim(night, [{ opacity: 0 }, { opacity: 1 }], { duration: 1200 * k, easing: 'ease-in', fill: 'forwards' })
        anim(dawn, [{ opacity: 1 }, { opacity: .9, offset: .38 }, { opacity: 0 }], { duration: 1200 * k, easing: 'ease-in', fill: 'forwards' })
        anim(horizon, [{ opacity: 0 }, { opacity: 1, offset: .35 }, { opacity: 0 }], { duration: 1100 * k, easing: 'ease-out', fill: 'forwards' })
        for (var s2 = 0; s2 < starEls.length; s2++) {
          anim(starEls[s2], [{ opacity: 0, transform: 'scale(.6)' }, { opacity: 0.5 + Math.random() * 0.5, transform: 'scale(1)' }],
            { duration: 760 * k, delay: (360 + s2 * 11) * k, easing: 'ease-out', fill: 'forwards' })
        }
      } else {
        // 破晓：月亮从左往右落下；太阳从左往右升起
        dawn.style.opacity = '0'
        night.style.opacity = '1'
        horizon.style.opacity = '0'
        sunWrap.style.transform = RISE_PATH[0]
        moonWrap.style.transform = SET_PATH[0]
        sun.style.opacity = '0'
        sunHalo.style.opacity = '0'
        moon.style.opacity = '1'
        moonHalo.style.opacity = '1'

        travel(moonWrap, SET_PATH, 640 * k, 0)
        travel(sunWrap, RISE_PATH, 560 * k, 620 * k)
        anim(moon, [{ opacity: 1 }, { opacity: 1, offset: .5 }, { opacity: 0 }],
          { duration: 660 * k, easing: 'ease-in', fill: 'forwards' })
        anim(moonHalo, [{ opacity: 1 }, { opacity: .9, offset: .4 }, { opacity: 0 }],
          { duration: 660 * k, easing: 'ease-in', fill: 'forwards' })
        anim(sun, [{ opacity: 0 }, { opacity: 1 }],
          { duration: 220 * k, delay: 640 * k, easing: 'ease-out', fill: 'forwards' })
        anim(sunHalo, [{ opacity: 0 }, { opacity: .95 }],
          { duration: 260 * k, delay: 640 * k, easing: 'ease-out', fill: 'forwards' })
        anim(horizon, [{ opacity: 0 }, { opacity: .95, offset: .45 }, { opacity: .55 }],
          { duration: 1200 * k, easing: 'ease-out', fill: 'forwards' })
        anim(dawn, [{ opacity: 0 }, { opacity: 1 }], { duration: 1100 * k, delay: 200 * k, easing: 'ease-out', fill: 'forwards' })
        anim(night, [{ opacity: 1 }, { opacity: 0 }], { duration: 1150 * k, easing: 'ease-in-out', fill: 'forwards' })
        for (var q = 0; q < starEls.length; q++) {
          starEls[q].style.opacity = '0.85'
          anim(starEls[q], [{ opacity: 0.85 }, { opacity: 0 }], { duration: 520 * k, delay: q * 6 * k, easing: 'ease-in', fill: 'forwards' })
        }
      }

      if (flourish) {
        var meteor = el('position:absolute;left:0;top:0;width:2px;height:2px;border-radius:50%;background:#fff;opacity:0;box-shadow:0 0 10px 2px rgba(255,255,255,.7);', overlay)
        anim(meteor, [
          { opacity: 0, transform: 'translate(18vw,6vh)' },
          { opacity: 1, offset: .25 },
          { opacity: 0, transform: 'translate(56vw,34vh)' }
        ], { duration: 700 * k, delay: 620 * k, easing: 'ease-out', fill: 'forwards' })
      }
    }

    // 揭幕：从点击点向外扩张的圆形遮罩
    revealTimer = window.setTimeout(function () {
      if (my !== runGen || !overlay) return
      if (document.hidden) { finishReveal(); return }
      var x = pt.x, y = pt.y
      var maxR = Math.round(Math.sqrt(window.innerWidth * window.innerWidth + window.innerHeight * window.innerHeight))
      var start = 0
      function frame (now) {
        if (my !== runGen || !overlay) return
        if (!start) start = now
        var p = Math.min(1, (now - start) / Math.max(1, reveal))
        var e = 1 - Math.pow(1 - p, 3)
        var r = Math.round(e * maxR)
        var mask = 'radial-gradient(circle ' + r + 'px at ' + x + 'px ' + y + 'px, transparent 97%, #000 100%)'
        overlay.style.webkitMaskImage = mask
        overlay.style.maskImage = mask
        if (p < 1) revealRAF = requestAnimationFrame(frame)
        else finishReveal(my)
      }
      revealRAF = requestAnimationFrame(frame)
    }, Math.round(revealAt))

    // 兜底：rAF 被节流（切标签页/后台/低电量）时也要收尾，避免遮罩停在半路
    finishTimer = window.setTimeout(function () { finishReveal(my) }, Math.round(revealAt + reveal + 260))
    // 最外层保险（必须可被 cleanup 取消，否则上一轮的定时器会掐断下一轮动画）
    overlayGuard = window.setTimeout(function () { if (my === runGen && overlay) finishReveal(my) }, Math.round(total) + 1200)
  }

  /**
   * 图形切换（旧版）：插入 .Cuteen_DarkSky / .Cuteen_DarkPlanet，
   * 转盘动画与日月由主题的 _layout/sun_moon.styl 提供；
   * 1000ms 时日月透明度互换，2000ms 后整块淡出移除。
   */
  function runCuteen (my, toDark, t) {
    var k = (reduced() ? 0.45 : 1) * (t === 'light' ? 0.75 : 1)

    var sky = document.createElement('div')
    sky.className = 'Cuteen_DarkSky'
    var planet = document.createElement('div')
    planet.className = 'Cuteen_DarkPlanet'
    // 转盘一圈时长由自定义属性驱动（custom.css 里 !important 的动画也会读它）
    sky.style.setProperty('--hg-cut-dur', (1000 * k) + 'ms')
    var sun = document.createElement('div')
    sun.id = 'sun'
    sun.style.transition = 'opacity .45s ease'
    sun.style.opacity = toDark ? '1' : '0'
    var moon = document.createElement('div')
    moon.id = 'moon'
    moon.style.transition = 'opacity .45s ease'
    moon.style.opacity = toDark ? '0' : '1'
    planet.appendChild(sun)
    planet.appendChild(moon)
    sky.appendChild(planet)
    document.body.appendChild(sky)
    overlay = sky

    // 先落一帧，让 :before 的 2s 过渡从「浅色」起步
    void sky.offsetWidth
    applyTheme(toDark)
    nightToast(toDark)

    // 1000ms：日月互换（复用 cleanup 会清的定时器槽位）
    revealTimer = window.setTimeout(function () {
      if (my !== runGen) return
      sun.style.opacity = toDark ? '0' : '1'
      moon.style.opacity = toDark ? '1' : '0'
    }, Math.round(500 * k))

    // 半圈后：整块淡出
    finishTimer = window.setTimeout(function () {
      if (my !== runGen) return
      sky.style.transition = 'opacity .5s ease'
      sky.style.opacity = '0'
    }, Math.round(1000 * k))

    // 收尾移除
    cleanupTimer = window.setTimeout(function () {
      if (my !== runGen) return
      cleanup()
    }, Math.round(1000 * k) + 620)

    // 保险：动画被节流/中间出错时也要复位
    overlayGuard = window.setTimeout(function () {
      if (my === runGen && overlay) cleanup()
    }, Math.round(1000 * k) + 2200)
  }

  function bind () {
    var nodes = document.querySelectorAll('#nightmode-button, .sun_moon, .icon-V')
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i]
      if (n.getAttribute('data-dm-bound') === '1') continue
      if (n.hasAttribute('onclick') && n.parentNode) {
        // 克隆替换：把主题写死的内联 onclick 彻底丢掉，杜绝双触发
        var c = n.cloneNode(true)
        c.removeAttribute('onclick')
        n.parentNode.replaceChild(c, n)
        n = c
      }
      n.setAttribute('data-dm-bound', '1')
      n.addEventListener('click', function (e) {
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation()
        run()
        return false
      }, true)
    }
  }

  document.addEventListener('pointerdown', function (e) {
    window.__dmPoint = { x: Math.round(e.clientX), y: Math.round(e.clientY) }
  }, true)

  document.addEventListener('visibilitychange', function () {
    if (document.hidden && overlay) finishReveal(runGen)
  })
  window.addEventListener('pagehide', cleanup)
  document.addEventListener('pjax:complete', function () { cleanup(); bind() })
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind)
  else bind()

  // 占住全局函数：主题的 sun_moon.js（async 加载）会重新声明 switchNightMode，
  // 用访问器把赋值吞掉，保证任何调用（导航按钮/右键菜单/侧边栏/美化面板）都走这里
  try {
    Object.defineProperty(window, 'switchNightMode', {
      configurable: true,
      get: function () { return run },
      set: function () {}
    })
  } catch (e) {
    window.switchNightMode = run
  }
  window.setTimeout(function () { try { if (window.switchNightMode !== run) window.switchNightMode = run } catch (e) {} }, 400)
  window.setTimeout(function () { try { if (window.switchNightMode !== run) window.switchNightMode = run } catch (e) {} }, 1500)
})()

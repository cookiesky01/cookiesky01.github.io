/*!
 * 低性能模式（perf-lite）
 * 作用：一键关掉毛玻璃、固定背景、星空/丝线 canvas 等最吃 GPU 的效果
 * 入口：美化设置面板「性能模式」开关、URL ?perf=1 / ?perf=0、帧率过低时自动开启
 * 存储：localStorage.perfLite（'on' | 'off' | 'auto'）
 */
(function () {
  'use strict'

  var KEY = 'perfLite'
  var root = document.documentElement
  var toastShown = false

  function state () {
    try { return localStorage.getItem(KEY) || '' } catch (e) { return '' }
  }

  function save (v) {
    try { localStorage.setItem(KEY, v) } catch (e) {}
  }

  function isOn () { return root.classList.contains('perf-lite') }

  function apply (on) {
    root.classList.toggle('perf-lite', !!on)
    document.dispatchEvent(new CustomEvent('perf-lite-change', { detail: { on: !!on } }))
  }

  function toast (title, msg) {
    if (toastShown) return
    toastShown = true
    if (window.fomalNotify) {
      window.fomalNotify({ title: title, message: msg || '', position: 'top-left', offset: 50, showClose: true, type: 'info', duration: 4200 })
    }
  }

  /* 对外接口 */
  window.perfLite = function (on, remember) {
    apply(on)
    if (remember !== false) save(on ? 'on' : 'off')
    return on
  }
  window.perfToggle = function () { return window.perfLite(!isOn()) }

  /* 1. URL 参数优先 */
  var q = location.search
  if (/[?&]perf=1(\b|&|$)/.test(q)) { apply(true); save('on') }
  else if (/[?&]perf=0(\b|&|$)/.test(q)) { apply(false); save('off') }
  else if (state() === 'on') apply(true)

  /* 2. 帧率探测：连续 2.4s 平均低于 42fps 就自动开一次（只自动开，不自动关） */
  function probe () {
    if (state() === 'on' || state() === 'off') return
    if (document.hidden) return
    var frames = 0
    var t0 = performance.now()
    var t1 = t0
    function tick (now) {
      frames++
      t1 = now
      if (now - t0 < 2400) { requestAnimationFrame(tick); return }
      var fps = frames * 1000 / (t1 - t0)
      if (fps < 42) {
        apply(true)
        save('auto')
        toast('已启用性能模式', '检测到帧率偏低（约 ' + Math.round(fps) + ' fps），已关闭毛玻璃与背景动画，可在美化设置里改回')
      }
    }
    requestAnimationFrame(tick)
  }

  if (document.readyState === 'complete') setTimeout(probe, 1800)
  else window.addEventListener('load', function () { setTimeout(probe, 1800) })

  /* 3. pjax 切页后重新探测（仅当用户没手动设定过） */
  document.addEventListener('pjax:complete', function () {
    if (state() === 'on') apply(true)
    else if (state() === '') setTimeout(probe, 1500)
  })
})();

/* 低性能模式时顺手把 body 下的装饰 canvas 藏掉（universe / canvas-nest 都算） */
(function () {
  var css = 'html.perf-lite body > canvas{display:none !important}'
  var st = document.createElement('style')
  st.textContent = css
  document.head.appendChild(st)
})();

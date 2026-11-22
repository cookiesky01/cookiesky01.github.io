/* 星空（#universe）：暗色主题 + 可见 + 非性能模式下才绘制。
   与旧版相比只改了调度：不可见时彻底退出 rAF，重绘限到 30fps；视觉参数原样保留。
   「星空特效」开关通过 html.hg-universe-off 让画布 display:none，本文件的可见性判断会停掉循环。 */
(function () {
  'use strict'

  var canvas = document.getElementById('universe')
  if (!canvas || !canvas.getContext) return
  var root = document.documentElement
  var perf = window.requestAnimationFrame || function (cb) { return window.setTimeout(cb, 1000 / 60) }
  var ctx = canvas.getContext('2d')
  var stars = []
  var width = 0, height = 0
  var running = false, startLoop = null
  var lastDraw = -1e9
  var INTERVAL = 1000 / 30
  var GIANT = '180,184,240'
  var NORMAL = '226,225,142'
  var COMET = '226,225,224'
  var first = 0

  function random (min, max) { return Math.random() * (max - min) + min }
  function chance (percent) { return Math.floor(1000 * Math.random()) + 1 < 10 * percent }

  function Star () {
    this.reset = function () {
      this.giant = chance(3)
      this.comet = !this.giant && first > 3 && chance(10)
      this.x = random(0, width - 10)
      this.y = random(0, height)
      this.r = random(1.1, 2.6)
      this.dx = random(0.05, 0.3) + (this.comet ? 0.05 * random(50, 120) : 0) + 0.1
      this.dy = -random(0.05, 0.3) - (this.comet ? 0.05 * random(50, 120) : 0)
      this.fadingOut = null
      this.fadingIn = true
      this.opacity = 0
      this.opacityTresh = random(0.2, 1 - (this.comet ? 0.4 : 0))
      this.do = random(0.0005, 0.002) + (this.comet ? 0.001 : 0)
    }
    this.fadeIn = function () {
      if (!this.fadingIn) return
      this.fadingIn = !(this.opacity > this.opacityTresh)
      this.opacity += this.do
    }
    this.fadeOut = function () {
      if (!this.fadingOut) return
      this.fadingOut = !(this.opacity < 0)
      this.opacity -= this.do / 2
      if (this.x > width || this.y < 0) {
        this.fadingOut = false
        this.reset()
      }
    }
    this.draw = function () {
      ctx.beginPath()
      if (this.giant) {
        ctx.fillStyle = 'rgba(' + GIANT + ',' + this.opacity + ')'
        ctx.arc(this.x, this.y, 2, 0, 2 * Math.PI, false)
      } else if (this.comet) {
        ctx.fillStyle = 'rgba(' + COMET + ',' + this.opacity + ')'
        ctx.arc(this.x, this.y, 1.5, 0, 2 * Math.PI, false)
        for (var i = 0; i < 30; i++) {
          ctx.fillStyle = 'rgba(' + COMET + ',' + (this.opacity - this.opacity / 20 * i) + ')'
          ctx.rect(this.x - this.dx / 4 * i, this.y - this.dy / 4 * i - 2, 2, 2)
          ctx.fill()
        }
      } else {
        ctx.fillStyle = 'rgba(' + NORMAL + ',' + this.opacity + ')'
        ctx.rect(this.x, this.y, this.r, this.r)
      }
      ctx.closePath()
      ctx.fill()
    }
    this.move = function () {
      this.x += this.dx
      this.y += this.dy
      if (this.fadingOut === false) this.reset()
      if (this.x > width - width / 4 || this.y < 0) this.fadingOut = true
    }
  }

  function measure () {
    width = window.innerWidth
    height = window.innerHeight
    canvas.setAttribute('width', width)
    canvas.setAttribute('height', height)
  }

  function draw () {
    ctx.clearRect(0, 0, width, height)
    for (var i = 0; i < stars.length; i++) {
      var star = stars[i]
      star.move()
      star.fadeIn()
      star.fadeOut()
      star.draw()
    }
  }

  function visible () {
    if (root.getAttribute('data-theme') !== 'dark') return false
    if (root.classList.contains('perf-lite') || root.classList.contains('hg-universe-off')) return false
    return window.getComputedStyle(canvas).display !== 'none'
  }

  function loop (time) {
    if (!visible()) { running = false; return }
    running = true
    var now = typeof time === 'number' ? time : performance.now()
    if (now - lastDraw >= INTERVAL) {
      lastDraw = now
      draw()
    }
    perf(loop)
  }

  function invalidate () {
    if (!running && startLoop) startLoop()
  }

  function setup () {
    measure()
    stars = []
    var count = Math.max(24, Math.floor(0.216 * width))
    for (var i = 0; i < count; i++) {
      var star = new Star()
      star.reset()
      stars.push(star)
    }
    window.setTimeout(function () { first = 9 }, 120)
    if (!running) loop()
  }

  startLoop = loop
  setup()
  window.addEventListener('resize', function () {
    measure()
    invalidate()
  }, false)
  new MutationObserver(invalidate).observe(root, { attributes: true, attributeFilter: ['data-theme', 'class', 'style'] })
  new MutationObserver(invalidate).observe(canvas, { attributes: true, attributeFilter: ['style', 'class'] })
  document.addEventListener('pjax:complete', invalidate)
})()
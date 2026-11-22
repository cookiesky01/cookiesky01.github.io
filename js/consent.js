/*!
 * Cookie / 第三方服务同意弹窗
 * 首次访问时询问：全部接受、接受部分、不接受；关闭窗口或继续浏览视为同意全部。
 * 统计（不蒜子）与评论（Twikoo）按选择门控；必要存储始终用于记住偏好与本次选择。
 * 存储键：hgConsent = {"v":1,"analytics":true,"comments":true,"ts":...}
 */
(function (w, d) {
  'use strict'
  if (w.hgConsent) return

  var KEY = 'hgConsent'
  var BUSUANZI = 'https://cdn.busuanzi.cc/busuanzi/3.6.9/busuanzi.min.js'
  var root = d.documentElement
  var box = null
  var partial = false

  function read () {
    try {
      var raw = w.localStorage.getItem(KEY)
      if (!raw) return null
      var v = JSON.parse(raw)
      if (!v || v.v !== 1) return null
      return { analytics: v.analytics === true, comments: v.comments === true }
    } catch (e) { return null }
  }

  function save (state) {
    try {
      w.localStorage.setItem(KEY, JSON.stringify({ v: 1, analytics: !!state.analytics, comments: !!state.comments, ts: Date.now() }))
    } catch (e) {}
  }

  function loadBusuanzi () {
    if (w.__hgBszLoaded) return
    w.__hgBszLoaded = true
    var s = d.createElement('script')
    s.async = true
    s.src = BUSUANZI
    ;(d.body || d.head).appendChild(s)
  }

  function stripComments () {
    var ids = ['post-comment', 'to_comment', 'newest-comments']
    for (var i = 0; i < ids.length; i++) {
      var node = d.getElementById(ids[i])
      if (node && node.parentNode) node.parentNode.removeChild(node)
    }
  }

  function apply (state) {
    var hadNoComments = root.classList.contains('hg-no-comments')
    root.classList.toggle('hg-no-analytics', !state.analytics)
    root.classList.toggle('hg-no-comments', !state.comments)
    if (state.analytics) loadBusuanzi()
    if (state.comments) {
      /* 拒绝时评论 DOM 已被移除；改成允许需要重新加载评论区 */
      if (hadNoComments && d.getElementById('post-comment') === null) {
        w.setTimeout(function () { w.location.reload() }, 60)
        return
      }
    } else {
      stripComments()
    }
  }

  function styles () {
    if (d.getElementById('hg-consent-style')) return
    var css = '' +
      '.hg-consent{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(15,18,22,.46);-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px)}' +
      '.hg-consent-card{position:relative;width:min(540px,100%);max-height:calc(100vh - 40px);overflow:auto;box-sizing:border-box;padding:26px 26px 18px;border-radius:18px;background:var(--card-bg,#fff);color:var(--font-color,#4c4948);box-shadow:0 18px 60px rgba(0,0,0,.28)}' +
      '.hg-consent-card h2{margin:0 0 10px;font-size:1.25em;line-height:1.4;color:var(--text-highlight-color,#1f2d3d)}' +
      '.hg-consent-card h2 i{color:var(--theme-color,#49b1f5);margin-right:8px}' +
      '.hg-consent-card p{margin:0 0 12px;line-height:1.75;font-size:.94em}' +
      '.hg-consent-list{margin:0 0 16px;padding:0;list-style:none;font-size:.9em;line-height:1.7}' +
      '.hg-consent-list li{padding-left:18px;position:relative}' +
      '.hg-consent-list li::before{content:"";position:absolute;left:4px;top:.62em;width:6px;height:6px;border-radius:50%;background:var(--theme-color,#49b1f5)}' +
      '.hg-consent-actions{display:flex;flex-wrap:wrap;gap:10px;margin:6px 0 10px}' +
      '.hg-consent-actions button,.hg-consent-partial button{flex:1;min-width:120px;padding:10px 14px;border-radius:10px;border:1px solid transparent;font-size:.94em;font-weight:600;line-height:1.4;cursor:pointer;transition:all .2s}' +
      '.hg-consent-actions .hg-c-ok{background:var(--theme-color,#49b1f5);color:var(--on-theme,#fff)}' +
      '.hg-consent-actions .hg-c-part{background:color-mix(in srgb,var(--theme-color,#49b1f5) 14%,transparent);color:var(--theme-color,#49b1f5);border-color:color-mix(in srgb,var(--theme-color,#49b1f5) 46%,transparent)}' +
      '.hg-consent-actions .hg-c-no{background:transparent;color:var(--font-color,#4c4948);border-color:color-mix(in srgb,var(--font-color,#4c4948) 26%,transparent)}' +
      '.hg-consent-actions button:hover,.hg-consent-partial button:hover{transform:translateY(-1px);filter:brightness(1.04)}' +
      '.hg-consent-note{margin:0;font-size:.8em;line-height:1.6;opacity:.72}' +
      '.hg-consent-x{position:absolute;top:10px;right:12px;width:32px;height:32px;border:0;border-radius:50%;background:transparent;color:inherit;font-size:22px;line-height:1;cursor:pointer;opacity:.7}' +
      '.hg-consent-x:hover{opacity:1;background:color-mix(in srgb,var(--font-color,#4c4948) 8%,transparent)}' +
      '.hg-consent-partial{margin-top:4px}' +
      '.hg-consent-partial label{display:flex;align-items:flex-start;gap:10px;padding:10px 12px;margin-bottom:10px;border-radius:10px;background:color-mix(in srgb,var(--font-color,#4c4948) 5%,transparent);cursor:pointer;font-size:.92em;line-height:1.5}' +
      '.hg-consent-partial label input{margin-top:.25em;accent-color:var(--theme-color,#49b1f5)}' +
      '.hg-consent-partial small{display:block;opacity:.7;font-size:.88em}' +
      '.hg-consent-partial .hg-c-row{display:flex;gap:10px}' +
      'html.hg-no-analytics [id^="busuanzi"],html.hg-no-analytics .busuanzi{display:none!important}' +
      'html.hg-no-comments #post-comment,html.hg-no-comments #to_comment,html.hg-no-comments .comment-wrap{display:none!important}' +
      '@media (max-width:480px){.hg-consent{padding:12px}.hg-consent-card{padding:22px 18px 14px}.hg-consent-actions button{min-width:0;flex:1 1 100%}}'
    var style = d.createElement('style')
    style.id = 'hg-consent-style'
    style.textContent = css
    d.head.appendChild(style)
  }

  function close () {
    if (box && box.parentNode) box.parentNode.removeChild(box)
    box = null
    partial = false
  }

  function decide (state) {
    save(state)
    close()
    apply(state)
    try {
      d.dispatchEvent(new w.CustomEvent('hg-consent-change', { detail: state }))
    } catch (e) {}
    if (w.fomalNotify) {
      w.fomalNotify({ title: '已保存 Cookie 选择', message: state.analytics || state.comments ? '可在美化设置里重新调整' : '仅保留必要的本地偏好', type: 'success', position: 'top-left', offset: 50, duration: 2200 })
    }
  }

  function mainView (current) {
    var all = current ? (current.analytics && current.comments) : false
    return '<h2 id="hg-consent-title"><i class="fas fa-cookie-bite"></i>Cookie 与第三方服务</h2>' +
      '<p>本站用 Cookie 和浏览器本地存储记住你的偏好（比如深浅色），也会借助第三方服务统计访问量、显示大致来访地区。</p>' +
      '<ul class="hg-consent-list">' +
        '<li>必要存储：记住外观偏好与这次选择，始终启用。</li>' +
        '<li>访问统计：不蒜子，用于站点访问量计数；拒绝后不会加载。</li>' +
        '<li>评论：Twikoo；拒绝后评论区不显示、不加载。</li>' +
      '</ul>' +
      '<div class="hg-consent-actions" role="group" aria-label="Cookie 选择">' +
        '<button type="button" class="hg-c-ok" data-consent="all">' + (all ? '保持全部接受' : '全部接受') + '</button>' +
        '<button type="button" class="hg-c-part" data-consent="partial">接受部分</button>' +
        '<button type="button" class="hg-c-no" data-consent="none">不接受</button>' +
      '</div>' +
      '<p class="hg-consent-note">继续浏览（关闭此窗口）视为同意全部；之后可在「美化设置 → 布局与部件 → Cookie 与隐私」里重新选择。</p>'
  }

  function partialView (current) {
    var a = current ? current.analytics : true
    var c = current ? current.comments : true
    return '<h2 id="hg-consent-title"><i class="fas fa-sliders"></i>选择允许的服务</h2>' +
      '<div class="hg-consent-partial">' +
        '<label><input type="checkbox" id="hg-consent-analytics"' + (a ? ' checked' : '') + '><span>访问统计<small>不蒜子：站点与文章浏览量计数</small></span></label>' +
        '<label><input type="checkbox" id="hg-consent-comments"' + (c ? ' checked' : '') + '><span>评论<small>Twikoo：文章评论区；不勾选则完全不加载</small></span></label>' +
        '<p class="hg-consent-note">必要存储始终启用，用于记住外观偏好与这次的 Cookie 选择。</p>' +
        '<div class="hg-c-row">' +
          '<button type="button" class="hg-c-part" data-consent="back">返回</button>' +
          '<button type="button" class="hg-c-ok" data-consent="save">保存选择</button>' +
        '</div>' +
      '</div>'
  }

  function render (current) {
    styles()
    if (!box) {
      box = d.createElement('div')
      box.className = 'hg-consent'
      box.setAttribute('role', 'dialog')
      box.setAttribute('aria-modal', 'true')
      box.setAttribute('aria-labelledby', 'hg-consent-title')
      box.innerHTML = '<div class="hg-consent-card">' +
        '<button type="button" class="hg-consent-x" data-consent="all" aria-label="继续浏览（视为同意全部）" title="继续浏览（视为同意全部）">×</button>' +
        '<div class="hg-consent-body"></div>' +
      '</div>'
      d.body.appendChild(box)
      box.addEventListener('click', function (event) {
        if (event.target === box) decide({ analytics: true, comments: true })
      })
      box.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') { event.preventDefault(); decide({ analytics: true, comments: true }) }
      })
    }
    var body = box.querySelector('.hg-consent-body')
    body.innerHTML = partial ? partialView(current) : mainView(current)
    var first = body.querySelector('button')
    if (first) first.focus()
  }

  function open () {
    var current = read()
    partial = false
    render(current)
  }

  function onClick (event) {
    var button = event.target.closest ? event.target.closest('[data-consent]') : null
    if (!button || !box || !box.contains(button)) return
    var action = button.getAttribute('data-consent')
    var current = read()
    if (action === 'all') decide({ analytics: true, comments: true })
    else if (action === 'none') decide({ analytics: false, comments: false })
    else if (action === 'partial') { partial = true; render(current) }
    else if (action === 'back') { partial = false; render(current) }
    else if (action === 'save') {
      var a = d.getElementById('hg-consent-analytics')
      var c = d.getElementById('hg-consent-comments')
      decide({ analytics: !!(a && a.checked), comments: !!(c && c.checked) })
    }
  }

  function refresh () {
    var state = read()
    if (state) {
      apply(state)
      if (!state.comments) stripComments()
    }
  }

  w.hgConsent = {
    read: read,
    granted: function (kind) { var s = read(); return !!(s && s[kind]) },
    open: open,
    refresh: refresh
  }
  w.hgOpenConsent = open

  if (d.readyState === 'loading') {
    d.addEventListener('DOMContentLoaded', function () {
      styles()
      if (!read()) open()
      refresh()
    }, { once: true })
  } else {
    styles()
    if (!read()) open()
    refresh()
  }
  d.addEventListener('click', onClick, true)
  ;['pjax:complete', 'pjax:success', 'pjax:end'].forEach(function (ev) {
    d.addEventListener(ev, refresh)
  })
})(window, document)
/*!
 * 美化设置 · 字体
 * 正文字体 / 代码字体两套目录，全部走本地 /font，不请求第三方 CDN。
 * 选中后写 --hg-text-font / --hg-code-font，并记住键名；首屏由 boot.js 提前应用。
 */
(function (w, d) {
  'use strict'
  if (w.HG_FONTS) { w.HG_FONTS.sync(); return }

  var B = w.HGBeauty || {}
  var K = B.keys || {}
  var SAMPLE = '清风翻书，阅读让世界更清晰。The quick brown fox jumps over the lazy dog. 0123456789'
  var CODE_SAMPLE = 'const greeting = "Hello, 世界";\nfunction beauty(theme) {\n  return `theme: ${theme}`;\n}'

  var TEXT_FONTS = [
    { key: 'myfont', name: '霞鹜文楷', note: '温润文楷 · 默认', group: 'reading' },
    { key: 'LXGWNeoXiHei', name: '霞鹜新晰黑', note: '清晰黑体 · 技术文章', group: 'reading' },
    { key: 'SourceHanSerif', name: '思源宋体', note: '书卷气 · 长文阅读', group: 'reading' },
    { key: 'default', name: '系统默认', note: '无需下载 · 跟随设备', group: 'reading' },
    { key: 'ZhuZiAWan', name: '筑紫A丸', note: '圆润可爱 · 短句', group: 'decorative' },
    { key: 'HYTMR', name: '汉仪唐美人', note: '个性书写 · 标题', group: 'decorative' },
    { key: 'TTQHB', name: '甜甜圈海报', note: '装饰字体 · 标题', group: 'decorative' },
    { key: 'MiSans', name: 'MiSans', note: '现代无衬线 · 界面', group: 'decorative' }
  ]

  var CODE_FONTS = [
    { key: 'Consolas', name: 'Consolas', note: '清晰紧凑 · 默认' },
    { key: 'SourceCodePro', name: 'Source Code Pro', note: '经典等宽' },
    { key: 'MapleMono', name: 'Maple Mono', note: '柔和圆润 · 等宽' },
    { key: 'JetBrainsMono', name: 'JetBrains Mono', note: '辨识度优先 · 等宽' },
    { key: 'Monaco', name: 'Monaco', note: '系统等宽 · 经典' }
  ]

  var SYSTEM = { default: 1, Monaco: 1, Consolas: 1 }
  var state = { loading: '', token: 0 }

  function textStack (key) {
    return B.textStack ? B.textStack(key) : 'myfont, -apple-system, sans-serif'
  }
  function codeStack (key) {
    return B.codeStack ? B.codeStack(key) : 'Consolas, monospace'
  }
  function read (key, dv) {
    try {
      var v = w.localStorage.getItem(key)
      return v === null ? dv : v
    } catch (e) { return dv }
  }
  function write (key, value) {
    try { w.localStorage.setItem(key, value) } catch (e) {}
  }
  function meta (list, key) {
    for (var i = 0; i < list.length; i++) if (list[i].key === key) return list[i]
    return list[0]
  }

  function apply (kind, key, persist) {
    var list = kind === 'code' ? CODE_FONTS : TEXT_FONTS
    var item = meta(list, key)
    var stack = kind === 'code' ? codeStack(item.key) : textStack(item.key)
    d.documentElement.style.setProperty(kind === 'code' ? '--hg-code-font' : '--hg-text-font', stack)
    if (persist) write(kind === 'code' ? K.codeFont : K.textFont, item.key)
    state[kind === 'code' ? 'code' : 'text'] = item.key
    syncControls(kind)
    return item
  }

  function load (key) {
    if (SYSTEM[key] || !d.fonts || typeof d.fonts.load !== 'function') return Promise.resolve(true)
    var token = ++state.token
    state.loading = key
    var timer = null
    return Promise.race([
      d.fonts.load('16px "' + key + '"', SAMPLE).then(function (faces) {
        return faces && faces.length > 0
      }).catch(function () { return false }),
      new Promise(function (resolve) {
        timer = w.setTimeout(function () { resolve(false) }, 9000)
      })
    ]).then(function (ok) {
      if (timer) w.clearTimeout(timer)
      if (token !== state.token && state.loading !== key) return ok
      state.loading = ''
      return ok
    })
  }

  function preview (kind) {
    var text = d.getElementById('ap-text-sample')
    var code = d.getElementById('ap-code-sample')
    if (text) text.style.fontFamily = kind === 'text' ? textStack(state.text) : ''
    if (code) code.style.fontFamily = kind === 'code' ? codeStack(state.code) : ''
  }

  function syncControls (kind) {
    var textKey = state.text || read(K.textFont, 'myfont')
    var codeKey = state.code || read(K.codeFont, 'Consolas')
    var boxes = d.querySelectorAll('[data-font]')
    for (var i = 0; i < boxes.length; i++) {
      boxes[i].setAttribute('aria-pressed', boxes[i].getAttribute('data-font') === textKey ? 'true' : 'false')
    }
    var codeBoxes = d.querySelectorAll('[data-code-font]')
    for (var j = 0; j < codeBoxes.length; j++) {
      codeBoxes[j].setAttribute('aria-pressed', codeBoxes[j].getAttribute('data-code-font') === codeKey ? 'true' : 'false')
    }
    var textMeta = meta(TEXT_FONTS, textKey)
    var codeMeta = meta(CODE_FONTS, codeKey)
    var textCurrent = d.getElementById('ap-font-current')
    var codeCurrent = d.getElementById('ap-code-current')
    var textStatus = d.getElementById('ap-font-status')
    var codeStatus = d.getElementById('ap-code-status')
    if (textCurrent) textCurrent.textContent = '当前正文：' + textMeta.name + '（' + textMeta.note + '）'
    if (codeCurrent) codeCurrent.textContent = '当前代码：' + codeMeta.name + '（' + codeMeta.note + '）'
    if (textStatus && state.loading !== textKey) textStatus.textContent = '已应用：' + textMeta.name
    if (codeStatus && state.loading !== codeKey) codeStatus.textContent = '已应用：' + codeMeta.name
    preview('text')
    preview('code')
  }

  function choose (kind, key) {
    if (state.loading) return
    var list = kind === 'code' ? CODE_FONTS : TEXT_FONTS
    var item = meta(list, key)
    var status = d.getElementById(kind === 'code' ? 'ap-code-status' : 'ap-font-status')
    if (status) {
      status.removeAttribute('data-state')
      status.textContent = '正在加载「' + item.name + '」…'
    }
    load(item.key).then(function (ok) {
      if (!ok && !SYSTEM[item.key]) {
        if (status) {
          status.setAttribute('data-state', 'error')
          status.textContent = '「' + item.name + '」加载失败，已保留当前字体。'
        }
        return
      }
      apply(kind, item.key, true)
      if (w.fomalNotify) {
        w.fomalNotify({
          title: (kind === 'code' ? '代码字体' : '正文字体') + '已切换为「' + item.name + '」',
          type: 'success', position: 'top-left', offset: 50, duration: 2400
        })
      }
    })
  }

  function reset () {
    state.loading = ''
    apply('text', 'myfont', true)
    apply('code', 'Consolas', true)
    if (w.fomalNotify) w.fomalNotify({ title: '字体已恢复默认', type: 'info', position: 'top-left', offset: 50, duration: 2200 })
  }

  function option (item, kind) {
    var stack = (kind === 'code' ? codeStack(item.key) : textStack(item.key)).replace(/"/g, "'")
    return '<button type="button" class="ap-font-option" data-' + (kind === 'code' ? 'code-font' : 'font') + '="' + item.key + '" aria-pressed="false" onclick="chooseAppearanceFont(\'' + kind + '\',\'' + item.key + '\')">' +
      '<span class="ap-font-name" style="font-family:' + stack + '">' + item.name + '</span>' +
      '<small>' + item.note + '</small>' +
      '<i class="fa-solid fa-circle-check ap-check" aria-hidden="true"></i>' +
    '</button>'
  }

  function markup () {
    var reading = TEXT_FONTS.filter(function (f) { return f.group === 'reading' }).map(function (f) { return option(f, 'text') }).join('')
    var decorative = TEXT_FONTS.filter(function (f) { return f.group === 'decorative' }).map(function (f) { return option(f, 'text') }).join('')
    var code = CODE_FONTS.map(function (f) { return option(f, 'code') }).join('')
    return '' +
      '<div class="ap-panel" id="appearance-fonts">' +
        '<div class="ap-section-head">' +
          '<div><p class="ap-eyebrow">字体设置</p><p class="ap-hint">全部字体已放在本站 <code>/font</code> 目录，首次切换时按需加载，不依赖外部 CDN。</p></div>' +
          '<button type="button" class="ap-btn" onclick="resetAppearanceFonts()"><i class="fa-solid fa-rotate-left"></i> 恢复字体默认</button>' +
        '</div>' +
        '<p class="ap-subtitle">阅读字体</p>' +
        '<div class="ap-font-grid" id="swfs">' + reading + '</div>' +
        '<details class="ap-details">' +
          '<summary>个性 / 装饰字体（<span>' + decorative.length + '</span> 款，标题或短句更有味道）</summary>' +
          '<div class="ap-font-grid" id="swfs_decorative">' + decorative + '</div>' +
          '<p class="ap-license ap-hint">装饰字体只建议用在标题、签名等短文本；字体授权以发布方许可为准。</p>' +
        '</details>' +
        '<div class="ap-preview">' +
          '<p class="ap-current" id="ap-font-current">当前正文：霞鹜文楷（温润文楷 · 默认）</p>' +
          '<p class="ap-text-sample" id="ap-text-sample">' + SAMPLE + '</p>' +
          '<p class="ap-status" id="ap-font-status" aria-live="polite">已应用：霞鹜文楷</p>' +
        '</div>' +
        '<details class="ap-details">' +
          '<summary>代码字体</summary>' +
          '<div class="ap-font-grid" id="swfs_code">' + code + '</div>' +
          '<div class="ap-preview">' +
            '<p class="ap-current" id="ap-code-current">当前代码：Consolas（清晰紧凑 · 默认）</p>' +
            '<pre class="ap-code-sample" id="ap-code-sample">' + CODE_SAMPLE + '</pre>' +
            '<p class="ap-status" id="ap-code-status" aria-live="polite">已应用：Consolas</p>' +
          '</div>' +
        '</details>' +
      '</div>'
  }

  function init () {
    state.text = read(K.textFont, 'myfont')
    state.code = read(K.codeFont, 'Consolas')
    apply('text', state.text, false)
    apply('code', state.code, false)
    syncControls()
  }

  w.HG_FONTS = {
    text: TEXT_FONTS,
    code: CODE_FONTS,
    markup: markup,
    init: init,
    sync: syncControls,
    set: function (kind, key) { if (kind === 'code') apply('code', key, true); else apply('text', key, true) },
    reset: reset
  }

  w.chooseAppearanceFont = function (kind, key) { choose(kind === 'code' ? 'code' : 'text', key) }
  w.resetAppearanceFonts = reset

  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', init, { once: true })
  else init()
})(window, document)
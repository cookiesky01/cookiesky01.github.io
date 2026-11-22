/*!
 * 美化设置 · 背景
 * 壁纸 / 颜色 / 自定义 三个页签；所有远程图片先探测再应用，失败保留原背景。
 * 应用方式：html.hg-has-bg + --hg-bg-image，覆盖主题给 #web_bg 写的内联背景。
 */
(function (w, d) {
  'use strict'
  if (w.HG_BACKGROUNDS) { w.HG_BACKGROUNDS.sync(); return }

  var B = w.HGBeauty || {}
  var K = B.keys || {}
  var DEFAULT_THUMB = '/img/bg.webp'
  var state = {
    token: 0,
    pending: null,
    current: 'default',
    status: 'idle',
    message: '选择背景前会先检查图片，加载失败时保留当前背景。',
    retry: null,
    customToken: 0,
    customPending: null,
    draft: null,
    customStatus: 'idle',
    customMessage: '先预览并验证，再应用到全站。',
    rendered: {}
  }

  var CATEGORIES = [
    { id: 'anime', name: '二次元' },
    { id: 'landscape', name: '风景' },
    { id: 'pets', name: '萌宠' },
    { id: 'mobile', name: '手机' }
  ]

  var CATALOG = (function () {
    var list = []
    function local (category, name, file) {
      var url = '/img/background/' + category + '/' + file
      list.push({
        id: category + '-' + (list.filter(function (i) { return i.category === category }).length + 1),
        category: category,
        name: name,
        thumb: '/img/background/' + category + '/' + file.replace(/^[a-z]+-/, 'thumb-'),
        value: 'url(' + url + ')',
        kind: 'image'
      })
    }
    local('anime', '二次元 01', 'anime-01.webp')
    local('anime', '二次元 02', 'anime-02.webp')
    local('anime', '二次元 03', 'anime-03.webp')
    local('anime', '二次元 04', 'anime-04.webp')
    local('landscape', '风景 01', 'landscape-01.webp')
    local('landscape', '风景 02', 'landscape-02.webp')
    local('landscape', '风景 03', 'landscape-03.webp')
    local('landscape', '风景 04', 'landscape-04.webp')
    local('pets', '萌宠 01', 'pets-01.webp')
    local('pets', '萌宠 02', 'pets-02.webp')
    local('pets', '萌宠 03', 'pets-03.webp')
    local('pets', '萌宠 04', 'pets-04.webp')
    local('mobile', '手机 01', 'mobile-01.webp')
    local('mobile', '手机 02', 'mobile-02.webp')
    local('mobile', '手机 03', 'mobile-03.webp')
    local('mobile', '手机 04', 'mobile-04.webp')

    var gradients = [
      ['渐变 01', 'linear-gradient(to right, #544a7d, #ffd452)'],
      ['渐变 02', 'linear-gradient(to bottom, #7f7fd5, #86a8e7, #91eae4)'],
      ['渐变 03', 'linear-gradient(to left, #654ea3, #eaafc8)'],
      ['渐变 04', 'linear-gradient(to top, #feac5e, #c779d0, #4bc0c8)'],
      ['渐变 05', 'linear-gradient(to top, #d3959b, #bfe6ba)'],
      ['渐变 06', 'linear-gradient(to top, #8360c3, #2ebf91)'],
      ['渐变 07', 'linear-gradient(to top, #108dc7, #ef8e38)'],
      ['渐变 08', 'linear-gradient(to top, #355c7d, #6c5b7b, #c06c84)']
    ]
    gradients.forEach(function (g, index) {
      list.push({ id: 'gradient-' + (index + 1), category: 'colors', name: g[0], value: g[1], kind: 'gradient' })
    })
    ;['#ecb1b1', '#d3ebac', '#ace9ce', '#c1ebea', '#dee7f1', '#e9e3f2', '#f7eff5'].forEach(function (hex, index) {
      list.push({ id: 'solid-' + (index + 1), category: 'colors', name: '纯色 0' + (index + 1), value: hex, kind: 'solid' })
    })
    return list
  })()

  var APIS = [
    { id: 'bingDayBg', name: '必应每日壁纸', value: 'url(https://bing.biturl.top/?resolution=1920&format=image&index=0&mkt=zh-CN)' },
    { id: 'bingHistoryBg', name: '必应随机壁纸', value: 'url(https://bing.biturl.top/?resolution=1920&format=image&index=random&mkt=zh-CN)' },
    { id: 'EEEDog', name: '二次元随机', value: 'url(https://www.loliapi.com/acg/pc/)' },
    { id: 'seovx', name: '随机美图', value: 'url(https://moe.jitsu.top/api?sort=pc)' },
    { id: 'picsum', name: 'Picsum 随机', value: 'url(https://picsum.photos/id/1043/1920/1080.webp)' },
    { id: 'waiBizhi', name: '高清壁纸随机', value: 'url(https://www.loliapi.com/bg/)' },
    { id: 'btstu', name: '手机二次元随机', value: 'url(https://t.mwm.moe/mp)' },
    { id: 'unsplash', name: '横屏二次元随机', value: 'url(https://t.mwm.moe/pc)' }
  ]

  function esc (value) {
    return String(value).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    })
  }

  function safeUrl (value) {
    if (typeof value !== 'string' || !value || value.length > 2000 || /[\s"'()\\;{}<>`]/.test(value)) return ''
    if (/^\/img\/background\/[a-z0-9/_-]+\.(?:webp|jpe?g|png)$/i.test(value)) return value
    try {
      var u = new URL(value)
      if (u.protocol !== 'https:' || !u.hostname || u.username || u.password) return ''
      return u.href
    } catch (e) { return '' }
  }

  function parse (value) {
    if (typeof value !== 'string') return null
    value = value.trim()
    if (value === 'default') return { kind: 'default', css: 'default', url: '' }
    if (/^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value)) return { kind: 'solid', css: value.toLowerCase(), url: '' }
    var gradient = CATALOG.some(function (item) { return item.kind === 'gradient' && item.value === value })
    if (gradient) return { kind: 'gradient', css: value, url: '' }
    var match = value.match(/^url\((['"]?)(.*?)\1\)$/)
    var url = safeUrl(match ? match[2] : value)
    return url ? { kind: 'image', css: 'url("' + url + '")', url: url } : null
  }

  function element (id) { return d.getElementById(id) }

  function metadata (value) {
    var parsed = parse(value)
    if (!parsed) return { name: '无效背景', category: '无法解析', kind: 'invalid', url: '', value: value }
    if (parsed.kind === 'default') {
      return { name: '默认背景', category: '站点壁纸 · 随屏幕切换', kind: 'default', url: DEFAULT_THUMB, value: 'default' }
    }
    var item = CATALOG.find(function (entry) {
      var p = parse(entry.value)
      return p && p.css === parsed.css
    })
    if (item) {
      var category = item.kind === 'solid' ? '纯色' : (item.kind === 'gradient' ? '渐变' : (CATEGORIES.find(function (c) { return c.id === item.category }) || {}).name)
      return { id: item.id, name: item.name, category: category, kind: item.kind, url: parsed.url, thumb: item.thumb, value: parsed.css }
    }
    var api = APIS.find(function (entry) {
      var p = parse(entry.value)
      return p && p.css === parsed.css
    })
    if (api) return { id: 'api-' + api.id, name: api.name, category: '动态 API · 刷新可能换图', kind: 'image', url: parsed.url, value: parsed.css }
    return {
      name: parsed.kind === 'solid' ? '自定义纯色 ' + parsed.css : '自定义图片',
      category: parsed.kind === 'solid' ? '纯色' : '自定义 · HTTPS 链接',
      kind: parsed.kind,
      url: parsed.url,
      value: parsed.css
    }
  }

  function apply (value) {
    var parsed = parse(value)
    if (!parsed) return false
    var root = d.documentElement
    if (parsed.kind === 'default') {
      root.classList.remove('hg-has-bg')
      root.style.removeProperty('--hg-bg-image')
    } else {
      var css = B.bgToCss ? B.bgToCss(parsed.css) : parsed.css
      if (!css) return false
      root.style.setProperty('--hg-bg-image', css)
      root.classList.add('hg-has-bg')
    }
    state.current = parsed.kind === 'default' ? 'default' : parsed.css
    return true
  }

  function commit (parsed) {
    if (!apply(parsed.css)) return false
    if (B.set) B.set(K.bg, parsed.kind === 'default' ? 'default' : parsed.css)
    state.status = 'ready'
    state.message = '已应用：' + metadata(parsed.css).name
    state.retry = null
    sync()
    return true
  }

  function probe (url) {
    var token = ++state.token
    state.pending = url
    state.status = 'loading'
    state.message = '正在检查图片…'
    state.retry = null
    sync()
    return new Promise(function (resolve) {
      var image = new Image()
      var timer = null
      var done = false
      function finish (ok) {
        if (done) return
        done = true
        if (timer) w.clearTimeout(timer)
        image.onload = image.onerror = null
        resolve(ok)
      }
      image.referrerPolicy = 'no-referrer'
      image.onload = function () { finish(image.naturalWidth > 0) }
      image.onerror = function () { finish(false) }
      timer = w.setTimeout(function () { finish(false) }, 12000)
      image.src = url
    }).then(function (ok) {
      if (token !== state.token) return false
      state.pending = null
      if (!ok) {
        state.status = 'error'
        state.message = '图片加载失败或超时，当前背景保持不变。'
        state.retry = url
        sync()
        return false
      }
      return true
    })
  }

  function request (value) {
    var parsed = parse(value)
    if (!parsed) {
      state.status = 'error'
      state.message = '背景地址无效：只接受 HTTPS 图片链接、内置渐变或颜色。'
      state.retry = null
      sync()
      return
    }
    if (parsed.kind !== 'image') {
      if (commit(parsed)) notify('背景已更新')
      return
    }
    probe(parsed.url).then(function (ok) {
      if (ok && commit(parsed)) notify('背景已更新')
    })
  }

  function notify (text) {
    if (w.fomalNotify) w.fomalNotify({ title: text, type: 'success', position: 'top-left', offset: 50, duration: 2400 })
  }

  function renderPreview (container, info) {
    if (!container) return
    container.replaceChildren()
    container.style.background = ''
    if (info.url) {
      var image = d.createElement('img')
      image.className = 'ap-bg-thumb'
      image.alt = info.name
      image.loading = 'lazy'
      image.referrerPolicy = 'no-referrer'
      image.src = info.thumb || info.url
      container.appendChild(image)
      container.classList.remove('ap-bg-placeholder')
    } else if (info.kind === 'solid' || info.kind === 'gradient') {
      container.style.background = info.value
      container.classList.remove('ap-bg-placeholder')
    } else {
      container.classList.add('ap-bg-placeholder')
    }
  }

  function itemOption (item) {
    var background = item.kind === 'image' ? 'url("' + item.thumb + '") center / cover no-repeat' : item.value
    return '<button type="button" class="ap-bg-option" data-ap-bg-id="' + esc(item.id) + '" aria-pressed="false" onclick="selectAppearanceBackground(this.dataset.apBgId)">' +
      '<span class="ap-bg-thumb ap-bg-swatch" style="background:' + esc(background) + '" aria-hidden="true"></span>' +
      '<span class="ap-bg-name">' + esc(item.name) + '</span>' +
      '<span class="ap-bg-check" hidden aria-hidden="true"><i class="fa-solid fa-check"></i></span>' +
    '</button>'
  }

  function renderCategory (id) {
    var box = element('ap-bg-category-' + id)
    if (!box) return
    /* 面板关闭会销毁 DOM；重开时新面板还没内容，不能只信 rendered 标记 */
    if (state.rendered[id] && box.childElementCount) return
    box.innerHTML = CATALOG.filter(function (item) { return item.category === id }).map(itemOption).join('')
    state.rendered[id] = true
  }

  function markup () {
    var mainTabs = [['wallpaper', '壁纸'], ['colors', '颜色'], ['custom', '自定义']].map(function (t) {
      return '<button type="button" class="ap-btn" data-ap-bg-main="' + t[0] + '" aria-controls="ap-bg-main-' + t[0] + '" aria-pressed="' + (t[0] === 'wallpaper') + '" onclick="showAppearanceBackgroundTab(this.dataset.apBgMain)">' + t[1] + '</button>'
    }).join('')
    var catTabs = CATEGORIES.map(function (c) {
      return '<button type="button" class="ap-btn" data-ap-bg-category="' + c.id + '" aria-controls="ap-bg-category-' + c.id + '" aria-pressed="' + (c.id === 'anime') + '" onclick="showAppearanceBackgroundCategory(this.dataset.apBgCategory)">' + esc(c.name) + '</button>'
    }).join('')
    var catPanels = CATEGORIES.map(function (c) {
      return '<div id="ap-bg-category-' + c.id + '" class="ap-bg-grid" aria-label="' + esc(c.name) + '壁纸"' + (c.id === 'anime' ? '' : ' hidden') + '></div>'
    }).join('')
    var colors = CATALOG.filter(function (item) { return item.category === 'colors' }).map(itemOption).join('')
    var apis = APIS.map(function (api) {
      return '<button type="button" class="ap-btn" data-ap-bg-id="api-' + api.id + '" aria-pressed="false" onclick="selectAppearanceBackgroundApi(this.dataset.apBgId.slice(4))">' + esc(api.name) + '</button>'
    }).join('')
    return '<section id="ap-background-panel" class="ap-panel ap-background-panel" aria-label="背景设置">' +
      '<div class="ap-bg-current">' +
        '<div id="ap-bg-current-preview" class="ap-bg-thumb ap-bg-placeholder"></div>' +
        '<div><strong id="ap-bg-current-name" class="ap-bg-name">当前背景</strong><p id="ap-bg-current-meta" class="ap-bg-meta"></p></div>' +
        '<button type="button" class="ap-btn" onclick="resetAppearanceBackground()"><i class="fa-solid fa-rotate-left"></i> 恢复默认背景</button>' +
      '</div>' +
      '<p id="ap-bg-status" class="ap-status" role="status" aria-live="polite"></p>' +
      '<button type="button" id="ap-bg-retry" class="ap-btn" onclick="retryAppearanceBackground()" hidden>重试加载</button>' +
      '<div class="ap-tabs" aria-label="背景类型">' + mainTabs + '</div>' +
      '<div id="ap-bg-main-wallpaper">' +
        '<div class="ap-tabs" aria-label="壁纸分类">' + catTabs + '</div>' + catPanels +
        '<details class="ap-bg-advanced"><summary>高级：动态壁纸 API</summary><p class="ap-bg-meta">只在点击后加载。动态链接每次可能返回不同图片，第三方服务也可能暂时不可用。</p><div class="ap-bg-actions">' + apis + '</div></details>' +
      '</div>' +
      '<div id="ap-bg-main-colors" hidden><div class="ap-bg-grid">' + colors + '</div><label class="ap-bg-meta" for="define_colors">自定义纯色</label> <input type="color" id="define_colors" value="#f4d88a" oninput="changeBgColor()" aria-label="自定义背景颜色"></div>' +
      '<div id="ap-bg-main-custom" hidden><label for="pic-link">HTTPS 图片链接</label><input type="url" id="pic-link" maxlength="1000" placeholder="https://example.com/background.webp" oninput="invalidateCustomBackground()" autocomplete="off"><div class="ap-bg-actions"><button type="button" class="ap-btn" onclick="previewCustomBackground()">预览并验证</button><button type="button" class="ap-btn" id="ap-bg-custom-apply" onclick="applyCustomBackground()" disabled>应用到全站</button></div><p id="ap-bg-custom-status" class="ap-status" role="status" aria-live="polite"></p><div id="ap-bg-custom-preview" class="ap-bg-thumb ap-bg-placeholder"></div></div>' +
    '</section>'
  }

  function sync () {
    renderCategory('anime')
    var info = metadata(state.current)
    var current = element('ap-bg-current-name')
    var meta = element('ap-bg-current-meta')
    var status = element('ap-bg-status')
    var retry = element('ap-bg-retry')
    if (current) current.textContent = info.name
    if (meta) meta.textContent = info.category
    renderPreview(element('ap-bg-current-preview'), info)
    if (status) {
      status.textContent = state.message
      if (state.status === 'error') status.setAttribute('data-state', 'error')
      else status.removeAttribute('data-state')
    }
    if (retry) retry.hidden = !state.retry
    var options = d.querySelectorAll('[data-ap-bg-id]')
    for (var i = 0; i < options.length; i++) {
      options[i].setAttribute('aria-pressed', options[i].getAttribute('data-ap-bg-id') === (info.id || '') ? 'true' : 'false')
      var check = options[i].querySelector('.ap-bg-check')
      if (check) check.hidden = options[i].getAttribute('aria-pressed') !== 'true' || !info.id
    }
    var custom = d.getElementById('define_colors')
    if (custom && info.kind === 'solid') custom.value = info.value
    if (state.draft) {
      var applyBtn = element('ap-bg-custom-apply')
      var customStatus = element('ap-bg-custom-status')
      if (applyBtn) applyBtn.disabled = false
      if (customStatus) {
        customStatus.textContent = state.customMessage
        if (state.customStatus === 'error') customStatus.setAttribute('data-state', 'error')
        else customStatus.removeAttribute('data-state')
      }
      renderPreview(element('ap-bg-custom-preview'), { url: state.draft, name: '自定义背景' })
    }
  }

  function showTab (id) {
    if (['wallpaper', 'colors', 'custom'].indexOf(id) < 0) return
    ;['wallpaper', 'colors', 'custom'].forEach(function (key) {
      var panel = element('ap-bg-main-' + key)
      if (panel) panel.hidden = key !== id
    })
    var tabs = d.querySelectorAll('[data-ap-bg-main]')
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].setAttribute('aria-pressed', tabs[i].getAttribute('data-ap-bg-main') === id ? 'true' : 'false')
    }
    if (id === 'wallpaper') renderCategory('anime')
  }

  function showCategory (id) {
    var found = CATEGORIES.some(function (c) { return c.id === id })
    if (!found) return
    renderCategory(id)
    CATEGORIES.forEach(function (c) {
      var panel = element('ap-bg-category-' + c.id)
      if (panel) panel.hidden = c.id !== id
    })
    var tabs = d.querySelectorAll('[data-ap-bg-category]')
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].setAttribute('aria-pressed', tabs[i].getAttribute('data-ap-bg-category') === id ? 'true' : 'false')
    }
  }

  function select (id) {
    var item = CATALOG.find(function (entry) { return entry.id === id })
    if (item) request(item.value)
  }

  function selectApi (id) {
    var api = APIS.find(function (entry) { return entry.id === id })
    if (api) request(api.value)
  }

  function invalidateCustom () {
    state.draft = null
    state.customStatus = 'idle'
    state.customMessage = '先预览并验证，再应用到全站。'
    var applyBtn = element('ap-bg-custom-apply')
    if (applyBtn) applyBtn.disabled = true
    var status = element('ap-bg-custom-status')
    if (status) { status.textContent = state.customMessage; status.removeAttribute('data-state') }
    renderPreview(element('ap-bg-custom-preview'), { kind: 'invalid', name: '自定义背景' })
  }

  function previewCustom () {
    var input = element('pic-link')
    var status = element('ap-bg-custom-status')
    var applyBtn = element('ap-bg-custom-apply')
    var url = input ? input.value.trim() : ''
    var safe = safeUrl(url)
    if (!safe) {
      state.draft = null
      state.customStatus = 'error'
      state.customMessage = '请输入有效的 HTTPS 图片地址。'
      if (status) { status.textContent = state.customMessage; status.setAttribute('data-state', 'error') }
      if (applyBtn) applyBtn.disabled = true
      return
    }
    var token = ++state.customToken
    state.customPending = safe
    state.customStatus = 'loading'
    state.customMessage = '正在验证图片…'
    if (status) { status.textContent = state.customMessage; status.removeAttribute('data-state') }
    if (applyBtn) applyBtn.disabled = true
    probe(safe).then(function (ok) {
      if (token !== state.customToken) return
      state.customPending = null
      if (!ok) {
        state.draft = null
        state.customStatus = 'error'
        state.customMessage = '图片加载失败或超时，请换一个链接。'
        if (status) { status.textContent = state.customMessage; status.setAttribute('data-state', 'error') }
        if (applyBtn) applyBtn.disabled = true
        return
      }
      state.draft = safe
      state.customStatus = 'ready'
      state.customMessage = '验证通过，可应用到全站。'
      if (status) { status.textContent = state.customMessage; status.removeAttribute('data-state') }
      renderPreview(element('ap-bg-custom-preview'), { url: safe, name: '自定义背景' })
      if (applyBtn) applyBtn.disabled = false
    })
  }

  function applyCustom () {
    var input = element('pic-link')
    var target = state.draft || (input && safeUrl(input.value.trim()))
    if (!target) { previewCustom(); return }
    request('url(' + target + ')')
  }

  function reset () {
    if (commit({ kind: 'default', css: 'default', url: '' })) notify('已恢复默认背景')
  }

  function retry () {
    if (state.retry) request('url(' + state.retry + ')')
  }

  function changeColor () {
    var input = element('define_colors')
    if (input) request(input.value)
  }

  var API = {
    markup: markup,
    sync: sync,
    init: function () {
      var saved = B.get ? B.get(K.bg, 'default') : 'default'
      state.current = saved
      apply(saved)
      sync()
    },
    showTab: showTab,
    showCategory: showCategory,
    select: select,
    selectApi: selectApi,
    invalidateCustom: invalidateCustom,
    previewCustom: previewCustom,
    applyCustom: applyCustom,
    reset: reset,
    retry: retry,
    changeColor: changeColor
  }
  w.HG_BACKGROUNDS = API

  w.showAppearanceBackgroundTab = showTab
  w.showAppearanceBackgroundCategory = showCategory
  w.selectAppearanceBackground = select
  w.selectAppearanceBackgroundApi = selectApi
  w.resetAppearanceBackground = reset
  w.retryAppearanceBackground = retry
  w.previewCustomBackground = previewCustom
  w.applyCustomBackground = applyCustom
  w.invalidateCustomBackground = invalidateCustom
  w.changeBgColor = changeColor

  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', API.init, { once: true })
  else API.init()
})(window, document)
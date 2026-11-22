/*!
 * 美化设置弹窗（Winbox）—— 对照 my-blog 的 fomal 面板移植
 * 依赖（按顺序）：winbox.min.js、notify.js、fonts.js、backgrounds.js、snow.js、fireflies.js、ripple.js
 * 入口：导航栏「美化」onclick="toggleWinbox()"、右键菜单「美化设置」
 * 偏好：由 boot.js 在首帧前统一应用；本文件只负责面板交互与即时写入。
 */
(function (w, d) {
  'use strict'

  if (w.HG_PANEL) { w.HG_PANEL.open(); return }

  var B = w.HGBeauty || {}
  var D = B.defaults || {}
  var K = B.keys || {}
  var winbox = null
  var savedScroll = 0

  var PRESETS = [
    { id: 'red', name: '珊瑚红', hex: '#ef5a5a' },
    { id: 'orange', name: '暖杏橙', hex: '#d7924d' },
    { id: 'yellow', name: '蜂蜜金', hex: '#c4a64a' },
    { id: 'matcha', name: '抹茶绿', hex: '#66b34d' },
    { id: 'puregreen', name: '玉石绿', hex: '#4daf87' },
    { id: 'green', name: '青碧', hex: '#39c5bb' },
    { id: 'blue', name: '晴空蓝', hex: '#49b1f5' },
    { id: 'darkblue', name: '雾蓝灰', hex: '#71859c' },
    { id: 'heoblue', name: '柔靛蓝', hex: '#616ad1' },
    { id: 'purepurple', name: '紫罗兰', hex: '#9d7bd8' },
    { id: 'pink', name: '樱花粉', hex: '#ff8fa3' }
  ]

  function sget (key, dv) {
    try {
      var v = w.localStorage.getItem(key)
      return v === null ? dv : v
    } catch (e) { return dv }
  }
  function sset (key, value) {
    try { w.localStorage.setItem(key, value) } catch (e) {}
  }
  function $(id) { return d.getElementById(id) }
  function clamp (value, min, max) {
    var n = parseFloat(value)
    if (!isFinite(n)) n = min
    return Math.max(min, Math.min(max, n))
  }
  function bool (key, dv) { return sget(key, dv) !== '0' }

  function toast (title, type, message) {
    if (!w.fomalNotify) return
    w.fomalNotify({
      title: title,
      message: message || '',
      type: type || 'success',
      position: 'top-left',
      offset: 50,
      showClose: true,
      duration: 2400
    })
  }

  /* ── 主题色 ─────────────────────────────────────────────────────────────── */
  function applyTheme (hex, preset, persist) {
    hex = /^#[0-9a-f]{6}$/i.test(hex || '') ? hex : (D.theme || '#49b1f5')
    var root = d.documentElement
    var rgb = B.hexToRgb ? B.hexToRgb(hex) : [73, 177, 245]
    var channels = rgb.join(',')
    root.style.setProperty('--theme-color', hex)
    root.style.setProperty('--hg-appearance-color', hex)
    root.style.setProperty('--btn-bg', hex)
    root.style.setProperty('--btn-hover-color', B.mix ? B.mix(hex, '#ffffff', 0.22) : hex)
    root.style.setProperty('--text-bg-hover', 'rgba(' + channels + ', 0.85)')
    root.style.setProperty('--scrollbar-color', hex)
    root.style.setProperty('--default-bg-color', hex)
    root.style.setProperty('--waline-theme-color', hex)
    var ink = B.ink ? B.ink(rgb) : '#ffffff'
    root.style.setProperty('--on-theme', ink)
    root.style.setProperty('--on-theme-away', ink === '#ffffff' ? '#000000' : '#ffffff')
    if (persist) {
      sset(K.theme, hex)
      sset(K.themePreset, preset || 'custom')
    }
    syncTheme(hex, preset || 'custom')
  }

  function syncTheme (hex, preset) {
    hex = hex || sget(K.theme, D.theme)
    preset = preset || sget(K.themePreset, D.themePreset)
    var radios = d.querySelectorAll('.settings input[name="colors"]')
    for (var i = 0; i < radios.length; i++) radios[i].checked = radios[i].value === preset
    var custom = d.querySelector('.settings .theme-custom')
    if (custom) {
      custom.classList.toggle('is-selected', preset === 'custom')
      custom.style.setProperty('--custom-theme-color', hex)
      var picker = custom.querySelector('input[type="color"]')
      if (picker) picker.value = hex
    }
    var hint = $('themeColorHint')
    if (hint) {
      var item = PRESETS.find(function (p) { return p.id === preset })
      hint.textContent = '当前：' + (item ? item.name : '自定义') + ' ' + hex + ' · 点击色点即时生效'
    }
  }

  function setColor (preset) {
    var item = PRESETS.find(function (p) { return p.id === preset })
    if (!item) return
    applyTheme(item.hex, item.id, true)
    if (w.CURSOR && w.CURSOR.refresh) {
      try { w.CURSOR.refresh() } catch (e) {}
    }
    toast('主题色已切换为「' + item.name + '」')
  }

  function setCustomColor (value, persist) {
    if (!/^#[0-9a-f]{6}$/i.test(value || '')) return
    applyTheme(value, 'custom', persist === true)
    if (persist === true) {
      if (w.CURSOR && w.CURSOR.refresh) {
        try { w.CURSOR.refresh() } catch (e) {}
      }
      toast('已使用自定义主题色 ' + value)
    }
  }

  /* ── 卡片不透明度 ───────────────────────────────────────────────────────── */
  function setOpacity (value, persist) {
    var n = clamp(value, 0, 100)
    var root = d.documentElement
    root.style.setProperty('--trans-light', 'rgba(255, 255, 255, ' + (n / 100) + ')')
    root.style.setProperty('--trans-dark', 'rgba(25, 25, 25, ' + (n / 100) + ')')
    var number = $('transNumber')
    var slider = $('transSet')
    if (number) number.value = Math.round(n)
    if (slider) {
      slider.value = n
      fill(slider, n, 0, 100)
    }
    var status = $('transStatus')
    if (status) status.textContent = '默认 88% · 当前 ' + Math.round(n) + '%'
    if (persist) sset(K.opacity, String(n))
  }

  function changeOpacity (mode) {
    var source = $(mode === 'number' ? 'transNumber' : 'transSet')
    if (source) setOpacity(source.value, true)
  }

  /* ── 背景滤镜 ───────────────────────────────────────────────────────────── */
  function filterState () {
    var raw = sget(K.filter, D.filter)
    var m = /^blur\(([\d.]+)px\) saturate\(([\d.]+)%\) contrast\(([\d.]+)%\)$/.exec(raw || '')
    if (!m) m = ['', 0, 100, 100]
    return { blur: +m[1], saturation: +m[2], contrast: +m[3] }
  }

  function filterOn () { return sget(K.filterOn, D.filterOn) === '1' }

  function paintFilter () {
    var root = d.documentElement
    var on = filterOn()
    if (on) {
      var f = filterState()
      root.style.setProperty('--hg-bg-filter', 'blur(' + f.blur + 'px) saturate(' + f.saturation + '%) contrast(' + f.contrast + '%)')
    } else {
      root.style.removeProperty('--hg-bg-filter')
    }
    root.classList.toggle('hg-bg-filtered', on)
    root.classList.toggle('hg-bg-blurred', on && f && f.blur > 0)
    var rows = d.querySelectorAll('.settings [data-filter-row]')
    for (var i = 0; i < rows.length; i++) rows[i].classList.toggle('is-disabled', !on)
    var inputs = d.querySelectorAll('.settings [data-filter-row] input')
    for (var j = 0; j < inputs.length; j++) inputs[j].disabled = !on
    var check = $('bgFilterSet')
    if (check) check.checked = on
    var hint = $('bgFilterHint')
    if (hint) hint.textContent = on ? '滤镜已开启 · 只影响背景壁纸' : '滤镜已关闭 · 壁纸按原图显示'
  }

  function syncFilter () {
    var f = filterState()
    ;[['blurRad', f.blur, 0, 60], ['saturation', f.saturation, 0, 200], ['contrast', f.contrast, 0, 200]].forEach(function (row) {
      var number = $(row[0])
      var slider = $(row[0] + 'Set')
      if (number) number.value = Math.round(row[1])
      if (slider) {
        slider.value = row[1]
        fill(slider, row[1], row[2], row[3])
      }
    })
    paintFilter()
  }

  function editFilter (id, isNumber) {
    var map = { blurRad: 'blur', saturation: 'saturation', contrast: 'contrast' }
    var field = map[id]
    var input = $(isNumber ? id : id + 'Set')
    if (!field || !input) return
    var limits = { blur: [0, 60], saturation: [0, 200], contrast: [0, 200] }
    var f = filterState()
    f[field] = clamp(input.value, limits[field][0], limits[field][1])
    sset(K.filter, 'blur(' + f.blur + 'px) saturate(' + f.saturation + '%) contrast(' + f.contrast + '%)')
    sset(K.filterOn, '1')
    syncFilter()
  }

  function resetFilter () {
    sset(K.filter, D.filter)
    sset(K.filterOn, '1')
    syncFilter()
    toast('背景滤镜已恢复默认值', 'info')
  }

  function toggleFilter (on) {
    sset(K.filterOn, on ? '1' : '0')
    paintFilter()
    toast(on ? '背景滤镜已开启' : '背景滤镜已关闭', 'info')
  }

  function fill (element, value, min, max) {
    if (!element) return
    var pct = max === min ? 0 : (value - min) / (max - min) * 100
    element.style.setProperty('--bf-fill', Math.max(0, Math.min(100, pct)) + '%')
  }

  /* ── 字号 / 圆角 ─────────────────────────────────────────────────────────── */
  function setFontScale (mode, persist) {
    var large = mode === 'large'
    d.documentElement.style.setProperty('--hg-font', large ? '1.15' : '1')
    if (persist) sset(K.fontScale, large ? 'large' : 'normal')
    syncSeg('.size-seg button', 'data-size', large ? 'large' : 'normal')
  }

  function setRadius (mode, persist) {
    var value = mode === 'small' ? '6px' : (mode === 'large' ? '18px' : '12px')
    d.documentElement.style.setProperty('--hg-radius', value)
    if (persist) sset(K.radius, mode)
    syncSeg('.radius-seg button', 'data-radius', mode)
  }

  function syncSeg (selector, attr, value) {
    var buttons = d.querySelectorAll('.settings ' + selector)
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].classList.toggle('is-on', buttons[i].getAttribute(attr) === value)
    }
  }

  /* ── 氛围特效 ───────────────────────────────────────────────────────────── */
  function setUniverse (on) {
    sset(K.universe, on ? '1' : '0')
    d.documentElement.classList.toggle('hg-universe-off', !on)
    syncEffects()
    toast(on ? '星空特效已开启' : '星空特效已关闭', 'info')
  }

  function setNeon (on) {
    sset(K.neon, on ? '1' : '0')
    d.documentElement.classList.toggle('hg-neon-off', !on)
    syncEffects()
    toast(on ? '霓虹彩灯已开启' : '霓虹彩灯已关闭', 'info')
  }

  function setSnow (on) {
    if (w.FOMAL_SNOW && w.FOMAL_SNOW.setEnabled) w.FOMAL_SNOW.setEnabled(on)
    else {
      sset(K.snow, on ? '1' : '0')
      if (on) sset('hgFirefliesOn', '0')
    }
    if (on && w.FOMAL_FIREFLIES && w.FOMAL_FIREFLIES.setEnabled) w.FOMAL_FIREFLIES.setEnabled(false)
    syncEffects()
    toast(on ? '雪花特效已开启（仅浅色桌面显示）' : '雪花特效已关闭', 'info')
  }

  function setFireflies (on) {
    if (w.FOMAL_FIREFLIES && w.FOMAL_FIREFLIES.setEnabled) w.FOMAL_FIREFLIES.setEnabled(on)
    else sset('hgFirefliesOn', on ? '1' : '0')
    syncEffects()
    toast(on ? '萤火虫微光已开启' : '萤火虫微光已关闭', 'info')
  }

  function setRipple (on) {
    if (w.FOMAL_RIPPLE && w.FOMAL_RIPPLE.setEnabled) w.FOMAL_RIPPLE.setEnabled(on)
    else sset(K.ripple, on ? '1' : '0')
    syncEffects()
    toast(on ? '点击涟漪已开启' : '点击涟漪已关闭', 'info')
  }

  function setNeko (on) {
    sset('nekoOn', on ? '1' : '0')
    if (typeof w.setNekoEnabled === 'function') w.setNekoEnabled(on)
    else d.documentElement.classList.toggle('beauty-neko-off', !on)
    syncEffects()
    toast(on ? '猫咪挂件已开启' : '猫咪挂件已关闭', 'info')
  }

  function setCursor (on) {
    sset('cursorOn', on ? '1' : '0')
    if (w.CURSOR && w.CURSOR.setEnabled) w.CURSOR.setEnabled(on)
    syncEffects()
    toast(on ? '听话鼠标已开启' : '听话鼠标已关闭', 'info')
  }

  function setFps (on) {
    if (typeof w.fpsSwitch === 'function') w.fpsSwitch(on)
    else sset('fpson', on ? '1' : '0')
    syncEffects()
    toast(on ? '帧率监测已开启' : '帧率监测已关闭', 'info')
  }

  function setPerf (on) {
    if (typeof w.perfLite !== 'function') {
      toast('性能模式脚本未加载', 'warning')
      return
    }
    w.perfLite(on)
    syncEffects()
    toast(on ? '性能模式已开启' : '性能模式已关闭', 'info')
  }

  function syncEffects () {
    setChecked('universeSet', !d.documentElement.classList.contains('hg-universe-off'))
    setChecked('neonSet', !d.documentElement.classList.contains('hg-neon-off'))
    setChecked('snowSet', sget(K.snow, '1') === '1')
    setChecked('firefliesSet', sget('hgFirefliesOn', '0') === '1')
    setChecked('rippleSet', sget(K.ripple, '1') === '1')
    setChecked('nekoSet', sget('nekoOn', '1') !== '0')
    setChecked('cursorSet', sget('cursorOn', '1') !== '0')
    setChecked('fpson', sget('fpson', '1') !== '0')
    setChecked('perfLiteSet', d.documentElement.classList.contains('perf-lite'))

    var hints = {
      snowSetHint: sget(K.snow, '1') === '1' ? '已开启 · 仅浅色桌面显示' : '白天桌面落雪 · 与萤火虫互斥',
      firefliesSetHint: sget('hgFirefliesOn', '0') === '1' ? '已开启 · 页面下方微光' : '下方微光 · 与雪花互斥',
      rippleSetHint: sget(K.ripple, '1') === '1' ? '已开启 · 点击处泛起波纹' : '点一下，泛起一圈小波纹',
      nekoSetHint: sget('nekoOn', '1') !== '0' ? '默认开启 · 跟着指针的小猫' : '已关闭',
      cursorSetHint: sget('cursorOn', '1') !== '0' ? '默认开启 · 指针缓动拖尾' : '已关闭',
      fpsonHint: sget('fpson', '1') !== '0' ? '右下角实时帧率' : '已关闭',
      perfLiteSetHint: d.documentElement.classList.contains('perf-lite') ? '已开启 · 毛玻璃与背景动画已降级' : '低性能设备可一键降级'
    }
    for (var id in hints) {
      var node = $(id)
      if (node) node.textContent = hints[id]
    }
    if (w.FOMAL_SNOW && w.FOMAL_SNOW.syncControls) w.FOMAL_SNOW.syncControls()
    if (w.FOMAL_FIREFLIES && w.FOMAL_FIREFLIES.syncControls) w.FOMAL_FIREFLIES.syncControls()
    if (w.FOMAL_RIPPLE && w.FOMAL_RIPPLE.syncControls) w.FOMAL_RIPPLE.syncControls()
    syncTier()
    syncNightStyle()
  }

  function setChecked (id, checked) {
    var node = $(id)
    if (node) node.checked = checked
  }

  /* ── 昼夜档位 ───────────────────────────────────────────────────────────── */
  function tier () { return sget(K.tier, 'standard') }
  function syncTier () {
    var current = tier()
    var buttons = d.querySelectorAll('.settings .dm-seg button[data-tier]')
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].classList.toggle('is-on', buttons[i].getAttribute('data-tier') === current)
    }
    var note = $('darkTransNote')
    if (note) {
      note.textContent = {
        off: '直接切换，不播放过场动画',
        light: '轻量：快速淡入淡出',
        standard: '标准：黄昏落幕 + 星月',
        flourish: '华丽：完整星月与流星'
      }[current] || '标准：黄昏落幕 + 星月'
    }
  }

  /* ── 昼夜切换样式：山河日月 / 图形（旧版 Cuteen 转盘） ─────────────────── */
  function nightStyle () { return sget(K.nightStyle, 'scene') === 'cuteen' ? 'cuteen' : 'scene' }
  function syncNightStyle () {
    var current = nightStyle()
    var buttons = d.querySelectorAll('.settings .dm-seg button[data-ns]')
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].classList.toggle('is-on', buttons[i].getAttribute('data-ns') === current)
    }
    var note = $('nightStyleNote')
    if (note) {
      note.textContent = current === 'cuteen'
        ? '图形：旧版圆盘转动 + 日月互换'
        : '山河日月：太阳沉落 / 月亮升起 + 星星'
    }
  }

  function setNightStyle (value) {
    if (['scene', 'cuteen'].indexOf(value) < 0) return
    sset(K.nightStyle, value)
    syncNightStyle()
    toast('切换样式：' + (value === 'cuteen' ? '图形（旧版）' : '山河日月'), 'info')
  }

  function setTier (value) {
    if (['off', 'light', 'standard', 'flourish'].indexOf(value) < 0) return
    sset(K.tier, value)
    syncTier()
    toast('昼夜过场：' + ({ off: '关闭', light: '轻', standard: '标准', flourish: '华丽' }[value]), 'info')
  }

  /* ── 布局与部件 ─────────────────────────────────────────────────────────── */
  function setRightside (on) {
    sset(K.rightside, on ? '1' : '0')
    d.documentElement.classList.toggle('hg-rightside-off', !on)
    syncLayout()
    toast(on ? '右侧部件已显示' : '右侧部件已隐藏', 'info')
  }

  function setRightsideColor (value, persist) {
    var hex = /^#[0-9a-f]{6}$/i.test(value) ? value : (D.rightsideColor || '#ffffff')
    d.documentElement.style.setProperty('--hg-rightside-color', hex)
    if (persist) sset(K.rightsideColor, hex)
    var input = $('rightsideColor')
    if (input) input.value = hex
    return hex
  }

  function setNavAlways (on) {
    sset(K.navAlways, on ? '1' : '0')
    d.documentElement.classList.toggle('hg-nav-always', on)
    syncLayout()
    toast(on ? '顶栏已设为常驻' : '顶栏恢复滚动隐藏', 'info')
  }

  function setAside (on) {
    sset(K.aside, on ? '1' : '0')
    sset('aside-status', on ? 'show' : 'hide')
    d.documentElement.classList.toggle('hide-aside', !on)
    syncLayout()
    toast(on ? '侧栏已显示' : '侧栏已隐藏', 'info')
  }

  function setAsidePos (pos) {
    var left = pos === 'left'
    sset(K.asidePos, left ? 'left' : 'right')
    d.documentElement.classList.toggle('hg-aside-left', left)
    syncLayout()
    toast(left ? '侧栏已移到左侧' : '侧栏已回到右侧', 'info')
  }

  function setArticleMulti (on) {
    sset(K.articleLayout, on ? '1' : '0')
    d.documentElement.classList.toggle('hg-article-multi', on)
    syncLayout()
    toast(on ? '首页文章已切换为多栏' : '首页文章已恢复单栏', 'info')
  }

  function syncLayout () {
    var root = d.documentElement
    setChecked('rightSideSet', !root.classList.contains('hg-rightside-off'))
    setChecked('navSet', root.classList.contains('hg-nav-always'))
    setChecked('asideSet', !root.classList.contains('hide-aside'))
    setChecked('articleMultiSet', root.classList.contains('hg-article-multi'))
    syncSeg('.aside-pos-seg button', 'data-pos', root.classList.contains('hg-aside-left') ? 'left' : 'right')
    setRightsideColor(sget(K.rightsideColor, D.rightsideColor), false)
  }

  /* ── 面板 HTML ──────────────────────────────────────────────────────────── */
  function toggleRow (id, title, note, checked, handler) {
    return '<label class="feature-opt"><span>' + title + '<small id="' + id + 'Hint">' + note + '</small></span>' +
      '<input id="' + id + '" type="checkbox"' + (checked ? ' checked' : '') + ' onchange="' + handler + '(this.checked)"></label>'
  }

  function filterRow (id, label, unit, min, max, value) {
    return '<div class="hg-range" data-filter-row="' + id + '">' +
      '<div class="bf-value-row"><label for="' + id + '">' + label + '</label>' +
        '<span class="bf-number"><input id="' + id + '" type="number" min="' + min + '" max="' + max + '" step="1" value="' + value + '" oninput="hgEditFilter(\'' + id + '\', true)" onblur="hgEditFilter(\'' + id + '\', true)"><span>' + unit + '</span></span>' +
      '</div>' +
      '<input id="' + id + 'Set" class="bf-slider" type="range" min="' + min + '" max="' + max + '" step="1" value="' + value + '" aria-label="' + label + '" oninput="hgEditFilter(\'' + id + '\', false)">' +
    '</div>'
  }

  function themeMarkup () {
    var s = B.read ? B.read() : {}
    var preset = s.themePreset
    var hex = s.theme
    var dots = PRESETS.map(function (p) {
      return '<label class="theme-choice" title="' + p.name + ' ' + p.hex + '">' +
        '<input type="radio" name="colors" value="' + p.id + '" style="color:' + p.hex + '"' + (preset === p.id ? ' checked' : '') + ' onclick="hgSetColor(\'' + p.id + '\')">' +
      '</label>'
    }).join('')
    return '<div class="content colorRow">' + dots +
      '<label class="theme-choice theme-custom' + (preset === 'custom' ? ' is-selected' : '') + '" style="--custom-theme-color:' + hex + '" title="自定义颜色">' +
        '<span class="theme-rainbow" aria-hidden="true"></span>' +
        '<input type="color" value="' + hex + '" aria-label="自定义主题色" oninput="hgSetCustomColor(this.value, false)" onchange="hgSetCustomColor(this.value, true)">' +
      '</label>' +
    '</div>' +
    '<p class="theme-color-hint" id="themeColorHint"></p>'
  }

  function panelHTML () {
    var s = B.read ? B.read() : {}
    var f = filterState()
    var on = filterOn()
    var fonts = w.HG_FONTS ? w.HG_FONTS.markup() : '<p class="hg-hint">字体模块未加载。</p>'
    var backgrounds = w.HG_BACKGROUNDS ? w.HG_BACKGROUNDS.markup() : '<p class="hg-hint">背景模块未加载。</p>'

    return '<div class="settings hg-settings">' +
      '<div class="hg-topbar"><button type="button" id="reset_btn" onclick="hgResetBeauty()"><i class="fa-solid fa-rotate-left"></i> 恢复默认设置</button></div>' +

      '<h2><i class="fa-solid fa-sliders"></i>一、显示偏好</h2>' +
      '<div class="bf-panel">' +
        '<div class="hg-range">' +
          '<div class="bf-value-row"><label for="transNumber">卡片不透明度</label><span class="bf-number"><input id="transNumber" type="number" min="0" max="100" step="1" value="' + s.opacity + '" oninput="hgSetTrans(\'number\')" onblur="hgSetTrans(\'number\')"><span>%</span></span></div>' +
          '<input id="transSet" class="bf-slider" type="range" min="0" max="100" step="1" value="' + s.opacity + '" aria-label="卡片不透明度" oninput="hgSetTrans(\'slider\')">' +
          '<div class="bf-limits"><span>0%</span><span id="transStatus">默认 88%</span><span>100%</span></div>' +
        '</div>' +
        '<div class="feature-opt"><span>背景滤镜<small id="bgFilterHint">' + (on ? '滤镜已开启 · 只影响背景壁纸' : '滤镜已关闭 · 壁纸按原图显示') + '</small></span><input id="bgFilterSet" type="checkbox"' + (on ? ' checked' : '') + ' onchange="hgToggleBgFilter(this.checked)"></div>' +
        filterRow('blurRad', '模糊程度', 'px', 0, 60, f.blur) +
        filterRow('saturation', '饱和度', '%', 0, 200, f.saturation) +
        filterRow('contrast', '对比度', '%', 0, 200, f.contrast) +
        '<div class="bf-footer"><button type="button" onclick="hgResetBgFilter()">恢复滤镜默认值</button></div>' +
      '</div>' +

      '<h2><i class="fa-solid fa-wand-magic-sparkles"></i>氛围特效</h2>' +
      '<div class="hg-box"><div class="feature-grid">' +
        toggleRow('universeSet', '星空特效', '夜间首页星空与流星', !d.documentElement.classList.contains('hg-universe-off'), 'hgSetUniverse') +
        toggleRow('neonSet', '霓虹彩灯', '夜间标题的呼吸灯', !d.documentElement.classList.contains('hg-neon-off'), 'hgSetNeon') +
        toggleRow('snowSet', '雪花特效', '白天桌面落雪 · 与萤火虫互斥', sget(K.snow, '1') === '1', 'hgSetSnow') +
        toggleRow('firefliesSet', '萤火虫微光', '下方微光 · 与雪花互斥', sget('hgFirefliesOn', '0') === '1', 'hgSetFireflies') +
        '<div class="feature-opt dm-wide"><span>昼夜切换<small id="darkTransNote">黄昏落幕动画强度</small></span>' +
          '<div class="dm-seg" role="group" aria-label="昼夜切换档位">' +
            '<button type="button" data-tier="off" onclick="hgSetTier(\'off\')">关闭</button>' +
            '<button type="button" data-tier="light" onclick="hgSetTier(\'light\')">轻</button>' +
            '<button type="button" data-tier="standard" onclick="hgSetTier(\'standard\')">标准</button>' +
            '<button type="button" data-tier="flourish" onclick="hgSetTier(\'flourish\')">华丽</button>' +
          '</div>' +
        '</div>' +
        '<div class="feature-opt dm-wide"><span>切换样式<small id="nightStyleNote">点击日月的过场效果</small></span>' +
          '<div class="dm-seg" role="group" aria-label="昼夜切换样式">' +
            '<button type="button" data-ns="scene" onclick="hgSetNightStyle(\'scene\')">山河日月</button>' +
            '<button type="button" data-ns="cuteen" onclick="hgSetNightStyle(\'cuteen\')">图形（旧版）</button>' +
          '</div>' +
        '</div>' +
      '</div></div>' +

      '<h2><i class="fa-solid fa-paw"></i>互动挂件</h2>' +
      '<div class="hg-box"><div class="feature-grid">' +
        toggleRow('nekoSet', '猫咪挂件', '跟着指针的小猫', sget('nekoOn', '1') !== '0', 'hgSetNeko') +
        toggleRow('cursorSet', '听话鼠标', '指针缓动拖尾', sget('cursorOn', '1') !== '0', 'hgSetCursor') +
        toggleRow('fpson', '帧率监测', '右下角实时帧率', sget('fpson', '1') !== '0', 'hgSetFps') +
        toggleRow('rippleSet', '点击涟漪', '点一下，泛起一圈小波纹', sget(K.ripple, '1') === '1', 'hgSetRipple') +
        toggleRow('perfLiteSet', '性能模式', '低性能设备可一键降级', d.documentElement.classList.contains('perf-lite'), 'hgSetPerf') +
      '</div></div>' +

      '<h2><i class="fa-solid fa-table-columns"></i>布局与部件</h2>' +
      '<div class="hg-box"><div class="feature-grid">' +
        toggleRow('rightSideSet', '右侧部件', '回到顶部 / 目录等按钮', !d.documentElement.classList.contains('hg-rightside-off'), 'hgSetRightside') +
        toggleRow('navSet', '顶栏常驻', '向下滚动时也保持显示', d.documentElement.classList.contains('hg-nav-always'), 'hgSetNavAlways') +
        toggleRow('asideSet', '侧栏显示', '作者卡与最新文章', !d.documentElement.classList.contains('hide-aside'), 'hgSetAside') +
        toggleRow('articleMultiSet', '文章多栏', '首页三栏（中屏自动两栏）', d.documentElement.classList.contains('hg-article-multi'), 'hgSetArticleMulti') +
        '<div class="feature-opt"><span>Cookie 与隐私<small>重新选择统计 / 评论</small></span><button type="button" class="ap-btn" onclick="hgOpenConsent()">重新选择</button></div>' +
        '<div class="feature-opt"><span>右侧图标颜色<small>回到顶部 / 目录等按钮</small></span>' +
          '<input class="hg-color-input" id="rightsideColor" type="color" value="' + (s.rightsideColor || '#ffffff') + '" aria-label="右侧图标颜色" oninput="hgSetRightsideColor(this.value, false)" onchange="hgSetRightsideColor(this.value, true)">' +
        '</div>' +
        '<div class="feature-opt"><span>侧栏位置</span><div class="dm-seg aside-pos-seg" role="group" aria-label="侧栏位置">' +
          '<button type="button" data-pos="left" onclick="hgSetAsidePos(\'left\')">左侧</button>' +
          '<button type="button" data-pos="right" onclick="hgSetAsidePos(\'right\')">右侧</button>' +
        '</div></div>' +
      '</div></div>' +

      '<h2><i class="fa-solid fa-palette"></i>二、主题色设置</h2>' +
      themeMarkup() +

      '<h2><i class="fa-solid fa-font"></i>三、字体设置</h2>' +
      fonts +
      '<div class="hg-box">' +
        '<div class="feature-opt"><span>字号<small>整站基准字号</small></span><div class="dm-seg size-seg" role="group" aria-label="字号">' +
          '<button type="button" data-size="normal" onclick="hgSetFontScale(\'normal\', true)">标准</button>' +
          '<button type="button" data-size="large" onclick="hgSetFontScale(\'large\', true)">大</button>' +
        '</div></div>' +
        '<div class="feature-opt"><span>卡片圆角<small>文章卡、侧栏卡与代码块</small></span><div class="dm-seg radius-seg" role="group" aria-label="卡片圆角">' +
          '<button type="button" data-radius="small" onclick="hgSetRadius(\'small\', true)">小</button>' +
          '<button type="button" data-radius="mid" onclick="hgSetRadius(\'mid\', true)">中</button>' +
          '<button type="button" data-radius="large" onclick="hgSetRadius(\'large\', true)">大</button>' +
        '</div></div>' +
      '</div>' +

      '<h2><i class="fa-solid fa-image"></i>四、背景设置</h2>' +
      backgrounds +

      '<p class="hg-panel-foot">( •̀ ω •́ )y 到底啦</p>' +
    '</div>'
  }

  /* ── 弹窗 ───────────────────────────────────────────────────────────────── */
  function panelSize () {
    var vw = w.innerWidth, vh = w.innerHeight
    if (vw < 768) return [Math.max(300, vw - 20), Math.max(420, vh - 40)]
    return [Math.min(820, vw - 40), Math.min(720, vh - 60)]
  }

  function centerMinimized (box) {
    var el = box && box.g
    if (!el || !box.min) return
    el.style.left = Math.max(10, Math.round((w.innerWidth - el.offsetWidth) / 2)) + 'px'
    el.style.top = Math.max(10, Math.round((w.innerHeight - el.offsetHeight) / 2)) + 'px'
  }

  function syncAll () {
    var s = B.read ? B.read() : {}
    setOpacity(sget(K.opacity, D.opacity), false)
    syncFilter()
    setFontScale(sget(K.fontScale, D.fontScale), false)
    setRadius(sget(K.radius, D.radius), false)
    syncTheme(sget(K.theme, D.theme), sget(K.themePreset, D.themePreset))
    syncEffects()
    syncLayout()
    if (w.HG_FONTS && w.HG_FONTS.sync) w.HG_FONTS.sync()
    if (w.HG_BACKGROUNDS && w.HG_BACKGROUNDS.sync) w.HG_BACKGROUNDS.sync()
    var hint = $('bgFilterHint')
    if (hint) hint.textContent = filterOn() ? '滤镜已开启 · 只影响背景壁纸' : '滤镜已关闭 · 壁纸按原图显示'
  }

  function createWinbox () {
    if (!w.WinBox) {
      toast('弹窗组件没加载成功', 'warning')
      return
    }
    var size = panelSize()
    winbox = w.WinBox({
      id: 'meihuaBox',
      title: '美化设置',
      header: 42,
      x: 'center',
      y: 'center',
      width: size[0],
      height: size[1],
      minwidth: 300,
      minheight: 360,
      background: 'var(--theme-color)',
      class: 'hg-winbox',
      onclose: function () { winbox = null },
      /* WinBox 最小化时默认贴屏幕左下，这里把唯一的面板挪到屏幕正中 */
      onminimize: function () {
        var box = this
        /* 隐藏后面板高度被钳为 0，此时读到的 scrollTop 不可信，只接受有效值 */
        if (box.body && box.body.scrollTop > 0) savedScroll = box.body.scrollTop
        w.setTimeout(function () { centerMinimized(box) }, 0)
      }
    })
    winbox.body.innerHTML = panelHTML()
    winbox.body.classList.add('hg-body')
    /* 滚动时持续记录：最小化回调触发时窗口可能已隐藏、scrollTop 已归零 */
    winbox.body.addEventListener('scroll', function () {
      if (winbox && winbox.body && winbox.body.scrollTop > 0) savedScroll = winbox.body.scrollTop
    }, { passive: true })
    /* 最小化后右上角只剩放大图标，WinBox 默认点击会直接铺满屏幕；
       这里在最小化状态下改为恢复原窗口 */
    var maxControl = winbox.window && winbox.window.getElementsByClassName('wb-max')[0]
    if (maxControl) {
      maxControl.addEventListener('click', function (event) {
        if (!winbox || !winbox.min) return
        event.preventDefault()
        event.stopImmediatePropagation()
        restorePanel()
      }, true)
    }
    syncAll()
  }

  function restorePanel () {
    if (!winbox || !winbox.restore) return
    winbox.restore().focus()
    /* 面板重新显示后才恢复滚动位置，避免隐藏时高度为 0 被浏览器钳回顶部 */
    var apply = function () {
      if (!winbox || winbox.min || !winbox.body || !savedScroll) return
      winbox.body.scrollTop = savedScroll
    }
    w.setTimeout(apply, 30)
    w.setTimeout(apply, 160)
  }

  function open () {
    if (winbox) {
      if (winbox.min) restorePanel()
      return
    }
    createWinbox()
  }

  function toggleWinbox () {
    if (winbox) {
      if (winbox.min) restorePanel()
      winbox.close()
      winbox = null
      return
    }
    createWinbox()
  }

  function resize () {
    if (!winbox) return
    if (winbox.min) {
      centerMinimized(winbox)
      return
    }
    var size = panelSize()
    try { winbox.resize(size[0], size[1]) } catch (e) {}
  }

  /* ── 恢复默认 ───────────────────────────────────────────────────────────── */
  function resetAll () {
    var keys = Object.keys(K)
    for (var i = 0; i < keys.length; i++) {
      var name = keys[i]
      var key = K[name]
      if (key && D[name] !== undefined) sset(key, String(D[name]))
    }
    sset('aside-status', 'show')
    try { w.localStorage.removeItem('hgappearance') } catch (e) {}
    try { w.localStorage.removeItem(K.articleLayout) } catch (e) {}
    d.documentElement.classList.toggle('hg-article-multi', d.documentElement.getAttribute('data-article-default') === '1')

    applyTheme(D.theme || '#49b1f5', D.themePreset || 'blue', false)
    setOpacity(D.opacity, false)
    sset(K.filter, D.filter)
    sset(K.filterOn, D.filterOn)
    setFontScale(D.fontScale, false)
    setRadius(D.radius, false)

    var root = d.documentElement
    root.classList.remove('hg-rightside-off', 'hide-aside', 'hg-aside-left', 'hg-nav-always', 'hg-universe-off', 'hg-neon-off')
    d.body.classList.remove('hg-no-bg', 'hg-plain', 'hg-plain-bg')

    if (w.HG_FONTS && w.HG_FONTS.set) {
      w.HG_FONTS.set('text', D.textFont)
      w.HG_FONTS.set('code', D.codeFont)
    }
    if (w.HG_BACKGROUNDS && w.HG_BACKGROUNDS.init) w.HG_BACKGROUNDS.init()
    if (w.FOMAL_SNOW && w.FOMAL_SNOW.setEnabled) w.FOMAL_SNOW.setEnabled(D.snow === '1')
    if (w.FOMAL_FIREFLIES && w.FOMAL_FIREFLIES.setEnabled) w.FOMAL_FIREFLIES.setEnabled(false)
    if (w.FOMAL_RIPPLE && w.FOMAL_RIPPLE.setEnabled) w.FOMAL_RIPPLE.setEnabled(D.ripple === '1')
    if (typeof w.setNekoEnabled === 'function') w.setNekoEnabled(true)
    if (w.CURSOR && w.CURSOR.setEnabled) w.CURSOR.setEnabled(true)
    if (typeof w.fpsSwitch === 'function') w.fpsSwitch(true)
    if (typeof w.perfLite === 'function') w.perfLite(false)

    syncAll()
    toast('已恢复默认设置', 'success')
  }

  /* ── 兼容首屏与外部入口 ─────────────────────────────────────────────────── */
  if (B.read) {
    var s = B.read()
    if (s.theme) applyTheme(s.theme, s.themePreset, false)
    if (s.opacity !== undefined) setOpacity(s.opacity, false)
    if (s.fontScale) setFontScale(s.fontScale, false)
    if (s.radius) setRadius(s.radius, false)
    if (s.filterOn !== undefined) paintFilter()
  }
  try { if (!w.localStorage.getItem(K.tier)) sset(K.tier, 'standard') } catch (e) {}

  d.addEventListener('perf-lite-change', function () {
    if (winbox) syncEffects()
  })
  w.addEventListener('resize', resize)

  w.hgToggleWinbox = toggleWinbox
  w.hgCreateWinbox = createWinbox
  w.hgResetBeauty = resetAll
  w.hgSetTrans = changeOpacity
  w.hgToggleBgFilter = toggleFilter
  w.hgEditFilter = editFilter
  w.hgResetBgFilter = resetFilter
  w.hgSetColor = setColor
  w.hgSetCustomColor = setCustomColor
  w.hgSetUniverse = setUniverse
  w.hgSetNeon = setNeon
  w.hgSetSnow = setSnow
  w.hgSetFireflies = setFireflies
  w.hgSetRipple = setRipple
  w.hgSetNeko = setNeko
  w.hgSetCursor = setCursor
  w.hgSetFps = setFps
  w.hgSetPerf = setPerf
  w.hgSetTier = setTier
  w.hgSetNightStyle = setNightStyle
  w.hgSetFontScale = setFontScale
  w.hgSetRadius = setRadius
  w.hgSetRightside = setRightside
  w.hgSetRightsideColor = setRightsideColor
  w.hgSetNavAlways = setNavAlways
  w.hgSetAside = setAside
  w.hgSetAsidePos = setAsidePos
  w.hgSetArticleMulti = setArticleMulti
  w.toggleWinbox = toggleWinbox

  w.HG_PANEL = { open: open, reset: resetAll, sync: syncAll }
})(window, document)
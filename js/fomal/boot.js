/*!
 * 美化偏好首屏应用（同步脚本，必须放在 head 且不加 defer）
 * 作用：在 body 解析和首帧之前，把 localStorage 里的外观偏好写成 CSS 变量 / html 类，
 *       避免刷新时先闪默认主题色、默认字体、默认壁纸。
 * 与 panel.js / fonts.js / backgrounds.js 共用同一套键名，改键名要一起改。
 */
(function (w) {
  'use strict'

  var DEFAULTS = {
    theme: '#49b1f5',
    themePreset: 'blue',
    opacity: 88,
    filterOn: '1',
    filter: 'blur(0px) saturate(100%) contrast(100%)',
    textFont: 'myfont',
    codeFont: 'Consolas',
    bg: 'default',
    fontScale: 'normal',
    radius: 'mid',
    aside: '1',
    asidePos: 'right',
    navAlways: '0',
    rightside: '1',
    rightsideColor: '#ffffff',
    universe: '1',
    neon: '1',
    snow: '1',
    fireflies: '0',
    ripple: '1',
    neko: '1',
    cursor: '1',
    fps: '1',
    perf: 'off',
    tier: 'standard'
  }

  var KEYS = {
    theme: 'hgTheme',
    themePreset: 'hgThemePreset',
    opacity: 'hgCardOpacity',
    filterOn: 'hgBgFilterOn',
    filter: 'hgBgFilter',
    textFont: 'hgTextFont',
    codeFont: 'hgCodeFont',
    bg: 'hgBg',
    fontScale: 'hgFontScale',
    radius: 'hgRadius',
    aside: 'hgAsideOn',
    asidePos: 'hgAsidePos',
    navAlways: 'hgNavAlways',
    rightside: 'hgRightsideOn',
    rightsideColor: 'hgRightsideColor',
    universe: 'hgUniverseOn',
    neon: 'hgNeonOn',
    snow: 'hgSnowOn',
    fireflies: 'hgFirefliesOn',
    ripple: 'hgRippleOn',
    neko: 'nekoOn',
    cursor: 'cursorOn',
    fps: 'fpson',
    perf: 'perfLite',
    tier: 'darkTransition',
    nightStyle: 'hgNightStyle',
    articleLayout: 'hgArticleLayout'
  }

  var TEXT_STACKS = {
    myfont: '"myfont", -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
    LXGWNeoXiHei: '"LXGWNeoXiHei", "myfont", -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
    SourceHanSerif: '"SourceHanSerif", "myfont", "Songti SC", "SimSun", serif',
    ZhuZiAWan: '"ZhuZiAWan", "myfont", -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif',
    HYTMR: '"HYTMR", "myfont", "KaiTi", serif',
    TTQHB: '"TTQHB", "myfont", -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif',
    MiSans: '"MiSans", "myfont", -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif',
    default: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Lato, Roboto, "PingFang SC", "Microsoft JhengHei", "Microsoft YaHei", sans-serif'
  }

  var CODE_STACKS = {
    Consolas: 'Consolas, "SourceCodePro", "MapleMono", "JetBrainsMono", monospace',
    SourceCodePro: '"SourceCodePro", Consolas, "MapleMono", monospace',
    MapleMono: '"MapleMono", "SourceCodePro", Consolas, monospace',
    JetBrainsMono: '"JetBrainsMono", Consolas, "SourceCodePro", monospace',
    Monaco: 'Monaco, Consolas, "SourceCodePro", monospace'
  }

  function get (key, fallback) {
    try {
      var v = w.localStorage.getItem(key)
      return v === null ? fallback : v
    } catch (e) { return fallback }
  }

  function set (key, value) {
    try { w.localStorage.setItem(key, value) } catch (e) {}
  }

  function num (v, dv, min, max) {
    var n = parseFloat(v)
    if (!isFinite(n)) n = dv
    return Math.max(min, Math.min(max, n))
  }

  function hexToRgb (hex) {
    var h = String(hex || '').replace('#', '')
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]
    var n = parseInt(h || '49b1f5', 16)
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  }

  function mix (hex, target, ratio) {
    var a = hexToRgb(hex)
    var b = hexToRgb(target)
    return 'rgb(' + a.map(function (v, i) { return Math.round(v + (b[i] - v) * ratio) }).join(',') + ')'
  }

  function ink (rgb) {
    var lin = function (v) { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }
    var L = 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2])
    return L > 0.19 ? '#141a1c' : '#ffffff'
  }

  function bgToCss (value) {
    if (typeof value !== 'string') return ''
    value = value.trim()
    if (!value || value === 'default') return ''
    if (/^#[0-9a-f]{3,8}$/i.test(value)) return 'linear-gradient(' + value + ', ' + value + ')'
    if (/^(linear-gradient|radial-gradient)\([^;{}<>]*\)$/i.test(value)) return value
    var m = /^url\((['"]?)(https:\/\/[^"'()\s]+|\/img\/background\/[a-z0-9/_-]+\.(?:webp|jpe?g|png))\1\)$/i.exec(value)
    if (m) return 'url("' + m[2] + '")'
    if (/^(https:\/\/[^"'()\s]+|\/img\/background\/[a-z0-9/_-]+\.(?:webp|jpe?g|png))$/i.test(value)) return 'url("' + value + '")'
    return ''
  }

  function textStack (key) { return TEXT_STACKS[key] || TEXT_STACKS.myfont }
  function codeStack (key) { return CODE_STACKS[key] || CODE_STACKS.Consolas }

  /* 供 panel / fonts / backgrounds 共用的接口 */
  w.HGBeauty = {
    defaults: DEFAULTS,
    keys: KEYS,
    get: get,
    set: set,
    num: num,
    hexToRgb: hexToRgb,
    mix: mix,
    ink: ink,
    bgToCss: bgToCss,
    textStack: textStack,
    codeStack: codeStack,
    read: function () {
      var theme = get(KEYS.theme, DEFAULTS.theme)
      return {
        theme: /^#[0-9a-f]{6}$/i.test(theme) ? theme : DEFAULTS.theme,
        themePreset: get(KEYS.themePreset, DEFAULTS.themePreset),
        opacity: num(get(KEYS.opacity, DEFAULTS.opacity), DEFAULTS.opacity, 0, 100),
        filterOn: get(KEYS.filterOn, DEFAULTS.filterOn) === '1',
        filter: get(KEYS.filter, DEFAULTS.filter),
        textFont: get(KEYS.textFont, DEFAULTS.textFont),
        codeFont: get(KEYS.codeFont, DEFAULTS.codeFont),
        bg: get(KEYS.bg, DEFAULTS.bg),
        fontScale: get(KEYS.fontScale, DEFAULTS.fontScale),
        radius: get(KEYS.radius, DEFAULTS.radius),
        aside: get(KEYS.aside, DEFAULTS.aside) !== '0',
        asidePos: get(KEYS.asidePos, DEFAULTS.asidePos) === 'left' ? 'left' : 'right',
        navAlways: get(KEYS.navAlways, DEFAULTS.navAlways) !== '0',
        rightside: get(KEYS.rightside, DEFAULTS.rightside) !== '0',
        rightsideColor: /^#[0-9a-f]{6}$/i.test(get(KEYS.rightsideColor, DEFAULTS.rightsideColor)) ? get(KEYS.rightsideColor, DEFAULTS.rightsideColor) : DEFAULTS.rightsideColor,
        universe: get(KEYS.universe, DEFAULTS.universe) !== '0',
        neon: get(KEYS.neon, DEFAULTS.neon) !== '0',
        snow: get(KEYS.snow, DEFAULTS.snow) === '1',
        fireflies: get(KEYS.fireflies, DEFAULTS.fireflies) === '1',
        ripple: get(KEYS.ripple, DEFAULTS.ripple) === '1',
        neko: get(KEYS.neko, DEFAULTS.neko) !== '0',
        cursor: get(KEYS.cursor, DEFAULTS.cursor) !== '0',
        fps: get(KEYS.fps, DEFAULTS.fps) !== '0',
        perf: get(KEYS.perf, DEFAULTS.perf),
        tier: get(KEYS.tier, DEFAULTS.tier),
        articleLayout: get(KEYS.articleLayout, '')
      }
    }
  }

  var d = w.document.documentElement
  var s = w.HGBeauty.read()

  /* 主题色 */
  var rgb = hexToRgb(s.theme)
  var channels = rgb.join(',')
  d.style.setProperty('--theme-color', s.theme)
  d.style.setProperty('--hg-appearance-color', s.theme)
  d.style.setProperty('--btn-bg', s.theme)
  d.style.setProperty('--btn-hover-color', mix(s.theme, '#ffffff', 0.22))
  d.style.setProperty('--text-bg-hover', 'rgba(' + channels + ', 0.85)')
  d.style.setProperty('--scrollbar-color', s.theme)
  d.style.setProperty('--default-bg-color', s.theme)
  d.style.setProperty('--waline-theme-color', s.theme)
  d.style.setProperty('--on-theme', ink(rgb))
  d.style.setProperty('--on-theme-away', ink(rgb) === '#ffffff' ? '#000000' : '#ffffff')

  /* 卡片不透明度 */
  d.style.setProperty('--trans-light', 'rgba(255, 255, 255, ' + (s.opacity / 100) + ')')
  d.style.setProperty('--trans-dark', 'rgba(25, 25, 25, ' + (s.opacity / 100) + ')')

  /* 背景滤镜 */
  if (s.filterOn && /^blur\([\d.]+px\) saturate\([\d.]+%\) contrast\([\d.]+%\)$/.test(s.filter)) {
    d.style.setProperty('--hg-bg-filter', s.filter)
  }
  var blurPx = (/^blur\(([\d.]+)px\)/.exec(s.filter) || [0, 0])[1]
  d.classList.toggle('hg-bg-filtered', s.filterOn)
  /* 只有真的模糊了才需要放大一圈遮住边缘；blur=0 时保持原图比例 */
  d.classList.toggle('hg-bg-blurred', s.filterOn && parseFloat(blurPx) > 0)

  /* 字体 / 字号 / 圆角 */
  d.style.setProperty('--hg-text-font', textStack(s.textFont))
  d.style.setProperty('--hg-code-font', codeStack(s.codeFont))
  d.style.setProperty('--hg-font', s.fontScale === 'large' ? '1.15' : '1')
  d.style.setProperty('--hg-radius', s.radius === 'small' ? '6px' : (s.radius === 'large' ? '18px' : '12px'))

  /* 背景图 */
  var bgCss = bgToCss(s.bg)
  if (bgCss) {
    d.style.setProperty('--hg-bg-image', bgCss)
    d.classList.add('hg-has-bg')
  }

  /* 布局与特效 */
  if (get(KEYS.aside, null) !== null) set('aside-status', s.aside ? 'show' : 'hide')
  d.style.setProperty('--hg-rightside-color', s.rightsideColor)
  d.classList.toggle('hg-rightside-off', !s.rightside)
  d.classList.toggle('hide-aside', !s.aside)
  d.classList.toggle('hg-aside-left', s.asidePos === 'left')
  d.classList.toggle('hg-nav-always', s.navAlways)
  /* 文章多栏：用户选过就覆盖构建期默认类，没选过保持 _config.yml 的结果 */
  if (s.articleLayout === '1' || s.articleLayout === '0') {
    d.classList.toggle('hg-article-multi', s.articleLayout === '1')
  }
  d.classList.toggle('hg-universe-off', !s.universe)
  d.classList.toggle('hg-neon-off', !s.neon)
})(window)
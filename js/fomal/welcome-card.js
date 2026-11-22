/*!
 * 首页侧栏：欢迎来访 + 倒计时（仅首页，pjax 往返自动重建）
 * 地区来自 ipwho.is（需在 Cookie 同意里允许「访问统计与地区显示」）；
 * 距离按桂林为本站坐标估算；诗句本地数组，按当天日期轮换，不发请求。
 */
(function (w, d) {
  'use strict'

  var HOME = { lat: 25.2802, lng: 110.2964, name: '桂林' }
  var DAY = 86400000
  var timer = null
  var geoLoaded = false

  var ZH = {
    China: '中国', 'Hong Kong': '中国香港', Macau: '中国澳门', Taiwan: '中国台湾',
    Japan: '日本', 'South Korea': '韩国', 'United States': '美国', 'United Kingdom': '英国',
    Canada: '加拿大', Australia: '澳大利亚', Singapore: '新加坡', Malaysia: '马来西亚',
    Thailand: '泰国', Vietnam: '越南', France: '法国', Germany: '德国', Russia: '俄罗斯',
    India: '印度', Philippines: '菲律宾', Indonesia: '印度尼西亚',
    Guangxi: '广西', Guangdong: '广东', Beijing: '北京', Shanghai: '上海', Zhejiang: '浙江',
    Jiangsu: '江苏', Sichuan: '四川', Hubei: '湖北', Hunan: '湖南', Fujian: '福建',
    Shandong: '山东', Henan: '河南', Hebei: '河北', Shanxi: '山西', Shaanxi: '陕西',
    Anhui: '安徽', Jiangxi: '江西', Yunnan: '云南', Guizhou: '贵州', Chongqing: '重庆',
    Tianjin: '天津', Liaoning: '辽宁', Jilin: '吉林', Heilongjiang: '黑龙江', 'Inner Mongolia': '内蒙古',
    Gansu: '甘肃', Qinghai: '青海', Ningxia: '宁夏', Xinjiang: '新疆', Tibet: '西藏',
    Hainan: '海南', Guilin: '桂林', Nanning: '南宁', Liuzhou: '柳州', Hezhou: '贺州',
    Guangzhou: '广州', Shenzhen: '深圳', Hangzhou: '杭州', Nanjing: '南京', Wuhan: '武汉',
    Chengdu: '成都', Changsha: '长沙', Xiamen: '厦门', Fuzhou: '福州', "Xi'an": '西安',
    Zhengzhou: '郑州', Suzhou: '苏州', Qingdao: '青岛', Dalian: '大连', Kunming: '昆明',
    Guiyang: '贵阳', Haikou: '海口', Sanya: '三亚', Lanzhou: '兰州', Xining: '西宁',
    Yinchuan: '银川', Urumqi: '乌鲁木齐', Hohhot: '呼和浩特', Harbin: '哈尔滨',
    Changchun: '长春', Shenyang: '沈阳', Jinan: '济南', Hefei: '合肥', Nanchang: '南昌',
    Taiyuan: '太原', Shijiazhuang: '石家庄', Lhasa: '拉萨', Wuzhou: '梧州', Beihai: '北海',
    Qinzhou: '钦州', Yulin: '玉林', Baise: '百色', Hechi: '河池', Laibin: '来宾',
    Chongzuo: '崇左', Fangchenggang: '防城港', Guigang: '贵港'
  }

  var GREETINGS = [
    [0, 5, '夜深了，早点休息呀'],
    [5, 8, '早上好，新的一天开始啦'],
    [8, 11, '上午好，记得喝口水'],
    [11, 13, '中午好，吃饭了吗'],
    [13, 17, '下午好，慢慢来'],
    [17, 19, '傍晚好，今天辛苦啦'],
    [19, 24, '晚上好，欢迎来坐坐']
  ]

  var POEMS = [
    ['海内存知己，天涯若比邻。', '王勃《送杜少府之任蜀州》'],
    ['有朋自远方来，不亦乐乎。', '《论语·学而》'],
    ['长风破浪会有时，直挂云帆济沧海。', '李白《行路难》'],
    ['但愿人长久，千里共婵娟。', '苏轼《水调歌头》'],
    ['山重水复疑无路，柳暗花明又一村。', '陆游《游山西村》'],
    ['落霞与孤鹜齐飞，秋水共长天一色。', '王勃《滕王阁序》'],
    ['行到水穷处，坐看云起时。', '王维《终南别业》'],
    ['采菊东篱下，悠然见南山。', '陶渊明《饮酒》'],
    ['星汉灿烂，若出其里。', '曹操《观沧海》'],
    ['且将新火试新茶，诗酒趁年华。', '苏轼《望江南》'],
    ['春风得意马蹄疾，一日看尽长安花。', '孟郊《登科后》'],
    ['愿君多采撷，此物最相思。', '王维《相思》']
  ]

  function $(id) { return d.getElementById(id) }
  function pad(n) { return n < 10 ? '0' + n : String(n) }
  function greeting (hour) {
    for (var i = 0; i < GREETINGS.length; i++) {
      if (hour >= GREETINGS[i][0] && hour < GREETINGS[i][1]) return GREETINGS[i][2]
    }
    return '你好呀，远道而来的朋友'
  }
  function dayOfYear (date) {
    return Math.floor((date - new Date(date.getFullYear(), 0, 0)) / DAY)
  }
  var lastPoem = -1
  function randomPoem () {
    var i = Math.floor(Math.random() * POEMS.length)
    /* 重建卡片时尽量不连着抽到同一句 */
    if (i === lastPoem && POEMS.length > 1) i = (i + 1) % POEMS.length
    lastPoem = i
    return POEMS[i]
  }
  function haversine (a, b) {
    var rad = Math.PI / 180
    var dLat = (b.lat - a.lat) * rad
    var dLng = (b.lng - a.lng) * rad
    var s = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
    return 6371 * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s))
  }

  function welcomeHTML () {
    return '<div class="card-widget hg-welcome-card wow animate__zoomIn" data-wow-duration="700ms">' +
      '<div class="card-content">' +
        '<div class="item-headline"><i class="fas fa-hand-sparkles"></i><span>欢迎来访</span></div>' +
        '<p class="hg-welcome-greet" id="hg-welcome-greet">你好呀，远道而来的朋友</p>' +
        '<p class="hg-welcome-clock" id="hg-welcome-clock"></p>' +
        '<div class="hg-welcome-meta">' +
          '<span><i class="fas fa-location-dot"></i><b id="hg-welcome-region">正在获取地区…</b></span>' +
          '<span><i class="fas fa-route"></i><span id="hg-welcome-distance">正在估算距离…</span></span>' +
        '</div>' +
        '<blockquote class="hg-welcome-poem"><p id="hg-welcome-poem"></p><cite id="hg-welcome-cite"></cite></blockquote>' +
      '</div>' +
    '</div>'
  }

  function countdownHTML () {
    var labels = ['今日', '本周', '本月', '本年']
    var rows = labels.map(function (label) {
      return '<div class="hg-cd-row">' +
        '<span class="hg-cd-label">' + label + '</span>' +
        '<span class="hg-cd-track"><i class="hg-cd-bar"></i></span>' +
        '<span class="hg-cd-pct">0%</span>' +
        '<span class="hg-cd-left"></span>' +
      '</div>'
    }).join('')
    return '<div class="card-widget hg-countdown-card wow animate__zoomIn" data-wow-duration="700ms">' +
      '<div class="card-content">' +
        '<div class="item-headline"><i class="fas fa-hourglass-half"></i><span>倒计时</span></div>' +
        '<p class="hg-cd-title">距离元旦还有 <b id="hg-cd-days">--</b> 天</p>' +
        rows +
      '</div>' +
    '</div>'
  }

  function setClock () {
    var greet = $('hg-welcome-greet')
    var clock = $('hg-welcome-clock')
    if (!greet || !clock) return
    var now = new Date()
    greet.textContent = greeting(now.getHours())
    var week = '日一二三四五六'[now.getDay()]
    clock.textContent = '现在是 ' + pad(now.getHours()) + ':' + pad(now.getMinutes()) + ' · 星期' + week
  }

  function setPoem () {
    var poem = randomPoem()
    var p = $('hg-welcome-poem')
    var cite = $('hg-welcome-cite')
    if (p) p.textContent = poem[0]
    if (cite) cite.textContent = '— ' + poem[1]
  }

  function setRegion (text, distance) {
    var region = $('hg-welcome-region')
    var dist = $('hg-welcome-distance')
    if (region) region.textContent = text
    if (dist) dist.textContent = distance
  }

  function regionText (data) {
    var parts = []
    function add (v) {
      v = String(v || '').trim()
      if (v && parts.indexOf(v) < 0) parts.push(ZH[v] || v)
    }
    add(data.country)
    add(data.region)
    add(data.city)
    return parts.length ? parts.join(' · ') : '未知地区'
  }

  function loadGeo () {
    if (geoLoaded) return
    var allowed = w.hgConsent && w.hgConsent.granted ? w.hgConsent.granted('analytics') : false
    if (!allowed) {
      setRegion('地区显示未开启', '距离信息未开启')
      var hint = $('hg-welcome-region')
      if (hint) {
        hint.title = '在 Cookie 设置中允许访问统计后显示'
        hint.style.cursor = 'pointer'
        hint.onclick = function () { if (w.hgOpenConsent) w.hgOpenConsent() }
      }
      return
    }
    geoLoaded = true
    var cached = null
    try { cached = JSON.parse(w.sessionStorage.getItem('hgGeo') || 'null') } catch (e) {}
    if (cached && cached.at && Date.now() - cached.at < 6 * 3600e3) {
      renderGeo(cached.data)
      return
    }
    fetch('https://api.ipapi.is/', { referrerPolicy: 'no-referrer' })
      .then(function (res) { return res.json() })
      .then(function (data) {
        if (!data || (data.city === null && data.country === null)) throw new Error('geo failed')
        return { country: data.country, region: data.region, city: data.city, latitude: data.lat, longitude: data.lon }
      })
      .catch(function () {
        return fetch('https://ipwho.is/?lang=zh-CN', { referrerPolicy: 'no-referrer' })
          .then(function (res) { return res.json() })
          .then(function (data) {
            if (!data || data.success === false) throw new Error('geo failed')
            return { country: data.country, region: data.region, city: data.city, latitude: data.latitude, longitude: data.longitude }
          })
      })
      .then(function (data) {
        try { w.sessionStorage.setItem('hgGeo', JSON.stringify({ at: Date.now(), data: data })) } catch (e) {}
        renderGeo(data)
      })
      .catch(function () {
        geoLoaded = false
        setRegion('地区获取失败', '--')
      })
  }

  function renderGeo (data) {
    var text = regionText(data)
    var distance = '距离未知'
    if (isFinite(data.latitude) && isFinite(data.longitude)) {
      var km = Math.round(haversine(HOME, { lat: +data.latitude, lng: +data.longitude }))
      distance = km < 5 ? '你就在' + HOME.name + '附近' : '距' + HOME.name + '约 ' + km + ' km'
    }
    setRegion(text, distance)
  }

  function pctRows (now) {
    var day = (now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()) / 86400
    var weekDay = (now.getDay() + 6) % 7
    var week = (weekDay + day) / 7
    var daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    var month = (now.getDate() - 1 + day) / daysInMonth
    var daysInYear = ((now.getFullYear() % 4 === 0 && now.getFullYear() % 100 !== 0) || now.getFullYear() % 400 === 0) ? 366 : 365
    var year = (dayOfYear(now) - 1 + day) / daysInYear
    return [
      { pct: day, left: '剩 ' + Math.ceil(24 - now.getHours() - now.getMinutes() / 60) + ' 小时' },
      { pct: week, left: '剩 ' + (7 - weekDay) + ' 天' },
      { pct: month, left: '剩 ' + (daysInMonth - now.getDate() + 1) + ' 天' },
      { pct: year, left: '剩 ' + (daysInYear - dayOfYear(now) + 1) + ' 天' }
    ]
  }

  function tick () {
    setClock()
    var now = new Date()
    var target = new Date(now.getFullYear() + 1, 0, 1)
    var days = Math.max(0, Math.ceil((target - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / DAY))
    var daysNode = $('hg-cd-days')
    if (daysNode) daysNode.textContent = String(days)
    var rows = d.querySelectorAll('.hg-countdown-card .hg-cd-row')
    var data = pctRows(now)
    for (var i = 0; i < rows.length && i < data.length; i++) {
      var pct = Math.max(0, Math.min(100, data[i].pct * 100))
      var bar = rows[i].querySelector('.hg-cd-bar')
      var label = rows[i].querySelector('.hg-cd-pct')
      var left = rows[i].querySelector('.hg-cd-left')
      if (bar) bar.style.width = pct.toFixed(1) + '%'
      if (label) label.textContent = pct.toFixed(1) + '%'
      if (left) left.textContent = data[i].left
    }
  }

  function mount () {
    if (!d.getElementById('recent-posts')) return
    var sticky = d.querySelector('#aside-content .sticky_layout')
    if (!sticky) return
    if (d.getElementById('hg-welcome-greet')) return
    var info = sticky.querySelector('.card-info')
    if (info) info.insertAdjacentHTML('afterend', welcomeHTML() + countdownHTML())
    else sticky.insertAdjacentHTML('afterbegin', welcomeHTML() + countdownHTML())
    setPoem()
    loadGeo()
    tick()
    if (timer) w.clearInterval(timer)
    timer = w.setInterval(tick, 60000)
  }

  function unmount () {
    if (timer) { w.clearInterval(timer); timer = null }
  }

  function refresh () {
    unmount()
    geoLoaded = false
    var old = d.querySelectorAll('.hg-welcome-card, .hg-countdown-card')
    for (var i = 0; i < old.length; i++) {
      if (old[i].parentNode) old[i].parentNode.removeChild(old[i])
    }
    mount()
    if (w.hgSideFillSync) w.hgSideFillSync()
  }

  w.hgWelcomeCard = { refresh: refresh }

  var pending = null
  function schedule () {
    if (pending) w.clearTimeout(pending)
    pending = w.setTimeout(function () { pending = null; refresh() }, 60)
  }

  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', mount, { once: true })
  else mount()
  ;['pjax:complete', 'pjax:success', 'pjax:end'].forEach(function (ev) { d.addEventListener(ev, schedule) })
  d.addEventListener('hg-consent-change', function (event) {
    var state = event.detail || {}
    geoLoaded = false
    if (state.analytics) loadGeo()
    else setRegion('地区显示未开启', '距离信息未开启')
  })
})(window, document)
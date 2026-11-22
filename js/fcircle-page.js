/*!
 * fcircle-page.js —— 朋友圈（/fcircle/）
 * ---------------------------------------------------------------------------
 * 数据：/fcircle/data.json（tools/fcircle.mjs 抓取友链 RSS 生成）
 * 结构：{ statistical_data: { friends_num, active_num, error_num, article_num,
 *         last_updated_time }, article_data: [{ floor, title, created, updated,
 *         link, author, avatar }] }
 * 职责：填统计数字、渲染文章卡片、按 12 条一页做「显示更多」。
 * 幂等：容器上打 data-fc-ready，pjax 往返重复执行直接 return。
 * 安全：文章标题 / 作者来自第三方 RSS，一律 textContent 写入；链接只放行 http(s)。
 */

(function () {
  'use strict';

  var DATA_URL = '/fcircle/data.json';
  var PAGE = 12;
  var FAVICON = 'https://api.favicon.im/';
  var FALLBACK_AVATAR = '/img/favicon.png';

  var cacheData = null;
  var pending = false;

  function safeUrl(u) {
    if (!u || typeof u !== 'string') return '';
    try {
      var x = new URL(u, location.origin);
      if (x.protocol === 'http:' || x.protocol === 'https:') return x.href;
    } catch (e) { /* 非法地址按空处理 */ }
    return '';
  }

  function safeImg(u) {
    if (typeof u !== 'string' || !u) return '';
    if (u.charAt(0) === '/') return u;
    return safeUrl(u);
  }

  function hostOf(url) {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch (e) {
      return '';
    }
  }

  function el(tag, cls, text) {
    var d = document.createElement(tag);
    if (cls) d.className = cls;
    if (text != null) d.textContent = text;
    return d;
  }

  function fillStats(root, stat) {
    if (!stat || typeof stat !== 'object') return;
    var pairs = [
      ['friends', stat.friends_num],
      ['active', stat.active_num],
      ['article', stat.article_num]
    ];
    pairs.forEach(function (p) {
      if (p[1] == null) return;
      [].forEach.call(root.querySelectorAll('[data-fc="' + p[0] + '"]'), function (n) {
        n.textContent = String(p[1]);
      });
    });
    var time = root.querySelector('[data-fc="time"]');
    if (time) {
      var t = stat.last_updated_time || stat.last_updated || '';
      time.textContent = t ? '数据更新于 ' + t : '数据已同步';
    }
  }

  function buildCard(item) {
    var href = safeUrl(item.link);
    if (!href) return null;

    var a = el('a', 'hg-fc-card');
    a.href = href;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.title = String(item.title || '');

    if (item.floor != null) a.appendChild(el('span', 'hg-fc-floor', 'No.' + item.floor));
    a.appendChild(el('div', 'hg-fc-card-title', String(item.title || '无标题')));

    var foot = el('div', 'hg-fc-card-foot');

    var av = el('img', 'hg-fc-avatar');
    av.src = safeImg(item.avatar) || FALLBACK_AVATAR;
    av.alt = '';
    av.loading = 'lazy';
    av.decoding = 'async';
    av.addEventListener('error', function () {
      if (av.getAttribute('src') !== FALLBACK_AVATAR) av.src = FALLBACK_AVATAR;
    });
    foot.appendChild(av);

    foot.appendChild(el('span', 'hg-fc-author', String(item.author || '匿名')));

    var date = String(item.created || item.updated || '').slice(0, 10);
    if (date) {
      var d = el('time', 'hg-fc-date', date);
      d.setAttribute('datetime', date);
      foot.appendChild(d);
    }

    var host = hostOf(href);
    if (host) {
      var badge = el('span', 'hg-fc-host');
      var fav = el('img');
      fav.src = FAVICON + encodeURIComponent(host) + '?size=32';
      fav.alt = '';
      fav.loading = 'lazy';
      fav.referrerPolicy = 'no-referrer';
      fav.addEventListener('error', function () { fav.style.display = 'none'; });
      badge.appendChild(fav);
      badge.appendChild(el('span', null, host));
      foot.appendChild(badge);
    }

    a.appendChild(foot);
    return a;
  }

  function mount(root, data) {
    var articles = Array.isArray(data.article_data) ? data.article_data.slice() : [];
    articles.sort(function (a, b) {
      return String(b.created || b.updated || '').localeCompare(String(a.created || a.updated || ''));
    });

    fillStats(root, data.statistical_data);

    var grid = root.querySelector('#hg-fc-grid');
    var state = root.querySelector('#hg-fc-state');
    var moreBtn = root.querySelector('#hg-fc-more');
    if (!grid) return;

    grid.textContent = '';
    var shown = 0;

    function showState(msg) {
      if (!state) return;
      state.textContent = msg;
      state.hidden = !msg;
    }

    function renderChunk() {
      var end = Math.min(shown + PAGE, articles.length);
      for (var i = shown; i < end; i++) {
        var card = buildCard(articles[i]);
        if (card) grid.appendChild(card);
      }
      shown = end;
      if (moreBtn) {
        var left = articles.length - shown;
        moreBtn.hidden = left <= 0;
        moreBtn.textContent = left > 0 ? '显示更多（还有 ' + left + ' 篇）' : '显示更多';
      }
    }

    if (!articles.length) {
      showState('暂时没有抓到友链的新文章，过几天再来看看吧。');
    } else {
      showState('');
      renderChunk();
    }

    if (moreBtn && moreBtn.getAttribute('data-fc-bound') !== '1') {
      moreBtn.setAttribute('data-fc-bound', '1');
      moreBtn.addEventListener('click', function () { renderChunk(); });
    }

    root.setAttribute('data-fc-ready', '1');
  }

  function init() {
    var root = document.querySelector('.hg-fc');
    if (!root || root.getAttribute('data-fc-ready') === '1') return;

    var state = root.querySelector('#hg-fc-state');

    if (cacheData) {
      mount(root, cacheData);
      return;
    }
    if (pending) return;
    pending = true;

    fetch(DATA_URL, { credentials: 'same-origin' })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (data) {
        pending = false;
        cacheData = data || {};
        if (!document.documentElement.contains(root)) return;
        mount(root, cacheData);
      })
      .catch(function () {
        pending = false;
        if (state && document.documentElement.contains(root)) {
          state.textContent = '数据加载失败，请刷新页面重试。';
          state.hidden = false;
        }
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  ['pjax:complete', 'pjax:success', 'pjax:end'].forEach(function (ev) {
    document.addEventListener(ev, function () { setTimeout(init, 0); });
  });
  window.addEventListener('pageshow', function (e) { if (e.persisted) init(); });
})();
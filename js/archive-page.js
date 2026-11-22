/*!
 * archive-page.js —— 归档页卡片改版（站点独立脚本，不改主题源码）
 * ---------------------------------------------------------------------------
 * 参考：../my-blog/source/js/inject/archive-page.js（Fomalhaut 主题同一套思路）
 * 作用页：/archives/ 与分页 /archives/page/N/，以及按年 / 按月归档 /archives/YYYY/、
 *         /archives/YYYY/MM/ —— 只要页面内容根是 #archive 就生效，分类页 / 标签页不动。
 * 职责：只读主题渲染好的 .article-sort DOM，就地重排成
 *       概览统计条 + 年份吸顶跳转 + 年份章节（可折叠）+ 响应式卡片栅格。
 *       不发起任何网络请求（分类 / 阅读时长来自构建期的 #ar-index，见 scripts/archive-index.js）。
 *
 * 守卫：确认「页面只有一个 .article-sort」且「至少有一篇文章」后才给容器加 .ar-ready；
 *       archive-page.css 里的选择器全部以 .ar-ready 开头，任一环节不成立就整块失效、页面原样。
 * 幂等：容器上打 data-ar-archive，重复执行（pjax 往返）直接 return。
 * 降级：ar-index 缺失（脚本没生效 / 被过滤）时照常排版，只是卡片不显示分类与阅读时长。
 *
 * 本站适配点（与参考实现的差异）：
 *   - 本站 permalink 是 :year/:month/:day/:title/，文章链接不带 .html；索引键统一按
 *     「路径后缀」匹配（见 normPath + lookup），不做整串比较，也不依赖某个固定前缀。
 *   - 本站夜间模式是 [data-theme="dark"]（主题切的是 html 的 data-theme），参考实现用 .dark；
 *     配色全部走 CSS 变量派生，这里只在 JS 里补一点跟"时刻"有关的细节。
 *   - 顶栏（#nav）只在滚过一定距离后才变成 fixed，吸顶偏移要跟着变，用 MutationObserver 盯
 *     #page-header 的 class 来同步 --ar-nav-h。
 */

(function () {
  'use strict';

  /** pjax 往返共用：正在监听的 #page-header，以及最新一份吸顶偏移计算函数。 */
  var watchingHdr = null;
  var refreshNavH = null;
  /** 滚动监听只挂一次（pjax 往返会重复 init，但监听器不能重复叠加）。 */
  var scrollBound = false;
  /** 年份标题投影用的 IntersectionObserver（pjax 往返要换新的，旧的要 disconnect）。 */
  var shadowObs = null;

  var CHEV = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"></polyline></svg>';

  /* ---------------------------------------------------------------- 小工具 */

  function el(tag, cls, text) {
    var d = document.createElement(tag);
    if (cls) d.className = cls;
    if (text != null) d.textContent = text;
    return d;
  }

  /** 原图地址：主题的懒加载把真图放在 data-lazy-src / data-src 里（src 是占位 gif）。 */
  function realSrc(img) {
    if (!img) return '';
    var lazy = img.getAttribute('data-lazy-src') || img.getAttribute('data-src') || '';
    var src = lazy || img.getAttribute('src') || '';
    return src.indexOf('data:image') === 0 ? '' : src;
  }

  /** 把 href 收敛成「站点内相对路径」：去 origin / 去 query / 去 # / 去前后多余 /。 */
  function normPath(href) {
    if (!href) return '';
    var s = href;
    if (s.indexOf('://') > -1) {
      try { s = new URL(href, location.href).pathname; } catch (e) { /* 交回原串 */ }
    }
    s = s.split('#')[0].split('?')[0];
    return s.replace(/^\/+/, '').replace(/\/+$/, '');
  }

  /**
   * 在当前页里找这篇文章的链接：先比整段路径，再退而比「本页链接是索引键的后缀」，
   * 这样索引键不管带不带前导 /、带不带站点子目录，都能对上。
   */
  function lookup(index, pagePath) {
    if (!pagePath) return null;
    if (index[pagePath]) return index[pagePath];
    var keys = Object.keys(index);
    for (var i = 0; i < keys.length; i++) {
      var k = normPath(keys[i]);
      if (!k) continue;
      if (pagePath === k) return index[keys[i]];
      if (k.length > pagePath.length && k.slice(-pagePath.length - 1) === '/' + pagePath) return index[keys[i]];
      if (pagePath.length > k.length && pagePath.slice(-k.length - 1) === '/' + k) return index[keys[i]];
    }
    return null;
  }

  function getJSON(id) {
    try {
      var node = document.getElementById(id);
      if (!node) return null;
      return JSON.parse(node.textContent || node.innerHTML || 'null');
    } catch (e) {
      return null; // 解析失败按「没有数据」处理，排版照常
    }
  }

  /** 索引里每篇文章用短键存：t 标题 / p 路径 / d 日期 / c 分类 / g 标签 / w 字数 / r 阅读分钟。 */
  function metaOf(m) {
    if (!m || typeof m !== 'object') return null;
    return {
      title: String(m.t || m.title || ''),
      path: String(m.p || m.path || ''),
      date: String(m.d || m.date || ''),
      cat: String(m.c || m.cat || m.category || ''),
      tags: Array.isArray(m.g || m.tags) ? (m.g || m.tags) : [],
      words: Number(m.w || m.words || 0) || 0,
      read: Number(m.r || m.read || 0) || 0
    };
  }

  function pad2(n) { return n < 10 ? '0' + n : String(n); }

  /** 当天日期字符串 YYYY-MM-DD（与索引里的 d 同格式）。 */
  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  /** 距今天：0 天 → 今天，1 天 → 昨天，N 天 → N 天前；日期在未来返回空串。 */
  function agoText(dateStr, todayStr) {
    if (!dateStr || !todayStr) return '';
    var a = Date.parse(dateStr + 'T00:00:00');
    var b = Date.parse(todayStr + 'T00:00:00');
    if (isNaN(a) || isNaN(b) || a > b) return '';
    var days = Math.round((b - a) / 864e5);
    if (days === 0) return '今天';
    if (days === 1) return '昨天';
    return days + ' 天前';
  }

  /** 每条卡片的空封面占位字符：优先用分类首字，没有分类就用标题首字。 */
  function placeholderChar(meta, title) {
    var src = (meta && meta.cat) || (title || '文').trim();
    return src.charAt(0);
  }

  /* ---------------------------------------------------------------- 主流程 */

  function init() {
    var root = document.getElementById('archive');
    if (!root || root.getAttribute('data-ar-archive') === '1') return;
    if (root.querySelectorAll('.article-sort').length !== 1) return;

    var list = root.querySelector('.article-sort');
    if (!list) return;
    var items = [].slice.call(list.querySelectorAll('.article-sort-item'));
    var cards = items.filter(function (n) { return n.className.indexOf('year') === -1; });
    if (cards.length < 1) return;

    var indexData = getJSON('ar-index') || {};
    var index = indexData.posts || {};
    var todayStr = today();
    root.setAttribute('data-ar-archive', '1');

    /** 吸顶偏移：主题导航栏变 fixed 后给它留出高度，吸顶元素才不会压在它下面。 */
    function navH() {
      var nav = document.getElementById('nav');
      var h = 0;
      if (nav) {
        var st = window.getComputedStyle(nav);
        if (st && st.position === 'fixed') h = nav.offsetHeight || 0;
      }
      return h;
    }

    /* ---- 1. 逐条改造成卡片 ---- */
    var cardPaths = [];
    cards.forEach(function (item) {
      var titleLink = item.querySelector('.article-sort-item-title');
      var imgLink = item.querySelector('.article-sort-item-img');
      var img = imgLink ? imgLink.querySelector('img') : null;
      var info = item.querySelector('.article-sort-item-info');
      var time = item.querySelector('time');
      if (!titleLink || !info) return;

      var pagePath = normPath(titleLink.getAttribute('href') ||
        (imgLink && imgLink.getAttribute('href')) || '');
      var meta = metaOf(lookup(index, pagePath));
      cardPaths.push(pagePath);

      var dateStr = '';
      if (meta && meta.date) dateStr = meta.date;
      else if (time && time.getAttribute('datetime')) dateStr = String(time.getAttribute('datetime')).slice(0, 10);
      item.setAttribute('data-ar-date', dateStr);

      item.classList.add('ar-card');
      if (!imgLink) item.classList.add('ar-nocover');

      /** 无封面占位：分类首字 + 主题色光晕，复用 .ar-cover 样式。 */
      function makePlaceholder() {
        var ph = el('div', 'ar-cover');
        ph.appendChild(el('span', 'ar-cover-char', placeholderChar(meta, titleLink.textContent)));
        return ph;
      }
      /** 真图加载失败（图床挂了 / 离线）时退回占位，别让卡片顶部留一块空白。 */
      function dropCover() {
        if (item.getAttribute('data-ar-ph') === '1') return;
        item.setAttribute('data-ar-ph', '1');
        item.classList.add('ar-nocover');
        var ph = makePlaceholder();
        if (imgLink && imgLink.parentNode) imgLink.parentNode.replaceChild(ph, imgLink);
        else item.insertBefore(ph, item.firstChild);
      }

      /* 封面：懒加载图（src 还是占位）直接补上真图，不依赖 LazyLoad 的扫描时机。
         封面必须是卡片的第一个子节点（CSS 用 > a.article-sort-item-img 选它）。 */
      if (imgLink) {
        if (img) {
          var real = realSrc(img);
          if (real) {
            img.setAttribute('src', real);
            img.setAttribute('loading', 'lazy');
            img.setAttribute('decoding', 'async');
          }
          if (!real || /^data:image/.test(img.getAttribute('src') || '')) {
            item.classList.add('ar-nocover');
          } else {
            img.addEventListener('error', dropCover);
          }
        } else {
          item.classList.add('ar-nocover');
        }
        item.insertBefore(imgLink, item.firstChild);
        if (item.classList.contains('ar-nocover')) dropCover();
      } else {
        item.insertBefore(makePlaceholder(), item.firstChild);
      }

      /* 第一行：分类胶囊 + 标题 */
      var head = el('div', 'ar-head');
      if (meta && meta.cat) {
        var catA = el('a', 'ar-cat');
        catA.setAttribute('href', '/categories/' + encodeURIComponent(meta.cat) + '/');
        catA.setAttribute('title', '分类：' + meta.cat);
        catA.setAttribute('data-cat', meta.cat);
        catA.setAttribute('aria-label', '分类：' + meta.cat);
        head.appendChild(catA);
      }
      head.appendChild(titleLink);

      /* 第二行：标签（有就显示）——主题 DOM 里没有标签，只能从索引补 */
      var tagsRow = null;
      if (meta && meta.tags.length) {
        tagsRow = el('div', 'ar-tags');
        meta.tags.slice(0, 3).forEach(function (t) {
          var s = el('span', 'ar-tag', String(t));
          s.setAttribute('title', '标签：' + t);
          tagsRow.appendChild(s);
        });
      }

      /* 第三行：日期 + 相对时间 + 阅读时长 */
      var foot = el('div', 'ar-foot');
      if (time) {
        var timeBox = time.closest('.article-sort-item-time') || time.parentNode;
        foot.appendChild(timeBox);
      }
      var ago = agoText(dateStr, todayStr);
      if (ago) foot.appendChild(el('span', 'ar-ago', ago));
      if (meta && meta.read) foot.appendChild(el('span', 'ar-read', '约 ' + meta.read + ' 分钟'));

      info.appendChild(head);
      if (tagsRow) info.appendChild(tagsRow);
      info.appendChild(foot);

      /* 整卡可点（标题 / 封面仍是独立链接，可新窗口打开、可被爬虫抓） */
      var hit = el('a', 'ar-hit');
      hit.setAttribute('href', titleLink.getAttribute('href') || pagePath);
      hit.setAttribute('aria-label', (titleLink.textContent || '').trim());
      item.appendChild(hit);
    });

    /* ---- 2. 全站口径：优先用构建期写进页面的索引，缺了就退化为当前页 ---- */
    var allMeta = Object.keys(index).map(function (k) { return metaOf(index[k]); }).filter(Boolean);
    var byYear = {};
    var byMonth = {};
    var catCount = {};

    allMeta.forEach(function (p) {
      var y = p.date ? String(p.date).slice(0, 4) : '';
      if (/^\d{4}$/.test(y)) {
        byYear[y] = (byYear[y] || 0) + 1;
        var ym = String(p.date).slice(0, 7);
        byMonth[ym] = (byMonth[ym] || 0) + 1;
      }
      if (p.cat) catCount[p.cat] = (catCount[p.cat] || 0) + 1;
    });

    /* 总数：优先索引里的 total，其次页面标题里的「全部文章 - N」，最后用当前页条数 */
    var titleEl = root.querySelector('.article-sort-title');
    var total = Number(indexData.total) || allMeta.length || cards.length;
    if (titleEl) {
      var m = String(titleEl.textContent || '').match(/(\d[\d,]*)\s*$/);
      if (m) {
        var n = parseInt(m[1].replace(/,/g, ''), 10);
        if (n > 0 && !allMeta.length) total = n;
      }
    }

    var yearKeys = Object.keys(byYear).sort();
    var longestYear = '';
    var longestCount = 0;
    yearKeys.forEach(function (y) {
      if (byYear[y] > longestCount) { longestCount = byYear[y]; longestYear = y; }
    });

    /* ---- 3. 概览统计条：年度分布柱 + 关键数字（替代原来孤零零的一行标题）---- */
    var dist = el('div', 'ar-dist');
    var dHead = el('div', 'ar-dist-head');

    var titleBox = el('div', 'ar-dist-titles');
    titleBox.appendChild(el('span', 'ar-dist-title', '年度分布'));
    var summary = '共 ' + total + ' 篇';
    if (yearKeys.length > 1) {
      summary += ' · ' + yearKeys[0] + '–' + yearKeys[yearKeys.length - 1] +
        ' · ' + longestYear + ' 年最多（' + longestCount + ' 篇）';
    }
    if (!allMeta.length) summary += '（当前页口径）';
    titleBox.appendChild(el('span', 'ar-dist-sum', summary));
    dHead.appendChild(titleBox);

    /* 关键数字：覆盖年份 / 累计月数 / 分类数（全站口径） */
    var stats = el('dl', 'ar-stats');
    [
      ['年份', yearKeys.length + ' 年'],
      ['跨度', Object.keys(byMonth).length + ' 个月'],
      ['分类', Object.keys(catCount).length + ' 个']
    ].forEach(function (pair) {
      var cell = el('div', 'ar-stat');
      cell.appendChild(el('dd', null, pair[1]));
      cell.appendChild(el('dt', null, pair[0]));
      stats.appendChild(cell);
    });
    dHead.appendChild(stats);
    dist.appendChild(dHead);

    if (yearKeys.length) {
      /* 跨年太多（>8 年）时只画有文章的年份，避免一整排空柱子 */
      var axis = [];
      var spanYears = Number(yearKeys[yearKeys.length - 1]) - Number(yearKeys[0]);
      if (spanYears >= 0 && spanYears <= 7) {
        for (var yi = 0; yi <= spanYears; yi++) axis.push(String(Number(yearKeys[0]) + yi));
      } else {
        axis = yearKeys.slice();
      }
      var bars = el('div', 'ar-bars');
      axis.forEach(function (y) {
        var c = byYear[y] || 0;
        var col = el('div', 'ar-bar-col' + (c ? '' : ' is-zero'));
        col.setAttribute('title', y + ' 年 · ' + c + ' 篇');
        var track = el('div', 'ar-bar-track');
        var bar = el('div', 'ar-bar');
        bar.style.height = (c ? Math.max(8, Math.round((c / longestCount) * 100)) : 3) + '%';
        track.appendChild(bar);
        col.appendChild(track);
        col.appendChild(el('span', 'ar-bar-n', String(c)));
        col.appendChild(el('span', 'ar-bar-y', y));
        bars.appendChild(col);
      });
      dist.appendChild(bars);
    }
    if (titleEl && titleEl.parentNode) titleEl.parentNode.insertBefore(dist, titleEl.nextSibling);

    /* ---- 4. 按年份切段 ---- */
    var wrap = list.parentNode; // #archive
    var afterList = list.nextSibling;
    var sections = [];

    /** 造一个年份章节：吸顶标题（大号年份 + 篇数 + 折叠按钮）+ 卡片栅格。 */
    function openSection(year, nodes) {
      var sec = el('section', 'ar-year');
      sec.id = 'archive-y' + year;
      sec.setAttribute('data-year', year);

      var label = el('div', 'ar-year-label');
      label.appendChild(el('span', 'ar-year-num', year));
      label.appendChild(el('span', 'ar-year-count', nodes.length + ' 篇'));
      label.appendChild(el('span', 'ar-year-rule'));

      var toggle = el('button', 'ar-year-toggle');
      toggle.type = 'button';
      toggle.innerHTML = CHEV + '收起';
      toggle.setAttribute('aria-label', '收起或展开 ' + year + ' 年的文章');
      label.appendChild(toggle);
      sec.appendChild(label);

      var collapse = el('div', 'ar-collapse');
      var grid = el('div', 'ar-cards');
      nodes.forEach(function (n) { grid.appendChild(n); });
      collapse.appendChild(grid);
      sec.appendChild(collapse);

      wrap.insertBefore(sec, afterList);

      var ref = { year: year, sec: sec, grid: grid, collapse: collapse, toggle: toggle };
      label.addEventListener('click', function (ev) {
        var t = ev.target;
        if (t && (t.closest('.ar-year-toggle') || t.closest('a'))) return;
        setCollapsed(ref, !ref.sec.classList.contains('collapsed'));
      });
      toggle.addEventListener('click', function () {
        setCollapsed(ref, !ref.sec.classList.contains('collapsed'));
      });
      sections.push(ref);
    }

    // 主题的年份分隔器已不需要（年份由章节标题承担），先摘掉
    items.forEach(function (node) {
      if (node.classList.contains('year') && node.parentNode) node.parentNode.removeChild(node);
    });

    // 按 DOM 顺序把卡片聚成年份分组
    var grouped = [];
    cards.forEach(function (node) {
      var y = (node.getAttribute('data-ar-date') || '').slice(0, 4);
      if (!/^\d{4}$/.test(y)) y = '其他';
      if (!grouped.length || grouped[grouped.length - 1].year !== y) grouped.push({ year: y, nodes: [] });
      grouped[grouped.length - 1].nodes.push(node);
    });
    grouped.forEach(function (g) { openSection(g.year, g.nodes); });

    // 卡片都搬走后，剩下的是空的 .article-sort，一并清掉
    if (list.parentNode && !list.querySelector('.article-sort-item')) {
      list.parentNode.removeChild(list);
    }

    /* ---- 5. 折叠状态（localStorage 记忆，按站点 + 年份记） ---- */
    var KEY = 'ar-collapsed-years';
    function readCollapsed() {
      try { return JSON.parse(localStorage.getItem(KEY) || '[]') || []; } catch (e) { return []; }
    }
    function writeCollapsed(arr) {
      try { localStorage.setItem(KEY, JSON.stringify(arr.slice(0, 40))); } catch (e) { /* 隐私模式下会抛 */ }
    }
    function setCollapsed(ref, on) {
      ref.sec.classList.toggle('collapsed', !!on);
      ref.toggle.innerHTML = CHEV + (on ? '展开' : '收起');
      ref.toggle.setAttribute('aria-expanded', on ? 'false' : 'true');
      var arr = readCollapsed().filter(function (y) { return y !== ref.year; });
      if (on) arr.push(ref.year);
      writeCollapsed(arr);
    }
    var saved = readCollapsed();
    sections.forEach(function (ref) {
      if (saved.indexOf(ref.year) !== -1) setCollapsed(ref, true);
    });

    /* ---- 6. 年份吸顶跳转 + 当前年份高亮 ---- */
    var lockUntil = 0;
    var currentYear = '';
    var chips = {};

    function setActive(year) {
      if (year === currentYear) return;
      currentYear = year;
      sections.forEach(function (ref) {
        if (chips[ref.year]) chips[ref.year].classList.toggle('on', ref.year === year);
      });
      /* 只把选中年份在胶囊条里横向居中，绝不让它带动整页滚动：
         本站全局有 scroll-behavior / scroll-padding 之类的滚动相关样式，
         scrollIntoView 会让页面一顿一顿地抖，这里只动胶囊条自己的 scrollLeft。 */
      var chip = chips[year];
      var track = chip && chip.parentNode;
      if (!chip || !track) return;
      if (track.scrollWidth <= track.clientWidth + 1) return;
      var cr = chip.getBoundingClientRect();
      var tr = track.getBoundingClientRect();
      var delta = cr.left - tr.left - (track.clientWidth - cr.width) / 2;
      if (Math.abs(delta) < 1) return;
      try {
        track.scrollBy({ left: delta, behavior: 'smooth' });
      } catch (e) {
        track.scrollLeft += delta;
      }
    }

    function pick() {
      if (Date.now() < lockUntil) return;
      var line = navH() + 130;
      var found = sections.length ? sections[0].year : '';
      for (var i = 0; i < sections.length; i++) {
        if (sections[i].sec.getBoundingClientRect().top <= line) found = sections[i].year;
      }
      setActive(found);
    }

    if (sections.length > 1) {
      var nav = el('nav', 'ar-nav');
      nav.setAttribute('aria-label', '按年份跳转');
      nav.appendChild(el('span', 'ar-nav-label', '年份'));
      var track = el('div', 'ar-nav-track');
      nav.appendChild(track);
      sections.forEach(function (ref) {
        var a = el('a', 'ar-chip', ref.year);
        a.setAttribute('href', '#' + ref.sec.id);
        a.setAttribute('data-year', ref.year);
        a.addEventListener('click', function (ev) {
          ev.preventDefault();
          lockUntil = Date.now() + 900;
          setActive(ref.year);
          /* 目标被折叠时先展开，否则滚过去只有一行标题 */
          if (ref.sec.classList.contains('collapsed')) setCollapsed(ref, false);
          var line = navH() + 64;
          var top = ref.sec.getBoundingClientRect().top + window.pageYOffset - line;
          try { window.scrollTo({ top: top, behavior: 'smooth' }); } catch (e) { window.scrollTo(0, top); }
        });
        track.appendChild(a);
        chips[ref.year] = a;
      });
      if (dist.parentNode) dist.parentNode.insertBefore(nav, dist.nextSibling);
      setActive(sections[0].year);
    }

    if (sections.length && !scrollBound) {
      scrollBound = true;
      var ticking = false;
      window.addEventListener('scroll', function () {
        if (ticking || !document.querySelector('#archive.ar-ready .ar-nav')) return;
        ticking = true;
        requestAnimationFrame(function () {
          ticking = false;
          if (typeof refreshPick === 'function') refreshPick();
        });
      }, { passive: true });
    }
    refreshPick = pick;

    root.classList.add('ar-ready');
    if (sections.length > 1) pick();

    /* ---- 7. 吸顶偏移：顶栏变 fixed 的那一刻就要更新，不能只在 init 时算一次 ---- */
    var navHLast = -1;
    var barHLast = -1;
    function applyNavH() {
      var h = navH();
      if (h !== navHLast) {
        navHLast = h;
        root.style.setProperty('--ar-nav-h', h + 'px');
      }
      var bar = root.querySelector('.ar-nav');
      var bh = bar ? Math.round(bar.getBoundingClientRect().height + 2) : 0;
      if (bh > 0 && bh !== barHLast) {
        barHLast = bh;
        root.style.setProperty('--ar-bar-h', bh + 'px');
      }
    }
    applyNavH();
    window.addEventListener('resize', applyNavH);
    refreshNavH = applyNavH;

    /* 年份标题自身的吸顶位置永远紧跟胶囊条（胶囊条高度写在 --ar-bar-h 上）。
       胶囊条只在「页面顶部」吸顶，滚过它之后只剩标题在吸，
       这时给 #archive 加 .ar-nav-parked：CSS 把标题的 top 从
       nav + bar 收到 nav，中间那一截空白就没了。 */
    var parked = null;
    function applyParked() {
      var bar = root.querySelector('.ar-nav');
      if (!bar) return;
      var stickTop = parseFloat(window.getComputedStyle(bar).top) || 0;
      var next = bar.getBoundingClientRect().top <= stickTop + 1 ? '1' : '0';
      if (next !== parked) {
        parked = next;
        root.classList.toggle('ar-nav-parked', next === '1');
      }
    }
    applyParked();

    /* 年份标题滚到胶囊条底下时给一层投影，卡片从标题下钻过去才看得清分界 */
    var headers = [].slice.call(root.querySelectorAll('.ar-year-label'));
    if (headers.length) {
      if (shadowObs) shadowObs.disconnect();
      var labelObs = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          var top = parseFloat(window.getComputedStyle(en.target).top) || 0;
          en.target.classList.toggle('is-stuck', en.isIntersecting && en.boundingClientRect.top <= top + 1);
        });
      }, { rootMargin: '-1px 0px 0px 0px', threshold: [0, 1] });
      headers.forEach(function (h) { labelObs.observe(h); });
      shadowObs = labelObs;
    }

    if (!scrollBound) {
      var ticking2 = false;
      window.addEventListener('scroll', function () {
        if (ticking2) return;
        ticking2 = true;
        requestAnimationFrame(function () {
          ticking2 = false;
          applyParked();
        });
      }, { passive: true });
    }

    var hdr = document.getElementById('page-header');
    if (hdr && window.MutationObserver && watchingHdr !== hdr) {
      watchingHdr = hdr;
      new MutationObserver(function () {
        if (refreshNavH) refreshNavH();
      }).observe(hdr, { attributes: true, attributeFilter: ['class'] });
    }

    // 让 LazyLoad 重新登记封面（我们把 src 直接补成了真图）
    if (window.lazyLoadInstance && typeof window.lazyLoadInstance.update === 'function') {
      try { window.lazyLoadInstance.update(); } catch (e) { /* 无 lazyLoad 时忽略 */ }
    }
  }

  /** 滚动回调统一走这里（pjax 往返后 pick 会被换成新一份）。 */
  var refreshPick = null;

  /* 首屏 + pjax 往返（主题是 pjax 站内跳转），init 幂等 */
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

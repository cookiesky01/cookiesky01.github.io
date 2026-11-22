/*!
 * time-timeline.js —— 旧时光页按年份分类（参考 fomal.cc 的旧时光版面）
 * ---------------------------------------------------------------------------
 * 作用页：页面正文根 #article-container 里只有一个 .timeline 的时间轴页。
 * 职责：只读主题 timeline 标签渲染好的 DOM，就地补年份分隔器、年份跳转胶囊与
 *       每条记录的锚点，并把日期标题拆成「年份 + 月日」；正文一个字不动。
 * 守卫：任一日期解析失败、或年份不足 2 个时整块不生效，页面保持主题原样。
 * 幂等：容器打 data-hg-tl，pjax 往返重复执行直接 return。
 */

(function () {
  'use strict';

  var CHIP_OFFSET = 88;

  function pad(value) {
    return String(value).length < 2 ? '0' + value : String(value);
  }

  function parseDate(text) {
    var matched = /(\d{4})-(\d{1,2})-(\d{1,2})/.exec(String(text || ''));
    if (!matched) return null;
    return {
      year: matched[1],
      md: pad(matched[2]) + '-' + pad(matched[3]),
      date: matched[1] + '-' + pad(matched[2]) + '-' + pad(matched[3])
    };
  }

  function countEntries(item) {
    var content = item.querySelector('.timeline-item-content');
    if (!content) return 0;
    var items = content.querySelectorAll(':scope > ol > li, :scope > ul > li');
    return items.length || content.querySelectorAll('li').length;
  }

  function make(tag, className, text) {
    var el = document.createElement(tag);
    if (className) el.className = className;
    if (text != null) el.textContent = text;
    return el;
  }

  function uniqueId(id) {
    var value = id;
    var index = 2;
    while (document.getElementById(value)) {
      value = id + '-' + index;
      index += 1;
    }
    return value;
  }

  function findTimeline(container) {
    var found = null;
    Array.prototype.forEach.call(container.children, function (el) {
      if (found || !el.classList || !el.classList.contains('timeline')) return;
      found = el;
    });
    return found;
  }

  function init() {
    var container = document.getElementById('article-container');
    if (!container) return;

    var timeline = findTimeline(container);
    if (!timeline || timeline.getAttribute('data-hg-tl')) return;

    var headline = null;
    var items = [];
    Array.prototype.forEach.call(timeline.children, function (el) {
      if (!el.classList || !el.classList.contains('timeline-item')) return;
      if (el.classList.contains('headline')) headline = el;
      else items.push(el);
    });
    if (items.length < 2) return;

    var entries = [];
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var title = item.querySelector('.timeline-item-title .item-circle > p') ||
        item.querySelector('.timeline-item-title p');
      var info = title ? parseDate(title.textContent) : null;
      if (!info) return;
      entries.push({ el: item, title: title, info: info, count: countEntries(item) });
    }

    var years = [];
    var groups = {};
    entries.forEach(function (entry) {
      var year = entry.info.year;
      if (!groups[year]) {
        groups[year] = [];
        years.push(year);
      }
      groups[year].push(entry);
    });
    if (years.length < 2) return;

    timeline.setAttribute('data-hg-tl', '1');
    timeline.classList.add('hg-tl');

    var total = 0;
    var daysByYear = {};
    var allDates = {};
    entries.forEach(function (entry) {
      total += entry.count;
      allDates[entry.info.date] = 1;
      if (!daysByYear[entry.info.year]) daysByYear[entry.info.year] = {};
      daysByYear[entry.info.year][entry.info.date] = 1;
    });
    var sortedDates = Object.keys(allDates).sort();
    var firstDate = sortedDates[0];
    var lastDate = sortedDates[sortedDates.length - 1];
    var spanDays = 0;
    var from = Date.parse(firstDate + 'T00:00:00');
    var to = Date.parse(lastDate + 'T00:00:00');
    if (isFinite(from) && isFinite(to) && to > from) {
      spanDays = Math.round((to - from) / 86400000);
    }

    entries.forEach(function (entry) {
      entry.el.classList.add('hg-tl-item');
      entry.el.id = uniqueId('tl-' + entry.info.date);
      entry.title.textContent = '';
      entry.title.classList.add('hg-tl-date');
      entry.title.appendChild(make('span', 'hg-tl-date-y', entry.info.year));
      entry.title.appendChild(make('span', 'hg-tl-date-md', entry.info.md));
    });

    var countsByYear = {};
    years.forEach(function (year, index) {
      var list = groups[year];
      var count = 0;
      list.forEach(function (entry) { count += entry.count; });
      countsByYear[year] = count;

      var separator = make('div', 'hg-tl-year' + (index === 0 ? ' hg-tl-year--now' : ''));
      separator.id = 'tl-year-' + year;
      separator.appendChild(make('span', 'hg-tl-year-num', year));
      separator.appendChild(make('span', 'hg-tl-year-meta',
        Object.keys(daysByYear[year]).length + ' 天 · ' + count + ' 条记录'));
      separator.appendChild(make('i', 'hg-tl-year-line'));
      timeline.insertBefore(separator, list[0].el);
    });

    if (headline) {
      var head = make('div', 'hg-tl-head');
      var meta = make('p', 'hg-tl-meta');
      meta.innerHTML = '从 <b>' + firstDate + '</b> 记到 <b>' + lastDate + '</b>' +
        (spanDays > 0 ? ' · 历时 <b>' + spanDays + '</b> 天' : '') +
        ' · 更新 <b>' + sortedDates.length + '</b> 天' +
        ' · 共 <b>' + total + '</b> 条记录' +
        ' · 横跨 <b>' + years.length + '</b> 个年份';
      head.appendChild(meta);

      var chips = make('nav', 'hg-tl-chips');
      chips.setAttribute('aria-label', '按年份跳转');
      years.forEach(function (year) {
        var chip = make('a', 'hg-tl-chip');
        chip.href = '#tl-year-' + year;
        chip.title = year + ' 年 · ' + Object.keys(daysByYear[year]).length + ' 天 · ' +
          countsByYear[year] + ' 条记录';
        chip.appendChild(make('b', '', year));
        chip.appendChild(make('span', '', countsByYear[year] + ' 条'));
        var track = make('span', 'hg-tl-track');
        var bar = make('span', 'hg-tl-bar');
        bar.style.width = (total ? Math.round(countsByYear[year] / total * 1000) / 10 : 0) + '%';
        track.appendChild(bar);
        chip.appendChild(track);
        chips.appendChild(chip);
      });
      head.appendChild(chips);
      headline.appendChild(head);
    }

    timeline.addEventListener('click', function (event) {
      var link = event.target.closest ? event.target.closest('a.hg-tl-chip') : null;
      if (!link || !timeline.contains(link)) return;
      var id = (link.getAttribute('href') || '').slice(1);
      var target = id ? document.getElementById(id) : null;
      if (!target) return;

      event.preventDefault();
      var top = target.getBoundingClientRect().top +
        (window.pageYOffset || document.documentElement.scrollTop || 0) - CHIP_OFFSET;
      var reduce = window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      try {
        window.scrollTo({ top: top, behavior: reduce ? 'auto' : 'smooth' });
      } catch (err) {
        window.scrollTo(0, top);
      }
      try {
        history.replaceState(null, '', '#' + id);
      } catch (err) {}
    });
  }

  function boot() {
    setTimeout(init, 30);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
  document.addEventListener('pjax:complete', boot);
})();

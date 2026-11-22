/*!
 * about-page.js —— 关于页「本站信息与线路检测」、RSS 复制
 * ---------------------------------------------------------------------------
 * 线路检测只请求本站入口（首页、评论服务、RSS）与两条备用线路，不向第三方上报。
 * 接入网络信息来自浏览器的 Network Information API；本机参数只读取本地
 * 屏幕 / CPU / 内存 / 语言 / 性能等 API，全部只显示在当前页面，不做上传或存储。
 * 幂等：容器打 data-bound，pjax 往返重复执行直接 return。
 */

(function () {
  'use strict';

  var SITE = 'https://cookiesky.cn/';
  var SITE_ORIGIN = SITE.replace(/\/$/, '');
  var SITE_BIRTH = new Date('2024-05-20T14:11:00+08:00').getTime();
  var TIMEOUT = 8000;
  var running = false;

  var MIRRORS = [
    { key: 'github', url: 'https://github.cookiesky.cn/' },
    { key: 'vercel', url: 'https://vercel.cookiesky.cn/' }
  ];

  var SITE_STATE = {
    slow: 2500
  };

  function tell(msg) {
    if (typeof window.fomalNotify === 'function') {
      window.fomalNotify({ type: 'success', message: msg, duration: 2500 });
    }
  }

  function copyText(text, done) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { legacyCopy(text, done); });
    } else {
      legacyCopy(text, done);
    }
  }

  function legacyCopy(text, done) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;top:-1000px;left:0;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); done(); } catch (e) { /* 保持原样 */ }
    document.body.removeChild(ta);
  }

  function setText(box, sel, value) {
    var el = box.querySelector(sel);
    if (el) el.textContent = value;
  }

  function setState(box, state, text, ms) {
    var dot = box.querySelector('[data-hg-dot]');
    var label = box.querySelector('[data-hg-text]');
    var msEl = box.querySelector('[data-hg-ms]');
    if (dot) dot.className = 'hg-check-dot is-' + state;
    if (label) label.textContent = text;
    if (msEl) msEl.textContent = ms == null ? '—' : String(ms);
  }

  function setLine(box, key, state, text, ms) {
    var dot = box.querySelector('[data-hg-line-dot="' + key + '"]');
    var label = box.querySelector('[data-hg-line-text="' + key + '"]');
    var msEl = box.querySelector('[data-hg-line-ms="' + key + '"]');
    if (dot) dot.className = 'hg-line-dot is-' + state;
    if (label) label.textContent = text;
    if (msEl) msEl.textContent = ms == null ? '—' : ms + ' ms';
  }

  function probe(url, method) {
    return new Promise(function (resolve) {
      var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
      var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, TIMEOUT) : null;
      var started = performance.now();
      fetch(url, {
        method: method || 'GET',
        mode: 'no-cors',
        cache: 'no-store',
        signal: ctrl ? ctrl.signal : undefined
      }).then(function () {
        resolve({ ok: true, ms: Math.round(performance.now() - started) });
      }).catch(function (err) {
        resolve({ ok: false, ms: null, timeout: !!(err && err.name === 'AbortError') });
      }).then(function () {
        if (timer) clearTimeout(timer);
      });
    });
  }

  function runChecks(box) {
    if (running) return;
    running = true;
    var btn = box.querySelector('[data-hg-retry]');
    if (btn) btn.disabled = true;

    setState(box, 'checking', '正在连接本站…', null);
    setLine(box, 'site', 'checking', '检测中', null);
    setLine(box, 'comment', 'checking', '检测中', null);
    setLine(box, 'rss', 'checking', '检测中', null);
    MIRRORS.forEach(function (m) {
      setLine(box, m.key, 'checking', '检测中', null);
    });
    fillLocal(box);
    fillNet(box);

    var stamp = '?hgcheck=' + Date.now();
    var checks = [
      probe(SITE + stamp, 'GET'),
      probe(SITE_ORIGIN + '/twikoo/' + stamp, 'GET'),
      probe(SITE_ORIGIN + '/atom.xml' + stamp, 'HEAD')
    ];
    MIRRORS.forEach(function (m) {
      checks.push(probe(m.url + '?hgcheck=' + Date.now(), 'GET'));
    });

    Promise.all(checks).then(function (res) {
      var site = res[0];
      var comment = res[1];
      var rss = res[2];

      if (site.ok) {
        var slow = site.ms > SITE_STATE.slow;
        setState(box, slow ? 'slow' : 'ok', slow ? '可以访问，但响应偏慢' : '本站可正常访问', site.ms);
        setLine(box, 'site', slow ? 'slow' : 'ok', slow ? '较慢' : '正常', site.ms);
      } else {
        setState(box, 'fail', site.timeout ? '连接超时，请稍后再试' : '暂时无法连接，请检查网络', null);
        setLine(box, 'site', 'fail', site.timeout ? '超时' : '不可达', null);
      }

      var lineResults = [['comment', comment], ['rss', rss]];
      MIRRORS.forEach(function (m, index) {
        lineResults.push([m.key, res[3 + index]]);
      });

      lineResults.forEach(function (pair) {
        var key = pair[0];
        var r = pair[1];
        if (!r.ok) {
          setLine(box, key, 'fail', r.timeout ? '超时' : '不可达', null);
        } else if (r.ms > SITE_STATE.slow) {
          setLine(box, key, 'slow', '较慢', r.ms);
        } else {
          setLine(box, key, 'ok', '正常', r.ms);
        }
      });
    }).then(finish, finish);

    function finish() {
      running = false;
      if (btn) btn.disabled = false;
    }
  }

  function fillNet(box) {
    var c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (!c) {
      setText(box, '[data-hg-net="type"]', '浏览器不支持');
      setText(box, '[data-hg-net="down"]', '—');
      setText(box, '[data-hg-net="rtt"]', '—');
      return;
    }
    var map = {
      wifi: 'Wi-Fi', cellular: '蜂窝', ethernet: '有线', bluetooth: '蓝牙',
      wimax: 'WiMAX', none: '离线', other: '其他', unknown: '未知'
    };
    var parts = [];
    if (map[c.type]) parts.push(map[c.type]);
    if (c.effectiveType) parts.push(String(c.effectiveType).toUpperCase());
    setText(box, '[data-hg-net="type"]', parts.join(' · ') || '未知');
    setText(box, '[data-hg-net="down"]', typeof c.downlink === 'number' ? c.downlink + ' Mbps' : '—');
    setText(box, '[data-hg-net="rtt"]', typeof c.rtt === 'number' ? c.rtt + ' ms' : '—');
  }

  function browserOf(ua) {
    var m = ua.match(/Edg\/([\d.]+)/) || ua.match(/OPR\/([\d.]+)/) ||
            ua.match(/Firefox\/([\d.]+)/) || ua.match(/Chrome\/([\d.]+)/) ||
            ua.match(/Version\/([\d.]+).*Safari/);
    if (!m) return '未知浏览器';
    var name = /Edg\//.test(ua) ? 'Edge' :
               /OPR\//.test(ua) ? 'Opera' :
               /Firefox\//.test(ua) ? 'Firefox' :
               /Chrome\//.test(ua) ? 'Chrome' : 'Safari';
    return name + ' ' + m[1].split('.')[0];
  }

  function osOf(ua) {
    var m;
    if (/Windows NT 10\.0/.test(ua)) return 'Windows 10/11';
    if ((m = ua.match(/Windows NT ([\d.]+)/))) return 'Windows ' + m[1];
    if ((m = ua.match(/Android ([\d.]+)/))) return 'Android ' + m[1].split('.')[0];
    if ((m = ua.match(/OS (\d+)[._]/)) && /iPhone|iPad|iPod/.test(ua)) return 'iOS ' + m[1];
    if ((m = ua.match(/Mac OS X ([\d_]+)/))) return 'macOS ' + m[1].replace(/_/g, '.');
    if (/Linux/.test(ua)) return 'Linux';
    return '未知系统';
  }

  function deviceOf(ua) {
    if (navigator.userAgentData && typeof navigator.userAgentData.mobile === 'boolean') {
      if (navigator.userAgentData.mobile) return '手机';
    }
    if (/iPad|Tablet/.test(ua)) return '平板';
    if (/Mobi|Android|iPhone/.test(ua)) return '手机';
    return '桌面';
  }

  function fillLocal(box) {
    var ua = navigator.userAgent || '';
    var cores = navigator.hardwareConcurrency;
    var mem = navigator.deviceMemory;
    var tz = '';
    try {
      tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    } catch (e) { /* 老浏览器没有 Intl */ }

    var load = '—';
    try {
      var nav = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
      if (nav) {
        var end = nav.loadEventEnd || nav.domContentLoadedEventEnd || performance.now();
        load = Math.max(0, Math.round(end - nav.startTime)) + ' ms';
      }
    } catch (e) { /* 忽略 */ }

    var res = '—';
    try {
      res = performance.getEntriesByType('resource').length + ' 个';
    } catch (e) { /* 忽略 */ }

    setText(box, '[data-hg-local="browser"]', browserOf(ua));
    setText(box, '[data-hg-local="os"]', osOf(ua));
    setText(box, '[data-hg-local="device"]', deviceOf(ua));
    setText(box, '[data-hg-local="screen"]', screen.width + '×' + screen.height);
    setText(box, '[data-hg-local="viewport"]', window.innerWidth + '×' + window.innerHeight);
    setText(box, '[data-hg-local="dpr"]', (window.devicePixelRatio || 1) + 'x');
    setText(box, '[data-hg-local="cpu"]', (cores ? cores + ' 核' : '—') + ' / ' + (mem ? mem + ' GB' : '—'));
    setText(box, '[data-hg-local="lang"]', (navigator.language || '—') + (tz ? ' / ' + tz : ''));
    setText(box, '[data-hg-local="load"]', load);
    setText(box, '[data-hg-local="res"]', res);
  }

  function init() {
    var box = document.getElementById('hg-about-check');
    if (!box || box.getAttribute('data-bound') === '1') return;
    box.setAttribute('data-bound', '1');

    var days = box.querySelector('[data-hg-days]');
    if (days) days.textContent = String(Math.max(0, Math.floor((Date.now() - SITE_BIRTH) / 86400000)));

    box.addEventListener('click', function (ev) {
      var retry = ev.target.closest('[data-hg-retry]');
      if (retry) { runChecks(box); return; }
      var copy = ev.target.closest('[data-hg-copy-rss]');
      if (copy) {
        copyText(SITE_ORIGIN + '/atom.xml', function () { tell('RSS 订阅地址已复制'); });
      }
    });

    var c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (c && c.addEventListener) {
      c.addEventListener('change', function () { fillNet(box); });
    }

    fillLocal(box);
    runChecks(box);
  }

  function boot() {
    init();
    if (window.__hgAboutPjax) return;
    window.__hgAboutPjax = true;
    document.addEventListener('pjax:complete', init);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
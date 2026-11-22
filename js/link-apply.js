/*!
 * link-apply.js —— 友人帐「加入本站友链方式」的复制按钮
 * ---------------------------------------------------------------------------
 * 页面上只有 .hg-link-apply 时才生效；按钮用 data-copy="yaml|shot" 指定内容。
 * 留言板 / 评论系统还没上线，所以不做 fomal 那种「填进评论框」，
 * 这里退一步把模板复制到剪贴板，等评论上线可以换回 kslink.js。
 * 幂等：容器上打 data-bound，pjax 往返重复执行直接 return。
 */

(function () {
  'use strict';

  var TEMPLATES = {
    yaml: '- name: #站点名称\n  link: #站点链接\n  avatar: #站长头像\n  descr: #站点描述\n  siteshot: #站点截图',
    shot: 'https://image.thum.io/get/allowJPG/wait/20/width/600/crop/950/https://<你的域名>/'
  };
  var TIPS = {
    yaml: '友链格式已复制',
    shot: '截图地址已复制'
  };

  function tell(msg) {
    if (typeof window.fomalNotify === 'function') {
      window.fomalNotify({ type: 'success', message: msg, duration: 2500 });
    }
  }

  function legacyCopy(text, done) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;top:-1000px;left:0;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); done(); } catch (e) { /* 复制失败就保持原样 */ }
    document.body.removeChild(ta);
  }

  function copyText(text, done) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { legacyCopy(text, done); });
    } else {
      legacyCopy(text, done);
    }
  }

  function init() {
    var box = document.querySelector('.hg-link-apply');
    if (!box || box.getAttribute('data-bound') === '1') return;
    box.setAttribute('data-bound', '1');

    box.addEventListener('click', function (ev) {
      var btn = ev.target.closest('[data-copy]');
      if (!btn) return;
      var key = btn.getAttribute('data-copy');
      var text = TEMPLATES[key];
      if (!text) return;
      copyText(text, function () { tell(TIPS[key] || '已复制'); });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
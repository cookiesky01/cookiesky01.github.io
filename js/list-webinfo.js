/* 桌面列表页把「网站信息」卡放到文章底部横向铺开，避免短列表下方大片空白 */
(function () {
  var MAIN_IDS = ['recent-posts', 'category', 'tag'];
  var mq = window.matchMedia('(min-width: 900px)');

  function getMain() {
    for (var i = 0; i < MAIN_IDS.length; i += 1) {
      var el = document.getElementById(MAIN_IDS[i]);
      if (el) return el;
    }
    return null;
  }

  function restore(webinfo) {
    var host = document.querySelector('#aside-content > .sticky_layout');
    if (!host || webinfo.parentElement === host) return;
    host.appendChild(webinfo);
    webinfo.classList.remove('hg-webinfo-inline');
  }

  function place() {
    var webinfo = document.querySelector('.card-webinfo');
    if (!webinfo) return;

    if (!mq.matches) {
      if (webinfo.classList.contains('hg-webinfo-inline')) restore(webinfo);
      return;
    }

    var main = getMain();
    if (!main || webinfo.parentElement === main) return;

    main.appendChild(webinfo);
    webinfo.classList.add('hg-webinfo-inline');
    webinfo.classList.remove('wow', 'animate__zoomIn');
    webinfo.style.visibility = 'visible';
    webinfo.style.animationName = 'none';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', place);
  } else {
    place();
  }

  mq.addEventListener('change', place);
  ['pjax:complete', 'pjax:success', 'pjax:end'].forEach(function (ev) {
    document.addEventListener(ev, place);
  });
})();
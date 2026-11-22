'use strict';

/* 手机侧边菜单补充两个外部入口；桌面导航不受影响 */
(function () {
  const links = [
    { href: 'https://travel.moe/go?travel=on', icon: 'fa-rocket', text: '异次元之旅', rel: 'noopener nofollow' },
    { href: 'https://www.travellings.cn/go.html', icon: 'fa-train', text: '开往', rel: 'noopener' }
  ];

  function inject () {
    const menu = document.querySelector('#sidebar-menus .menus_items');
    if (!menu || menu.querySelector('.hg-sidebar-extra')) return;

    links.forEach(item => {
      const wrap = document.createElement('div');
      wrap.className = 'menus_item hg-sidebar-extra';

      const a = document.createElement('a');
      a.className = 'site-page';
      a.href = item.href;
      a.target = '_blank';
      a.rel = item.rel;

      const icon = document.createElement('i');
      icon.className = 'fas ' + item.icon + ' fa-fw';

      const text = document.createElement('span');
      text.textContent = ' ' + item.text;

      a.append(icon, text);
      wrap.append(a);
      menu.append(wrap);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }
  document.addEventListener('pjax:complete', inject);
})();
/* 桌面短列表：文章不够铺满时，把侧栏内容卡移到列表下方全宽展开 */
(function () {
  var MAIN_IDS = ['recent-posts', 'category', 'tag'];
  var CARD_SELECTORS = [
    '.hg-webinfo-inline',
    '.hg-welcome-card',
    '.hg-countdown-card',
    '.card-announcement',
    '.card-history'
  ];
  var HOST_ID = 'hg-side-fill';
  var SLOT_MARK = 'hg-side-fill-slot';
  var GAP_MIN = 220;
  var mq = window.matchMedia('(min-width: 900px)');
  var pending = 0;
  var filled = false;

  function getMain() {
    for (var i = 0; i < MAIN_IDS.length; i += 1) {
      var el = document.getElementById(MAIN_IDS[i]);
      if (el) return el;
    }
    return null;
  }

  function getAside() {
    return document.getElementById('aside-content');
  }

  function getLayout() {
    return document.getElementById('content-inner');
  }

  function postCount(main) {
    return main.querySelectorAll('.recent-post-items > .recent-post-item').length;
  }

  function findCard(aside, selector) {
    var card = aside.querySelector(selector);
    if (card) return card;
    if (selector === '.hg-webinfo-inline') return document.querySelector(selector);
    return null;
  }

  function contentHeight(el) {
    var rect = el.getBoundingClientRect();
    var bottom = rect.top;
    for (var i = 0; i < el.children.length; i += 1) {
      var child = el.children[i].getBoundingClientRect();
      if (child.height > 0 && child.bottom > bottom) bottom = child.bottom;
    }
    return Math.max(0, bottom - rect.top);
  }

  function ensureHost(layout) {
    var host = document.getElementById(HOST_ID);
    if (!host) {
      host = document.createElement('div');
      host.id = HOST_ID;
      host.className = 'hg-side-fill';
    }
    if (host.parentElement !== layout) layout.appendChild(host);
    layout.classList.add('hg-side-fill-on');
    return host;
  }

  function cleanSlots(aside) {
    if (!aside) return;
    var walker = document.createTreeWalker(aside, NodeFilter.SHOW_COMMENT, null);
    var slots = [];
    while (walker.nextNode()) {
      if (walker.currentNode.nodeValue === SLOT_MARK) slots.push(walker.currentNode);
    }
    for (var i = 0; i < slots.length; i += 1) {
      if (slots[i].parentNode) slots[i].parentNode.removeChild(slots[i]);
    }
  }

  function restore() {
    var host = document.getElementById(HOST_ID);
    var aside = getAside();
    var layout = getLayout();
    if (host) {
      var cards = Array.prototype.slice.call(host.children);
      for (var i = 0; i < cards.length; i += 1) {
        var card = cards[i];
        var slot = card.__hgFillSlot;
        if (slot && slot.parentNode) {
          slot.parentNode.insertBefore(card, slot);
          slot.parentNode.removeChild(slot);
        } else if (aside) {
          aside.appendChild(card);
        }
        card.__hgFillSlot = null;
      }
      if (!host.children.length && host.parentElement) host.parentElement.removeChild(host);
    }
    cleanSlots(aside);
    cleanSlots(getMain());
    if (layout) layout.classList.remove('hg-side-fill-on');
    filled = false;
  }

  function moveToHost(card, host) {
    if (card.parentElement !== host) {
      if (!card.__hgFillSlot || !card.__hgFillSlot.parentNode) {
        var slot = document.createComment(SLOT_MARK);
        card.parentNode.insertBefore(slot, card);
        card.__hgFillSlot = slot;
      }
      host.appendChild(card);
    }
    card.classList.remove('wow');
    card.style.visibility = 'visible';
    card.style.animationName = 'none';
  }

  function run() {
    pending = 0;
    var main = getMain();
    var aside = getAside();
    var layout = getLayout();
    var hadFill = filled;

    if (!aside || !layout) return;
    restore();

    if (!main || !mq.matches || postCount(main) === 0) {
      if (hadFill) window.dispatchEvent(new Event('resize'));
      return;
    }

    var mainH = contentHeight(main);
    var asideH = contentHeight(aside);
    if (asideH - mainH < GAP_MIN) {
      if (hadFill) window.dispatchEvent(new Event('resize'));
      return;
    }

    var host = ensureHost(layout);
    for (var i = 0; i < CARD_SELECTORS.length; i += 1) {
      var card = findCard(aside, CARD_SELECTORS[i]);
      if (!card) continue;
      moveToHost(card, host);
      asideH = contentHeight(aside);
      if (asideH <= mainH + 12) break;
    }

    if (!host.children.length) {
      restore();
      if (hadFill) window.dispatchEvent(new Event('resize'));
      return;
    }

    host.classList.toggle('hg-fill-has-welcome', !!host.querySelector('.hg-welcome-card'));
    host.classList.toggle('hg-fill-has-countdown', !!host.querySelector('.hg-countdown-card'));
    filled = true;
    window.dispatchEvent(new Event('resize'));
  }

  function sync() {
    if (pending) return;
    pending = window.requestAnimationFrame(run);
  }

  function syncSoon() {
    sync();
    window.setTimeout(sync, 180);
  }

  window.hgSideFillSync = syncSoon;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', syncSoon);
  } else {
    syncSoon();
  }

  mq.addEventListener('change', syncSoon);
  ['pjax:complete', 'pjax:success', 'pjax:end'].forEach(function (ev) {
    document.addEventListener(ev, syncSoon);
  });
})();
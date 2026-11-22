/* 中英文之间自动加空格：调用 pangu 的 autoSpacingPage，
   只处理文本节点，不动 <code>/<pre>/<a> 内容。PJAX 换页后重新执行。 */
(function () {
  if (typeof pangu === 'undefined') return;
  function run() {
    try { pangu.autoSpacingPage({ pageContainer: '.js-pjax', articleContainer: '#post, #page' }); }
    catch (e) { try { pangu.spacingPage(); } catch (e2) {} }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else { run(); }
  document.addEventListener('pjax:complete', run);
})();

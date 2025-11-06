/* Landing: カードをクリック/Enterで即遷移（スタートボタン不要） */
(function () {
  function go(dest, newTab) {
    if (!dest) return;
    var resolved = (window.FAQ && FAQ.resolvePath) ? FAQ.resolvePath(dest) : dest;
    if (newTab) { window.open(resolved, '_blank'); return; }
    location.assign(resolved);
  }

  document.addEventListener('DOMContentLoaded', function () {
    var list = document.querySelector('.choices');
    if (!list) return;

    // カードをフォーカス可能に（キーボード操作OK）
    var cards = list.querySelectorAll('.choice');
    Array.prototype.forEach.call(cards, function (c) {
      c.tabIndex = 0;
      c.setAttribute('role', 'link');
    });

    // クリック：即遷移（Ctrl/Cmd or 中クリックで新規タブ）
    list.addEventListener('click', function (e) {
      var c = e.target.closest('.choice'); if (!c) return;
      var dest = (c.dataset && c.dataset.to) || '';
      go(dest, e.ctrlKey || e.metaKey);
    });

    // 中クリック対応
    list.addEventListener('mousedown', function (e) {
      if (e.button !== 1) return;
      var c = e.target.closest('.choice'); if (!c) return;
      var dest = (c.dataset && c.dataset.to) || '';
      go(dest, true);
      e.preventDefault();
    });

    // キーボード：Enter/Spaceで遷移
    list.addEventListener('keydown', function (e) {
      var c = e.target.closest('.choice'); if (!c) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        var dest = (c.dataset && c.dataset.to) || '';
        go(dest, e.ctrlKey || e.metaKey);
      }
    });

    // 念のため残っているスタートボタンがあれば除去
    var start = document.getElementById('startBtn');
    if (start) start.remove();
  });
})();

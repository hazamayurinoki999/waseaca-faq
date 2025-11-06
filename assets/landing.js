/* Landing: カードをクリック/Enterで即遷移（スタートボタン不要） */
(function () {
  function go(dest, newTab) {
    if (!dest) return;
    if (newTab) { window.open(dest, '_blank'); return; }
    location.assign(dest);
  }

  document.addEventListener('DOMContentLoaded', function () {
    var list = document.querySelector('.choices');
    if (!list) return;

    // カードをフォーカス可能に（キーボード操作OK）
    var cards = list.querySelectorAll('.choice');
    Array.prototype.forEach.call(cards, function (c) {
      c.tabIndex = 0;          // focusable
      c.setAttribute('role', 'link');
      // 既存の選択/ディム演出は不要なのでクラス操作はしない
    });

    // クリック：即遷移（Ctrl/Cmd or 中クリックで新規タブ）
    list.addEventListener('click', function (e) {
      var c = e.target.closest('.choice'); if (!c) return;
      var dest = (c.dataset && c.dataset.to) || '';
      go(dest, e.ctrlKey || e.metaKey);
    });

    // 中クリック（ホイールクリック）にも対応
    list.addEventListener('mousedown', function (e) {
      if (e.button !== 1) return; // middle button only
      var c = e.target.closest('.choice'); if (!c) return;
      var dest = (c.dataset && c.dataset.to) || '';
      // mousedown で新規タブを開く（ブラウザ標準に近い挙動）
      go(dest, true);
      // スクロール防止
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

    // 残っている場合はスタートボタンを除去（HTML側は削除してOK）
    var start = document.getElementById('startBtn');
    if (start) start.remove();
  });
})();

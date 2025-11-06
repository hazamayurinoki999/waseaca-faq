/* FAQ page: single category open, colored groups */
(function () {
  var ALL = [];
  function makeChevron() {
    var el = document.createElement('span'); el.className = 'chev';
    el.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>';
    return el;
  }
  function syncPills() {
    var pills = document.querySelectorAll('.pill'); Array.prototype.forEach.call(pills, function (p) { p.classList.remove('active'); });
    var cur = window.CURRENT_CATEGORY || null;
    if (!cur) { var all = document.getElementById('pillAll'); if (all) all.classList.add('active'); }
    var cats = document.querySelectorAll('#categoryPills .pill');
    Array.prototype.forEach.call(cats, function (p) { if (p.dataset.cat === cur) p.classList.add('active'); });
  }
  function filterItems(q) {
    q = (q || '').toLowerCase();
    return ALL.filter(function (it) {
      if (window.CURRENT_CATEGORY && String(it.category) !== window.CURRENT_CATEGORY) return false;
      if (!q) return true;
      var hay = (it.category + '\n' + it.question + '\n' + it.answer).toLowerCase();
      return hay.indexOf(q) !== -1;
    });
  }
  function closeOther(sec) {
    var opened = document.querySelectorAll('.group.open');
    Array.prototype.forEach.call(opened, function (s) { if (s !== sec) s.classList.remove('open'); });
  }
  function render() {
    var items = filterItems(document.getElementById('searchInput').value);
    var box = document.getElementById('faq-container');
    if (!items.length) { box.innerHTML = '<div class="alert">条件に一致するFAQがありません。</div>'; return; }
    var grouped = {};
    items.forEach(function (it) { var c = String(it.category || 'その他'); (grouped[c] || (grouped[c] = [])).push(it); });
    var frag = document.createDocumentFragment();
    Object.keys(grouped).sort(function (a, b) { return a.localeCompare(b, 'ja'); }).forEach(function (cat) {
      var list = grouped[cat], hue = FAQ.hueByName(cat);
      var sec = document.createElement('section'); sec.className = 'group'; sec.style.setProperty('--cat-h', hue);
      var head = document.createElement('button'); head.className = 'cat-head'; head.type = 'button';
      head.innerHTML = '<span class="cat-title">' + FAQ.escapeHtml(cat) + '</span><span class="badge">' + list.length + '</span><span class="chev" aria-hidden="true"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg></span>';
      var body = document.createElement('div'); body.className = 'cat-body';
      list.forEach(function (it) {
        var card = document.createElement('article'); card.className = 'card';
        var q = document.createElement('div'); q.className = 'q';
        var h3 = document.createElement('h3'); h3.textContent = it.question || '';
        var chev = makeChevron(); q.appendChild(h3); q.appendChild(chev);
        var a = document.createElement('div'); a.className = 'a'; a.innerHTML = '<p>' + FAQ.escapeHtml(it.answer || '') + '</p>';
        var opened = false;
        q.addEventListener('click', function () {
          opened = !opened; chev.style.transform = opened ? 'rotate(180deg)' : 'rotate(0)';
          if (opened) { a.classList.add('open'); a.style.maxHeight = (a.scrollHeight + 24) + 'px'; }
          else { a.style.maxHeight = '0px'; a.addEventListener('transitionend', function () { a.classList.remove('open'); }, { once: true }); }
        });
        var fb = document.createElement('div'); fb.className = 'helpful';
        fb.innerHTML = '<button type="button" class="btn tiny ok">役に立った</button><button type="button" class="btn tiny ghost">いいえ</button>';
        a.appendChild(fb);
        card.appendChild(q); card.appendChild(a); body.appendChild(card);
      });
      head.addEventListener('click', function () {
        var opened = sec.classList.toggle('open');
        head.setAttribute('aria-expanded', opened ? 'true' : 'false');
        if (opened) closeOther(sec);
      });
      sec.appendChild(head); sec.appendChild(body); frag.appendChild(sec);
    });
    box.innerHTML = ''; box.appendChild(frag);
  }

  document.addEventListener('DOMContentLoaded', function () {
    var si = document.getElementById('searchInput'); if (si) si.addEventListener('input', render);
    FAQ.loadFAQ(FAQ_CONFIG).then(function (items) {
      ALL = items;
      var cats = Array.from(new Set(ALL.map(function (it) { return String(it.category || 'その他'); }))).sort(function (a, b) { return a.localeCompare(b, 'ja'); });
      var wrap = document.getElementById('categoryPills'); wrap.innerHTML = '';
      cats.forEach(function (cat) {
        var d = document.createElement('div'); d.className = 'pill'; d.textContent = cat; d.dataset.cat = cat; d.style.setProperty('--h', FAQ.hueByName(cat));
        d.addEventListener('click', function () { window.CURRENT_CATEGORY = (window.CURRENT_CATEGORY === cat ? null : cat); syncPills(); render(); });
        wrap.appendChild(d);
      });
      var all = document.getElementById('pillAll'); if (all) { all.style.setProperty('--h', 210); all.onclick = function () { window.CURRENT_CATEGORY = null; syncPills(); render(); }; }
      syncPills(); render();
    }).catch(function (e) {
      document.getElementById('faq-container').innerHTML = '<div class="alert">' + FAQ.escapeHtml(e.message || String(e)) + '</div>';
    });
  });
})();

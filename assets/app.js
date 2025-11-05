/* ========== Smart FAQ Center — Behavior (Promiseベース) ========== */
(function(){
  // ---- Config ----
  var cfg = window.FAQ_CONFIG || {};
  var SHEET_ID = cfg.SHEET_ID;
  var SHEET_NAME = cfg.SHEET_NAME || 'FAQ';
  var API_URL = 'https://docs.google.com/spreadsheets/d/' + SHEET_ID +
    '/gviz/tq?tqx=out:json&headers=1&sheet=' + encodeURIComponent(SHEET_NAME);

  // ---- State ----
  var ALL_ITEMS = [];
  var CURRENT_FILTER = { category: null, q: '' };
  var landingChoice = 'showAll';

  // ---- Helpers ----
  function $(s){ return document.querySelector(s); }
  function isPublic(v){ return (v === true) || (String(v).trim().toUpperCase() === 'TRUE'); }
  function escapeHtml(s){
    s = String(s == null ? '' : s);
    return s.replace(/[&<>"']/g, function(m){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]); });
  }
  function buildHeaderMap(headerRow){
    var map = {}; headerRow.forEach(function(n,i){ var k = String(n == null ? '' : n).trim(); if(k) map[k]=i; });
    return map;
  }
  var REQUIRED_HEADERS = ['カテゴリ','質問','回答','公開フラグ'];
  function validateHeaders(map){
    var miss = REQUIRED_HEADERS.filter(function(k){ return !(k in map); });
    if(miss.length) throw new Error('見出し不足: ' + miss.join('、'));
  }
  function ensureContainer(){
    var el = $('#faq-container');
    if(!el){ el=document.createElement('div'); el.id='faq-container'; document.body.appendChild(el); }
    return el;
  }
  function showAlert(msg){ ensureContainer().innerHTML = '<div class="alert">'+ escapeHtml(msg) +'</div>'; }
  function makeChevron(){
    var el=document.createElement('span'); el.className='chev';
    el.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>';
    return el;
  }

  // ---- UI Builders ----
  function buildPills(categories){
    var wrap = $('#categoryPills'); if(!wrap) return;
    wrap.innerHTML='';
    categories.forEach(function(cat){
      var d=document.createElement('div'); d.className='pill'; d.textContent=cat; d.dataset.cat=cat;
      d.addEventListener('click', function(){
        CURRENT_FILTER.category = (CURRENT_FILTER.category===cat? null : cat);
        syncPills(); render();
      });
      wrap.appendChild(d);
    });
    var all = $('#pillAll');
    if(all){ all.onclick = function(){ CURRENT_FILTER.category=null; syncPills(); render(); }; }
    syncPills();
  }

  function syncPills(){
    var pills = document.querySelectorAll('.pill'); Array.prototype.forEach.call(pills, function(p){ p.classList.remove('active'); });
    if(!CURRENT_FILTER.category){ var all = $('#pillAll'); if(all) all.classList.add('active'); }
    var cats = document.querySelectorAll('#categoryPills .pill');
    Array.prototype.forEach.call(cats, function(p){ if(p.dataset.cat===CURRENT_FILTER.category) p.classList.add('active'); });
  }

  function filterItems(){
    var q = (CURRENT_FILTER.q || '').trim().toLowerCase();
    return ALL_ITEMS.filter(function(it){
      if(CURRENT_FILTER.category && String(it.category)!==CURRENT_FILTER.category) return false;
      if(!q) return true;
      var hay = (it.category + '\n' + it.question + '\n' + it.answer).toLowerCase();
      return hay.indexOf(q) !== -1;
    });
  }

  function groupByCategory(items){
    var g = {};
    items.forEach(function(it){
      var c = String(it.category || 'その他');
      if(!g[c]) g[c]=[];
      g[c].push(it);
    });
    return g;
  }

  function render(){
    var container = ensureContainer();
    var items = filterItems();
    if(!items.length){ container.innerHTML = '<div class="alert">条件に一致するFAQがありません。</div>'; return; }

    var grouped = groupByCategory(items);
    var frag = document.createDocumentFragment();

    Object.keys(grouped).sort(function(a,b){ return a.localeCompare(b,'ja'); }).forEach(function(cat){
      var list = grouped[cat];

      var sec = document.createElement('section');
      sec.className = 'group fadeIn';

      // カテゴリヘッダ
      var head = document.createElement('button');
      head.className = 'cat-head';
      head.setAttribute('type','button');
      head.setAttribute('aria-expanded','false');
      head.innerHTML =
        '<span class="cat-title">'+ escapeHtml(cat) +'</span>' +
        '<span class="badge">'+ list.length +'</span>' +
        '<span class="chev" aria-hidden="true"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg></span>';

      var body = document.createElement('div');
      body.className = 'cat-body';

      // 質問カード
      list.forEach(function(it){
        var card=document.createElement('article'); card.className='card';
        var q=document.createElement('div'); q.className='q';
        var h3=document.createElement('h3'); h3.textContent=(it.question || '');
        var chev=makeChevron(); q.appendChild(h3); q.appendChild(chev);
        var a=document.createElement('div'); a.className='a'; a.innerHTML='<p>'+ escapeHtml(it.answer || '') +'</p>';

        var opened=false;
        q.addEventListener('click', function(){
          opened=!opened; chev.style.transform = opened? 'rotate(180deg)':'rotate(0)';
          if(opened){ a.classList.add('open'); a.style.maxHeight = (a.scrollHeight + 24) + 'px'; }
          else{ a.style.maxHeight='0px'; a.addEventListener('transitionend', function(){ a.classList.remove('open'); }, {once:true}); }
        });

        // 役立ち度ボタン（consoleに記録、後でSheets/GASに差し替え）
        var fb = document.createElement('div');
        fb.className = 'helpful';
        fb.innerHTML = '<button type="button" class="btn tiny ok">役に立った</button>' +
                       '<button type="button" class="btn tiny ghost">いいえ</button>';
        a.appendChild(fb);
        var makeId = function(s){ return String(s||'').toLowerCase().slice(0,80); };
        fb.querySelector('.ok').addEventListener('click', function(){ console.log('[helpful=YES]', { id: makeId(it.question), q: it.question }); });
        fb.querySelector('.ghost').addEventListener('click', function(){ console.log('[helpful=NO]', { id: makeId(it.question), q: it.question }); });

        card.appendChild(q); card.appendChild(a); body.appendChild(card);
      });

      head.addEventListener('click', function(){
        var expanded = head.getAttribute('aria-expanded') === 'true';
        head.setAttribute('aria-expanded', String(!expanded));
        sec.classList.toggle('open', !expanded);
      });

      sec.appendChild(head);
      sec.appendChild(body);
      frag.appendChild(sec);
    });

    container.innerHTML=''; container.appendChild(frag);
  }

  // ---- Data load (Promise) ----
  function loadFAQ(){
    return fetch(API_URL, {cache:'no-store'})
      .then(function(res){ return res.text(); })
      .then(function(text){
        if(text.indexOf('/*O_o*/') !== 0) throw new Error('シート公開設定またはID/タブ名を確認してください。');

        var json;
        try { json = JSON.parse(text.substring(47, text.length-2)); }
        catch(e){ throw new Error('シート応答の解析に失敗しました。'); }

        var header = (json.table.cols || []).map(function(c){ return (c && c.label) ? String(c.label).trim() : ''; });
        var rows = (json.table.rows || []).map(function(r){ return (r.c || []).map(function(c){ return c ? c.v : ''; }); });

        var invalid = header.every(function(h){ return !h || /^[A-Z]$/.test(h); });
        if(invalid && rows.length){ header = rows.shift().map(function(v){ return String(v == null ? '' : v).trim(); }); }

        var map = buildHeaderMap(header); validateHeaders(map);

        ALL_ITEMS = rows.map(function(r){
          return {
            category: r[map['カテゴリ']] || '',
            question: r[map['質問']] || '',
            answer:   r[map['回答']] || '',
            public:   r[map['公開フラグ']]
          };
        }).filter(function(it){ return isPublic(it.public); });

        var cats = Array.from(new Set(ALL_ITEMS.map(function(it){ return String(it.category || 'その他'); })))
          .sort(function(a,b){ return a.localeCompare(b,'ja'); });

        buildPills(cats);
        render();
      });
  }

  // ---- Landing (入口) ----
  function startLanding(){
    var landing = $('#landing'); if(!landing) return;
    landing.classList.add('fadeOutUp');
    setTimeout(function(){ landing.hidden = true; }, 500);

    if(landingChoice === 'bySearch'){
      var inp = $('#searchInput'); if(inp) inp.focus();
    }else if(landingChoice === 'byCategory'){
      CURRENT_FILTER.category = null; syncPills();
      if(window.scrollTo) window.scrollTo({top:0, behavior:'smooth'});
    }
  }

  function initLanding(){
    var landing = $('#landing'); if(!landing) return;
    var url = new URL(location.href);
    var showLanding = (url.searchParams.get('landing') === '1') ||
                      ((cfg.showLandingByDefault && url.searchParams.get('landing') !== '0'));
    if(showLanding) landing.hidden = false;

    var choices = $('#choices');
    if(choices){
      choices.addEventListener('click', function(e){
        var t = e.target.closest('.choice'); if(!t) return;
        landingChoice = t.dataset.action || 'showAll';
        var all = document.querySelectorAll('.choice');
        Array.prototype.forEach.call(all, function(c){ c.style.outline='none'; });
        t.style.outline = '2px solid rgba(255,168,0,.7)';
        startLanding(); // カード押下で即遷移
      });
    }

    var startBtn = $('#startBtn'); if(startBtn) startBtn.onclick = startLanding;
    var skipBtn  = $('#skipBtn');  if(skipBtn)  skipBtn.onclick  = startLanding;
    var menuBtn  = $('#openLanding'); if(menuBtn) menuBtn.onclick = function(){
      landing.hidden = false; landing.classList.remove('fadeOutUp');
    };
  }

  // ---- Search / Reload ----
  function initSearch(){
    var si = $('#searchInput'); if(!si) return;
    si.addEventListener('input', function(e){ CURRENT_FILTER.q = e.target.value || ''; render(); });
  }
  function initReload(){
    var btn = $('#reload'); if(!btn) return;
    btn.onclick = function(){
      loadFAQ()
        .then(function(){
          showAlert('最新のデータに更新しました。');
          setTimeout(render, 600);
        })
        .catch(function(e){ showAlert(e.message || String(e)); });
    };
  }

  // ---- Boot ----
  document.addEventListener('DOMContentLoaded', function(){
    try{
      initLanding(); initSearch(); initReload();
      loadFAQ().catch(function(e){ showAlert(e.message || String(e)); console.error(e); });
    } catch(e){
      showAlert(e.message || String(e)); console.error(e);
    }
  });
})();

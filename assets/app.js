/* ========== Smart FAQ Center — Behavior (Promiseベース, モード対応) ========== */
(function(){
  // ---- Config ----
  var cfg = window.FAQ_CONFIG || {};
  var SHEET_ID = cfg.SHEET_ID;
  var SHEET_NAME = cfg.SHEET_NAME || 'FAQ';
  var HOME_URL = cfg.HOME_URL || (location.origin); // ⑧ ホーム先（未設定なら同ドメイン）
  var API_URL = 'https://docs.google.com/spreadsheets/d/' + SHEET_ID +
    '/gviz/tq?tqx=out:json&headers=1&sheet=' + encodeURIComponent(SHEET_NAME);

  // ---- State ----
  var ALL_ITEMS = [];
  var CURRENT_FILTER = { category: null, q: '' };
  var landingChoice = 'byCategory';  // ① デフォはカテゴリ検索
  var MODE = 'category';             // 'category' | 'keyword' | 'ai'

  // ---- Helpers ----
  function $(s){ return document.querySelector(s); }
  function isPublic(v){ return (v === true) || (String(v||'').trim().toUpperCase() === 'TRUE'); }
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
  function hueByName(name){ // ④ カテゴリ色（安定ハッシュ → 0..359）
    var s=String(name||''), h=0; for(var i=0;i<s.length;i++){ h=(h*31 + s.charCodeAt(i))>>>0; }
    return (h % 360);
  }

  // ---- Views: モード切替（①・②・⑥・⑦・⑧） ----
  function ensureViews(){
    // カテゴリ（既存UI）＝ .tools と #faq-container を使う
    if(!$('#keywordView')){
      var kv = document.createElement('section');
      kv.id='keywordView'; kv.className='view container';
      kv.innerHTML =
        '<div class="heading">キーワードで検索</div>' +
        '<div class="kw-box"><input id="kwInput" type="search" placeholder="キーワードを入力…"><button id="kwRun" class="btn">検索</button></div>' +
        '<div id="kwResults"></div>';
      document.body.appendChild(kv);
      // イベント
      var kwInput = kv.querySelector('#kwInput');
      var kwRun = kv.querySelector('#kwRun');
      var run = function(){ renderKeywordView((kwInput.value||'').trim()); };
      kwInput.addEventListener('input', run);
      kwRun.addEventListener('click', run);
    }
    if(!$('#aiView')){
      var av = document.createElement('section');
      av.id='aiView'; av.className='view container';
      av.innerHTML =
        '<div class="heading">AIで検索（準備中）</div>' +
        '<div class="chat" id="chatBox">' +
          '<div class="bubble bot">AIは未接続です。後日この画面で、キャラクターとの対話ができます。</div>' +
        '</div>' +
        '<div class="composer"><textarea id="aiInput" placeholder="ここに入力（いまはダミー表示のみ）"></textarea><button id="aiSend" class="btn">送信</button></div>';
      document.body.appendChild(av);
      var aiSend = av.querySelector('#aiSend');
      aiSend.addEventListener('click', function(){
        var t = av.querySelector('#aiInput'); var v = (t.value||'').trim(); if(!v) return;
        t.value='';
        var box = $('#chatBox');
        var me = document.createElement('div'); me.className='bubble me'; me.textContent=v; box.appendChild(me);
        var bot = document.createElement('div'); bot.className='bubble bot'; bot.textContent='（デモ）: ありがとうございます。AI連携は後日実装します。'; box.appendChild(bot);
        box.scrollTop = box.scrollHeight;
      });
    }
    if(!$('.site-footer')){
      var ft=document.createElement('div');
      ft.className='site-footer';
      ft.innerHTML = '© 早稲田アカデミーシンガポール校 / Waseda Academy Singapore. このページはFAQ参照用に提供されています。';
      document.body.appendChild(ft);
    }
    // ⑤ ロゴ下の文言の視認性
    var sub = document.querySelector('.brand .subtle');
    if(sub){ sub.classList.add('site-note'); }
  }

  function setMode(mode){
    MODE = mode || 'category';
    var catOn = (MODE==='category'), kwOn = (MODE==='keyword'), aiOn = (MODE==='ai');
    var tools = document.querySelector('.tools');
    if(tools) tools.style.display = catOn ? '' : 'none';
    ensureContainer().style.display = catOn ? '' : 'none';

    ensureViews();
    var kv = $('#keywordView'), av = $('#aiView');
    if(kv) kv.classList.toggle('active', kwOn);
    if(av) av.classList.toggle('active', aiOn);
    if(kwOn){ var i=$('#kwInput'); if(i) i.focus(); }
    if(aiOn){ var a=$('#aiInput'); if(a) a.focus(); }
  }

  // ---- UI Builders ----
  function buildPills(categories){
    var wrap = $('#categoryPills'); if(!wrap) return;
    wrap.innerHTML='';
    categories.forEach(function(cat){
      var d=document.createElement('div'); d.className='pill'; d.textContent=cat; d.dataset.cat=cat;
      d.style.setProperty('--h', hueByName(cat));
      d.addEventListener('click', function(){
        CURRENT_FILTER.category = (CURRENT_FILTER.category===cat? null : cat);
        syncPills(); render();
      });
      wrap.appendChild(d);
    });
    var all = $('#pillAll');
    if(all){ all.onclick = function(){ CURRENT_FILTER.category=null; syncPills(); render(); }; all.style.setProperty('--h', 210); }
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

  // ② カテゴリアコーディオン：同時に1つだけ開く
  function closeOtherGroups(exceptSection){
    var opened = document.querySelectorAll('.group.open');
    Array.prototype.forEach.call(opened, function(sec){
      if(sec !== exceptSection) sec.classList.remove('open');
    });
  }

  function render(){
    var container = ensureContainer();
    var items = filterItems();
    if(!items.length){ container.innerHTML = '<div class="alert">条件に一致するFAQがありません。</div>'; return; }

    var grouped = groupByCategory(items);
    var frag = document.createDocumentFragment();

    Object.keys(grouped).sort(function(a,b){ return a.localeCompare(b,'ja'); }).forEach(function(cat){
      var list = grouped[cat];
      var hue = hueByName(cat);

      var sec = document.createElement('section');
      sec.className = 'group fadeIn';
      sec.style.setProperty('--cat-h', hue);

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
        if(!expanded) closeOtherGroups(sec); // ← ② ほかを閉じる
      });

      sec.appendChild(head);
      sec.appendChild(body);
      frag.appendChild(sec);
    });

    container.innerHTML=''; container.appendChild(frag);
  }

  // キーワード専用ビュー（① 検索ワードの特別ページ）
  function renderKeywordView(q){
    ensureViews();
    var results = [];
    var query = (q||'').toLowerCase();
    if(query){
      // 簡易スコア：出現回数 + タイトル一致ボーナス
      ALL_ITEMS.forEach(function(it){
        var text = (it.category + ' ' + it.question + ' ' + it.answer).toLowerCase();
        var cnt = 0, pos = text.indexOf(query);
        while(pos !== -1){ cnt++; pos = text.indexOf(query, pos+query.length); }
        if(cnt>0){
          var score = cnt + (it.question.toLowerCase().indexOf(query)!==-1 ? 2 : 0);
          results.push({it:it, score:score});
        }
      });
      results.sort(function(a,b){ return b.score - a.score; });
    }
    var box = $('#kwResults'); if(!box) return;
    if(!query){ box.innerHTML = '<div class="alert">キーワードを入力してください。</div>'; return; }
    if(!results.length){ box.innerHTML = '<div class="alert">見つかりませんでした。</div>'; return; }

    var frag = document.createDocumentFragment();
    results.slice(0, 12).forEach(function(r){
      var hue = hueByName(r.it.category);
      var card=document.createElement('article'); card.className='card'; card.style.setProperty('--cat-h', hue);
      var qv=document.createElement('div'); qv.className='q';
      var h3=document.createElement('h3'); h3.textContent=r.it.question||''; var ch=makeChevron();
      qv.appendChild(h3); qv.appendChild(ch);
      var a=document.createElement('div'); a.className='a'; a.innerHTML='<p>'+ escapeHtml(r.it.answer||'') +'</p>';
      var opened=false; qv.addEventListener('click', function(){
        opened=!opened; ch.style.transform = opened? 'rotate(180deg)':'rotate(0)';
        if(opened){ a.classList.add('open'); a.style.maxHeight = (a.scrollHeight + 24) + 'px'; }
        else{ a.style.maxHeight='0px'; a.addEventListener('transitionend', function(){ a.classList.remove('open'); }, {once:true}); }
      });
      card.appendChild(qv); card.appendChild(a); frag.appendChild(card);
    });
    box.innerHTML=''; box.appendChild(frag);
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

  // ---- Landing（①⑥⑦⑧） ----
  function startLanding(){
    var landing = $('#landing'); if(!landing) return;
    landing.classList.add('fadeOutUp');
    setTimeout(function(){ landing.hidden = true; }, 500);

    if(landingChoice === 'byCategory'){ setMode('category'); }
    else if(landingChoice === 'byWord'){ setMode('keyword'); }
    else if(landingChoice === 'byAI'){ setMode('ai'); }
  }

  function updateChoiceVisual(selectedEl){
    var items = document.querySelectorAll('.choice');
    Array.prototype.forEach.call(items, function(c){
      if(c === selectedEl){ c.classList.add('selected'); c.classList.remove('dim'); }
      else{ c.classList.remove('selected'); c.classList.add('dim'); }
    });
  }

  function initLanding(){
    var landing = $('#landing'); if(!landing) return;

    // 文言（⑦）
    var lead = landing.querySelector('.lead');
    if(lead) lead.textContent = '目的に合った検索方法を選んでください。';
    var step = document.createElement('div'); step.className='stepnote';
    step.textContent = '3つの中から選んで「スタート」を押してください。';
    var panel = landing.querySelector('.panel'); if(panel && !panel.querySelector('.stepnote')) panel.insertBefore(step, panel.querySelector('.choices'));

    // 既存 skipBtn は非表示（⑥）
    var skipBtn = $('#skipBtn'); if(skipBtn) skipBtn.style.display='none';

    // ホームボタンを追加（⑧）
    var actions = landing.querySelector('.actions');
    if(actions && !$('#homeBtn')){
      var home = document.createElement('a');
      home.id = 'homeBtn'; home.className='btn ghost';
      home.href = HOME_URL; home.textContent = 'ホームへ';
      actions.appendChild(home);
    }

    var url = new URL(location.href);
    var showLanding = (url.searchParams.get('landing') === '1') ||
                      ((cfg.showLandingByDefault && url.searchParams.get('landing') !== '0'));
    if(showLanding) landing.hidden = false;

    var choices = $('#choices');
    if(choices){
      choices.addEventListener('click', function(e){
        var t = e.target.closest('.choice'); if(!t) return;
        landingChoice = t.dataset.action || 'byCategory';
        updateChoiceVisual(t); // ⑦ 選択強調（拡大・他を薄く）
      });
    }

    var startBtn = $('#startBtn'); if(startBtn) startBtn.onclick = startLanding;

    var menuBtn  = $('#openLanding'); if(menuBtn) menuBtn.onclick = function(){
      landing.hidden = false; landing.classList.remove('fadeOutUp');
      // リセット（選択解除）
      var items = document.querySelectorAll('.choice'); Array.prototype.forEach.call(items, function(c){ c.classList.remove('selected','dim'); });
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
      // ③ ヘッダーにサイト名注記の視認性UPはCSSで付与、©はJSで追加（ensureViews内）
      initLanding(); initSearch(); initReload();
      ensureViews();
      loadFAQ().catch(function(e){ showAlert(e.message || String(e)); console.error(e); });
    } catch(e){
      showAlert(e.message || String(e)); console.error(e);
    }
  });
})();

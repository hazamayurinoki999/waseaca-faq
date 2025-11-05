(function(){
  const cfg = window.FAQ_CONFIG || {};
  const SHEET_ID = cfg.SHEET_ID;
  const SHEET_NAME = cfg.SHEET_NAME || 'FAQ';
  const API_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&headers=1&sheet=${encodeURIComponent(SHEET_NAME)}`;

  let ALL_ITEMS = [];
  let CURRENT_FILTER = { category: null, q: '' };
  let landingChoice = 'showAll';

  const $ = (s) => document.querySelector(s);
  const isPublic = (v) => (v === true) || (String(v).trim().toUpperCase() === 'TRUE');
  const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

  function buildHeaderMap(headerRow){ const map={}; headerRow.forEach((n,i)=>{ const k=String(n??'').trim(); if(k) map[k]=i; }); return map; }
  const REQUIRED_HEADERS = ['カテゴリ','質問','回答','公開フラグ'];
  function validateHeaders(map){ const miss = REQUIRED_HEADERS.filter(k=>!(k in map)); if(miss.length) throw new Error(`見出し不足: ${miss.join('、')}`); }

  function ensureContainer(){ let el = $('#faq-container'); if(!el){ el=document.createElement('div'); el.id='faq-container'; document.body.appendChild(el);} return el; }
  function showAlert(msg){ ensureContainer().innerHTML = `<div class="alert">${escapeHtml(msg)}</div>`; }

  function makeChevron(){ const el=document.createElement('span'); el.className='chev';
    el.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`;
    return el;
  }

  function buildPills(categories){
    const wrap = $('#categoryPills'); wrap.innerHTML='';
    categories.forEach(cat=>{
      const d=document.createElement('div'); d.className='pill'; d.textContent=cat; d.dataset.cat=cat;
      d.addEventListener('click',()=>{ CURRENT_FILTER.category = (CURRENT_FILTER.category===cat? null : cat); syncPills(); render(); });
      wrap.appendChild(d);
    });
    $('#pillAll').onclick = ()=>{ CURRENT_FILTER.category=null; syncPills(); render(); };
    syncPills();
  }
  function syncPills(){
    document.querySelectorAll('.pill').forEach(p=>p.classList.remove('active'));
    if(!CURRENT_FILTER.category) $('#pillAll').classList.add('active');
    document.querySelectorAll('#categoryPills .pill').forEach(p=>{ if(p.dataset.cat===CURRENT_FILTER.category) p.classList.add('active'); });
  }

  function filterItems(){
    const q = CURRENT_FILTER.q.trim().toLowerCase();
    return ALL_ITEMS.filter(it=>{
      if(CURRENT_FILTER.category && String(it.category)!==CURRENT_FILTER.category) return false;
      if(!q) return true;
      const hay = `${it.category}\n${it.question}\n${it.answer}`.toLowerCase();
      return hay.includes(q);
    });
  }

  function groupByCategory(items){ const g={}; for(const it of items){ const c=String(it.category||'その他'); (g[c] ||= []).push(it); } return g; }

  function render(){
    const container = ensureContainer();
    const items = filterItems();
    if(!items.length){ container.innerHTML = `<div class="alert">条件に一致するFAQがありません。</div>`; return; }
    const grouped = groupByCategory(items);
    const frag = document.createDocumentFragment();
    Object.entries(grouped).forEach(([cat,list])=>{
      const group = document.createElement('section'); group.className='group fadeIn';
      group.innerHTML = `<h2>${escapeHtml(cat)}</h2>`;
      list.forEach(it=>{
        const card=document.createElement('article'); card.className='card';
        const q=document.createElement('div'); q.className='q';
        const h3=document.createElement('h3'); h3.textContent=it.question??'';
        const chev=makeChevron(); q.appendChild(h3); q.appendChild(chev);
        const a=document.createElement('div'); a.className='a'; a.innerHTML=`<p>${escapeHtml(it.answer??'')}</p>`;
        let opened=false;
        q.addEventListener('click',()=>{
          opened=!opened; chev.style.transform = opened? 'rotate(180deg)':'rotate(0)';
          if(opened){ a.classList.add('open'); a.style.maxHeight = a.scrollHeight + 24 + 'px'; }
          else{ a.style.maxHeight='0px'; a.addEventListener('transitionend',()=>a.classList.remove('open'),{once:true}); }
        });
        card.appendChild(q); card.appendChild(a); group.appendChild(card);
      });
      frag.appendChild(group);
    });
    container.innerHTML=''; container.appendChild(frag);
  }

  // ここが Promise 版
  function loadFAQ(){
    return fetch(API_URL, {cache:'no-store'})
      .then(res => res.text())
      .then(text => {
        if(!text.startsWith('/*O_o*/')) throw new Error('シート公開設定またはID/タブ名を確認してください。');
        let json;
        try{ json = JSON.parse(text.substring(47, text.length-2)); }
        catch{ throw new Error('シート応答の解析に失敗しました。'); }
        let header = (json.table.cols||[]).map(c=> (c&&c.label)? String(c.label).trim(): '');
        let rows = (json.table.rows||[]).map(r=> (r.c||[]).map(c=> (c? c.v: '')));
        const invalid = header.every(h=> !h || /^[A-Z]$/.test(h));
        if(invalid && rows.length){ header = rows.shift().map(v=> String(v??'').trim()); }
        const map = buildHeaderMap(header); validateHeaders(map);
        ALL_ITEMS = rows.map(r=>({
          category: r[map['カテゴリ']] ?? '',
          question: r[map['質問']] ?? '',
          answer:   r[map['回答']] ?? '',
          public:   r[map['公開フラグ']]
        })).filter(it=> isPublic(it.public));

        const cats = [...new Set(ALL_ITEMS.map(it=> String(it.category||'その他')))]
          .sort((a,b)=> a.localeCompare(b,'ja'));
        buildPills(cats);
        render();
      });
  }

  // Landing
  function initLanding(){
    const landing = $('#landing');
    const url = new URL(location.href);
    const showLanding = url.searchParams.get('landing') === '1' || (cfg.showLandingByDefault && url.searchParams.get('landing') !== '0');
    if(showLanding) landing.hidden = false;

    $('#choices').addEventListener('click', (e)=>{
      const t = e.target.closest('.choice'); if(!t) return;
      landingChoice = t.dataset.action; document.querySelectorAll('.choice').forEach(c=>c.style.outline='none');
      t.style.outline = '2px solid rgba(123,255,199,.7)';
    });

    $('#startBtn').onclick = function(){
      landing.classList.add('fadeOutUp'); setTimeout(()=> landing.hidden = true, 500);
      if(landingChoice==='bySearch'){ $('#searchInput').focus(); }
      if(landingChoice==='byCategory'){ CURRENT_FILTER.category = null; syncPills(); window.scrollTo({top:0, behavior:'smooth'}); }
    };
    $('#skipBtn').onclick = function(){ landing.classList.add('fadeOutUp'); setTimeout(()=> landing.hidden = true, 500); };
    $('#openLanding').onclick = function(){ landing.hidden = false; landing.classList.remove('fadeOutUp'); };
  }

  function initSearch(){ $('#searchInput').addEventListener('input', (e)=>{ CURRENT_FILTER.q = e.target.value; render(); }); }
  function initReload(){
    $('#reload').onclick = function(){
      loadFAQ()
        .then(()=>{ showAlert('最新のデータに更新しました。'); setTimeout(()=>render(), 600); })
        .catch(e=> showAlert(e.message||String(e)));
    };
  }

  // DOM Ready
  document.addEventListener('DOMContentLoaded', function(){
    try{
      initLanding(); initSearch(); initReload();
      loadFAQ().catch(e=>{ showAlert(e.message || String(e)); console.error(e); });
    } catch(e){
      showAlert(e.message || String(e)); console.error(e);
    }
  });
})();

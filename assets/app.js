(function(){
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


async function loadFAQ(){
const res = await fetch(API_URL, {cache:'no-store'});
const text = await res.text();
if(!text.startsWith('/*O_o*/')) throw new Error('シート公開設定またはID/タブ名を確認してください。');
let json; try{ json = JSON.parse(text.substring(47, text.length-2)); } catch{ throw new Error('シート応答の解析に失敗しました。'); }
let header = (json.table.cols||[]).map(c=> (c&&c.label)? String(c.label).trim(): '');
let rows = (json.table.rows||[]).map(r=> (r.c||[]).map(c=> (c? c.v: '')));
const invalid = header.every(h=> !h || /^[A-Z]$/.test(h));
if(invalid && rows.length){ header = rows.shift().map(v=> String(v??'').trim()); }
const map = buildHeaderMap(header); validateHeaders(map);
ALL_ITEMS = rows.map(r=>({
category: r[map['カテゴリ']] ?? '',
question: r[map['質問']] ?? '',
answer: r[map['回答']] ?? '',
public: r[map['公開フラグ']]
})).filter(it=> isPublic(it.public));


const cats = [...new Set(ALL_ITEMS.map(it=> String(it.category||'その他')))].sort((a,b)=> a.localeCompare(b,'ja'));
buildPills(cats);
render();
}


// Landing interactions
function initLanding(){
const landing = $('#landing');
const url = new URL(location.href);
const showLanding = url.searchParams.get('landing') === '1' || (cfg.showLandingByDefault && url.searchParams.get('landing') !== '0');
if(showLanding) landing.hidden = false; // show on first load


$('#choices').addEventListener('click', (e)=>{
const t = e.target.closest('.choice'); if(!t) return;
landingChoice = t.dataset.action; document.querySelectorAll('.choice').forEach(c=>c.style.outline='none');
t.style.outline = '2px solid rgba(123,255,199,.7)';
});


$('#startBtn').onclick = ()=>{ landing.classList.add('fadeOutUp'); setTimeout(()=> landing.hidden = true, 500);
if(landingChoice==='bySearch'){ $('#searchInput').focus(); }
if(landingChoice==='byCategory'){ CURRENT_FILTER.category = null; syncPills(); window.scrollTo({top:0, behavior:'smooth'}); }
};
$('#skipBtn').onclick = ()=>{ landing.classList.add('fadeOutUp'); setTimeout(()=> landing.hidden = true, 500); };
$('#openLanding').onclick = ()=>{ landing.hidden = false; landing.classList.remove('fadeOutUp'); };
}


function initSearch(){ $('#searchInput').addEventListener('input', (e)=>{ CURRENT_FILTER.q = e.target.value; render(); }); }
function initReload(){ $('#reload').onclick = async ()=>{ try{ await loadFAQ(); showAlert('最新のデータに更新しました。'); setTimeout(()=>render(), 600);} catch(e){ showAlert(e.message||String(e)); } }; }


document.addEventListener('DOMContentLoaded', async ()=>{
try{ initLanding(); initSearch(); initReload(); await loadFAQ(); }
catch(e){ showAlert(e.message || String(e)); console.error(e); }
});
})();

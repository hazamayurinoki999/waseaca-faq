/* Keyword search page */
(function(){
  var ALL=[];
  function makeChevron(){ var el=document.createElement('span'); el.className='chev';
    el.innerHTML='<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>'; return el; }
  function render(q){
    var box=document.getElementById('kwResults');
    var query=(q||'').toLowerCase();
    if(!query){ box.innerHTML='<div class="alert">キーワードを入力してください。</div>'; return; }
    var results=[];
    ALL.forEach(function(it){
      var text=(it.category+' '+it.question+' '+it.answer).toLowerCase();
      var cnt=0,pos=text.indexOf(query); while(pos!==-1){ cnt++; pos=text.indexOf(query,pos+query.length); }
      if(cnt>0){ var score=cnt+(it.question.toLowerCase().indexOf(query)!==-1?2:0); results.push({it:it,score:score}); }
    });
    results.sort(function(a,b){ return b.score-a.score; });
    if(!results.length){ box.innerHTML='<div class="alert">見つかりませんでした。</div>'; return; }
    var frag=document.createDocumentFragment();
    results.slice(0,12).forEach(function(r){
      var hue=FAQ.hueByName(r.it.category);
      var card=document.createElement('article'); card.className='card'; card.style.setProperty('--cat-h',hue);
      var qv=document.createElement('div'); qv.className='q';
      var h3=document.createElement('h3'); h3.textContent=r.it.question||''; var ch=makeChevron();
      qv.appendChild(h3); qv.appendChild(ch);
      var a=document.createElement('div'); a.className='a'; a.innerHTML='<p>'+FAQ.escapeHtml(r.it.answer||'')+'</p>';
      var opened=false; qv.addEventListener('click', function(){ opened=!opened; ch.style.transform=opened?'rotate(180deg)':'rotate(0)'; if(opened){ a.classList.add('open'); a.style.maxHeight=(a.scrollHeight+24)+'px'; } else { a.style.maxHeight='0px'; a.addEventListener('transitionend', function(){ a.classList.remove('open'); }, {once:true}); }});
      card.appendChild(qv); card.appendChild(a); frag.appendChild(card);
    });
    box.innerHTML=''; box.appendChild(frag);
  }
  document.addEventListener('DOMContentLoaded', function(){
    FAQ.loadFAQ(FAQ_CONFIG).then(function(items){ ALL=items; }).catch(function(e){
      document.getElementById('kwResults').innerHTML='<div class="alert">'+FAQ.escapeHtml(e.message||String(e))+'</div>';
    });
    var input=document.getElementById('kwInput'); var btn=document.getElementById('kwRun');
    var run=function(){ render(input.value); };
    input.addEventListener('input', run); btn.addEventListener('click', run);
  });
})();

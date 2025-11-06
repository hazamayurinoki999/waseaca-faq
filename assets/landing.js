/* =========================================================
   Landing (入口) — choose a card and navigate immediately
   assets/landing.js
   - クリック/Enter/Spaceで遷移
   - 軽い選択演出（selectedクラス）
   - フォーカス管理＆アクセシビリティ
   - hover/focus時に prefetch (best-effort)
   ========================================================= */
(function(){
  function q(sel, root){ return (root||document).querySelector(sel); }
  function qa(sel, root){ return (root||document).querySelectorAll(sel); }

  function navigate(url){
    if(!url) return;
    try{
      // 小さな演出のため遅延（100ms）
      setTimeout(function(){ window.location.href = url; }, 100);
    }catch(e){
      // 失敗時は即遷移
      window.location.href = url;
    }
  }

  function selectCard(card){
    // 演出：選択カードを強調、他を薄く
    var cards = qa('.choice');
    for(var i=0;i<cards.length;i++){
      if(cards[i] === card){ cards[i].classList.add('selected'); cards[i].classList.remove('dim'); }
      else{ cards[i].classList.remove('selected'); cards[i].classList.add('dim'); }
    }
  }

  function handleActivate(card){
    if(!card) return;
    var to = card.getAttribute('data-to');
    if(!to) return;
    selectCard(card);
    navigate(to);
  }

  function addPrefetch(url){
    if(!url) return;
    // 既に同一URLのprefetchがあるならスキップ
    var links = qa('link[rel="prefetch"]');
    for(var i=0;i<links.length;i++){ if(links[i].href === url) return; }
    try{
      var l = document.createElement('link');
      l.rel = 'prefetch';
      l.href = url;
      l.as = 'document';
      document.head.appendChild(l);
    }catch(_){}
  }

  function setupCards(){
    var list = q('.choices');
    if(!list) return;

    // Make each .choice focusable like a button
    var cards = qa('.choice', list);
    for(var i=0;i<cards.length;i++){
      var c = cards[i];
      c.setAttribute('role','button');
      if(!c.hasAttribute('tabindex')) c.setAttribute('tabindex','0');

      // click/tap
      c.addEventListener('click', function(ev){
        var target = ev.currentTarget;
        handleActivate(target);
      });

      // keyboard (Enter / Space)
      c.addEventListener('keydown', function(ev){
        if(ev.key === 'Enter' || ev.key === ' ' || ev.key === 'Spacebar'){
          ev.preventDefault();
          handleActivate(ev.currentTarget);
        }
      });

      // prefetch on hover/focus
      (function(el){
        var to = el.getAttribute('data-to');
        el.addEventListener('mouseenter', function(){ addPrefetch(to); });
        el.addEventListener('focus', function(){ addPrefetch(to); });
        el.addEventListener('touchstart', function(){ addPrefetch(to); }, {passive:true});
      })(c);
    }
  }

  document.addEventListener('DOMContentLoaded', function(){
    setupCards();
  });
})();

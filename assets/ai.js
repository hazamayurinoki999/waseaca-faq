/* AI placeholder */
(function(){
  document.addEventListener('DOMContentLoaded', function(){
    var box=document.getElementById('chatBox');
    var send=document.getElementById('aiSend');
    send.addEventListener('click', function(){
      var t=document.getElementById('aiInput'); var v=(t.value||'').trim(); if(!v) return; t.value='';
      var me=document.createElement('div'); me.className='bubble me'; me.textContent=v; box.appendChild(me);
      var bot=document.createElement('div'); bot.className='bubble bot'; bot.textContent='（デモ）AI連携は後日実装します。'; box.appendChild(bot);
      box.scrollTop=box.scrollHeight;
    });
  });
})();

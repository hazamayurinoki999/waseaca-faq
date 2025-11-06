/* Landing: pick a mode then navigate */
(function(){
  var choice = null;
  function $(s){ return document.querySelector(s); }
  function pick(target){
    var cards = document.querySelectorAll('.choice');
    Array.prototype.forEach.call(cards, function(c){
      if(c===target){ c.classList.add('selected'); c.classList.remove('dim'); }
      else{ c.classList.remove('selected'); c.classList.add('dim'); }
    });
    choice = target ? target.dataset.to : null;
    var start = $('#startBtn'); if(start) start.disabled = !choice;
  }
  document.addEventListener('DOMContentLoaded', function(){
    var list = document.querySelector('.choices');
    if(list){
      list.addEventListener('click', function(e){
        var c = e.target.closest('.choice'); if(!c) return;
        pick(c);
      });
    }
    var start = $('#startBtn');
    if(start){
      start.disabled = true;
      start.addEventListener('click', function(){ if(choice) location.href = choice; });
    }
  });
})();

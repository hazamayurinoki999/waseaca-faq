(function(){
  var history = [];
  var chatBox, input, send, reminder;
  var endpoint = (window.FAQ_CONFIG && FAQ_CONFIG.AI_ENDPOINT) || '/api/chat';

  function scrollToBottom(){
    if (!chatBox) return;
    chatBox.scrollTop = chatBox.scrollHeight;
  }

  function appendBubble(role, text){
    if (!chatBox) return null;
    var bubble = document.createElement('div');
    bubble.className = 'bubble ' + role;
    bubble.textContent = text;
    chatBox.appendChild(bubble);
    scrollToBottom();
    return bubble;
  }

  function appendReferences(references){
    if (!chatBox || !references || !references.length) return;
    var wrap = document.createElement('div');
    wrap.className = 'bubble bot';
    var title = document.createElement('div');
    title.className = 'ref-title';
    title.textContent = '参照FAQ';
    wrap.appendChild(title);

    var list = document.createElement('ul');
    list.className = 'refs';
    references.forEach(function(ref){
      var item = document.createElement('li');
      var link = document.createElement('a');
      link.textContent = ref.question || ref.url || 'FAQリンク';
      link.href = ref.url || (FAQ_CONFIG && FAQ_CONFIG.HOME_URL) || '#';
      link.target = '_blank';
      link.rel = 'noopener';
      item.appendChild(link);
      if (ref.answer){
        var detail = document.createElement('div');
        detail.className = 'ref-desc';
        detail.textContent = ref.answer;
        item.appendChild(detail);
      }
      list.appendChild(item);
    });
    wrap.appendChild(list);
    chatBox.appendChild(wrap);
    scrollToBottom();
  }

  function setLoading(state){
    if (!send) return;
    send.disabled = state;
    send.textContent = state ? '送信中…' : '送信';
  }

  function handleError(error){
    console.error(error);
    appendBubble('bot', 'エラーが発生しました。時間をおいて再度お試しください。');
  }

  function sendMessage(){
    if (!input) return;
    var value = (input.value || '').trim();
    if (!value) return;
    input.value = '';
    appendBubble('me', value);
    setLoading(true);

    var payload = {
      message: value,
      history: history.slice(-6)
    };

    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(function(res){
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function(data){
        var answer = data && data.answer ? String(data.answer) : '回答を取得できませんでした。';
        appendBubble('bot', answer);
        if (Array.isArray(data && data.references)) {
          appendReferences(data.references);
        }
        if (data && data.reminder && reminder) {
          reminder.textContent = data.reminder;
        }
        history.push({ role: 'user', content: value });
        history.push({ role: 'assistant', content: answer });
      })
      .catch(handleError)
      .finally(function(){ setLoading(false); scrollToBottom(); });
  }

  document.addEventListener('DOMContentLoaded', function(){
    chatBox = document.getElementById('chatBox');
    input = document.getElementById('aiInput');
    send = document.getElementById('aiSend');
    reminder = document.getElementById('aiReminder');
    if (!chatBox || !input || !send) return;

    send.addEventListener('click', sendMessage);
    input.addEventListener('keydown', function(evt){
      if (evt.key === 'Enter' && !evt.shiftKey){
        evt.preventDefault();
        sendMessage();
      }
    });
  });
})();

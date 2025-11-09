/* assets/ai.js — AIチャット + キャラアニメ（右下フロート版） */
(function(){
  // ====== 設定解決 ======
  var endpoint =
    (window.APP_CONFIG && window.APP_CONFIG.AI_PROXY_ENDPOINT) ||
    (window.CONFIG && window.CONFIG.AI_ENDPOINT) ||
    (window.FAQ_CONFIG && window.FAQ_CONFIG.AI_ENDPOINT) ||
    '/api/chat';

  // ====== DOM 参照 ======
  var chatBox, input, send, reminder;
  var charImg, balloonText, indicator;
  var history = [];
  var knowledge = [];
  var pendingReferences = [];
  var waitTimer = null;
  var talkTimer = null;
  var typingTimer = null;

  // 画像パス
  var CHAR = {
    idle:   'assets/img/char/char_idle.png',
    search: 'assets/img/char/char_search.png',
    wait:   'assets/img/char/char_wait.png',
    talk:   'assets/img/char/char_talk_open.png',
    sorry:  'assets/img/char/char_apology.png',
  };

  // ====== Utils ======
  function scrollToBottom(){ if (chatBox){ chatBox.scrollTop = chatBox.scrollHeight; } }
  function setChar(src){ if (charImg) charImg.src = src || CHAR.idle; }
  function setBalloon(text){ if (balloonText) balloonText.textContent = text || ''; }
  function showIndicator(show){ if (indicator) indicator.hidden = !show; }
  function clearTimers(){
    if (waitTimer){ clearTimeout(waitTimer); waitTimer = null; }
    if (talkTimer){ clearInterval(talkTimer); talkTimer = null; }
    if (typingTimer){ clearInterval(typingTimer); typingTimer = null; }
  }

  function startSearchingUI(){
    clearTimers();
    setChar(CHAR.search);
    setBalloon('ボクが探してくるね、ちょっと待ってて！');
    showIndicator(true);                 // ➀ 検索中だけ表示
    // 30秒超で「ハテナ」
    waitTimer = setTimeout(function(){
      setChar(CHAR.wait);
      setBalloon('うーん…もう少しだけ時間をちょうだい！');
    }, 30000);
  }

  function startTalkingUI(fullText, doneCb){
    clearTimers();
    showIndicator(false);
    // 口パク
    var open = false;
    talkTimer = setInterval(function(){
      open = !open;
      setChar(open ? CHAR.talk : CHAR.idle);
    }, 160);
    // 吹き出し（上側の最新だけ短文を表示）
    var firstSentence = String(fullText||'').split(/(?<=。|！|!|？|\?)/)[0] || fullText;
    setBalloon(firstSentence);
    // チャット欄へタイプ出力
    typewriteToChat(fullText, function(){
      clearTimers();
      setChar(CHAR.idle);
      if (doneCb) doneCb();
    });
  }

  function typewriteToChat(text, onDone){
    var bubble = appendBubble('bot', '');
    var i = 0, arr = String(text||'').split('');
    typingTimer = setInterval(function(){
      if (i >= arr.length){
        clearInterval(typingTimer); typingTimer = null;
        if (onDone) onDone();
        return;
      }
      bubble.textContent += arr[i++];
      scrollToBottom();
    }, 16);
  }

  function appendBubble(role, text){
    var el = document.createElement('div');
    el.className = 'bubble ' + role;
    el.textContent = text || '';
    chatBox.appendChild(el);
    scrollToBottom();
    return el;
  }

  function appendReferences(references){
    if (!references || !references.length) return;
    var wrap = document.createElement('div');
    wrap.className = 'bubble bot';
    var title = document.createElement('div');
    title.className = 'ref-title';
    title.textContent = '参照情報';
    wrap.appendChild(title);

    var list = document.createElement('ul'); list.className = 'refs';
    references.forEach(function(ref){
      var li = document.createElement('li');
      var a = document.createElement('a');
      var home = (window.FAQ_CONFIG && window.FAQ_CONFIG.HOME_URL) ||
                 (window.CONFIG && (window.CONFIG.HOME_URL || window.CONFIG.HP_LINK));
      a.textContent = ref.question || ref.url || 'FAQリンク';
      a.href = ref.url || home || '#';
      a.target = '_blank'; a.rel = 'noopener';
      li.appendChild(a);
      if (ref.answer){
        var d = document.createElement('div');
        d.className = 'ref-desc';
        d.textContent = ref.answer;
        li.appendChild(d);
      }
      list.appendChild(li);
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

  function tokenize(text){
    return Array.from(new Set(String(text||'').toLowerCase()
      .replace(/([。、，・！？・\-])/g,' ')
      .split(/[^ぁ-んァ-ン一-龥a-z0-9]+/).filter(Boolean)));
  }
  function rankByQuery(query, limit){
    if (!knowledge.length) return [];
    var q = tokenize(query); if (!q.length) return [];
    return knowledge.map(function(item){
      var t = new Set([].concat(tokenize(item.question), tokenize(item.answer)));
      var ov = q.filter(function(x){ return t.has(x); });
      var score = ov.length / Math.max(t.size||1,1);
      return Object.assign({}, item, { score:score });
    }).filter(function(x){ return x.score>0; })
      .sort(function(a,b){ return b.score-a.score; })
      .slice(0, Math.min(limit||3, knowledge.length));
  }
  function buildAnswerFromReferences(refs){
    if (!refs || !refs.length) return '回答を取得できませんでした。';
    var head = 'AI応答が取れなかったから、近そうなFAQを案内するね。';
    return [head,'', refs.map(r=>'・'+(r.question||r.url||'FAQ')).join('\n')].join('\n');
  }
  function extractAnswer(data){
    if (data && data.ok === false) return '';
    if (data && typeof data.answer === 'string') return data.answer;
    try{
      var c = data.candidates;
      if (Array.isArray(c) && c[0] && c[0].content && Array.isArray(c[0].content.parts)){
        var parts = c[0].content.parts;
        var text = parts.map(p => p.text || '').join('').trim();
        if (text) return text;
      }
    }catch(_){}
    return '';
  }

  function handleError(err){
    console.error('[AI] error:', err);
    clearTimers();
    setChar(CHAR.sorry);                  // ⑤ 常に謝る絵に
    setBalloon('ごめん、エラーが出ちゃった…。もう一度ためしてみて！');
    showIndicator(false);
    var msg = pendingReferences.length ? buildAnswerFromReferences(pendingReferences)
                                       : 'エラーが発生しました。時間をおいて再度お試しください。';
    startTalkingUI(msg);
    if (pendingReferences.length) appendReferences(pendingReferences);
    pendingReferences = [];
  }

  function loadKnowledgeBase(){
    try{
      if (!window.FAQ || typeof window.FAQ.loadFAQ !== 'function') return;
      var cfg = window.FAQ_CONFIG || window.CONFIG || {};
      window.FAQ.loadFAQ(cfg).then(function(list){
        knowledge = Array.isArray(list) ? list : [];
      }).catch(function(e){ console.warn('[AI] loadFAQ failed', e); });
    }catch(e){ console.warn('[AI] loadKB error', e); }
  }

  // ====== 送信処理 ======
  function sendMessage(){
    var value = (input.value || '').trim();
    if (!value) return;

    input.value = '';
    appendBubble('me', value);
    setLoading(true);
    startSearchingUI();                    // ➀ 検索UI開始
    pendingReferences = rankByQuery(value, 3);

    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ message:value, history:history.slice(-6) })
    })
    .then(function(res){
      if (!res.ok) throw new Error('HTTP '+res.status);
      return res.json();
    })
    .then(function(data){
      clearTimers(); setChar(CHAR.idle); showIndicator(false);
      var references = Array.isArray(data && data.references) ? data.references : [];
      var raw = extractAnswer(data);

      var finalAnswer = raw;
      if ((!finalAnswer || !finalAnswer.trim()) && data && data.error){
        finalAnswer = 'AI応答を取得できませんでした: ' + data.error;
      }
      if ((!finalAnswer || !finalAnswer.trim()) && pendingReferences.length){
        finalAnswer = buildAnswerFromReferences(pendingReferences);
      }

      if (!finalAnswer || !finalAnswer.trim()){
        // 返答なし → 謝る絵＋短文
        setChar(CHAR.sorry);
        setBalloon('ごめんね、うまく見つけられなかった…。もう少し詳しく教えてくれる？');
        appendBubble('bot', '分かりませんでした。公式サイトをご確認いただくか、お問い合わせください。');
        if (pendingReferences.length) appendReferences(pendingReferences);
        history.push({ role:'user', content:value });
        history.push({ role:'assistant', content:'（no answer）' });
        setLoading(false);
        pendingReferences = [];
        return;
      }

      // 返答あり → 口パクで解説
      startTalkingUI(finalAnswer, function(){
        if (references.length){ appendReferences(references); }
        else if (pendingReferences.length){ appendReferences(pendingReferences); }
      });

      history.push({ role:'user', content:value });
      history.push({ role:'assistant', content:finalAnswer });
      if (data && data.reminder && reminder) reminder.textContent = data.reminder;
    })
    .catch(handleError)
    .finally(function(){
      setLoading(false);
      pendingReferences = [];
      scrollToBottom();
    });
  }

  // ====== 起動 ======
  document.addEventListener('DOMContentLoaded', function(){
    chatBox  = document.getElementById('chatBox');
    input    = document.getElementById('aiInput');
    send     = document.getElementById('aiSend');
    reminder = document.getElementById('aiReminder');
    charImg        = document.getElementById('charImg');
    balloonText    = document.getElementById('charBalloonText');
    indicator      = document.getElementById('charIndicator');

    // 初期はインジケータを必ず消す
    showIndicator(false);

    if (send){ send.addEventListener('click', sendMessage); }
    if (input){
      input.addEventListener('keydown', function(evt){
        if (evt.key === 'Enter' && !evt.shiftKey){
          evt.preventDefault(); sendMessage();
        }
      });
    }
    loadKnowledgeBase();
  });
})();

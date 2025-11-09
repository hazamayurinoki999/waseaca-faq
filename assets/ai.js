/* assets/ai.js — AIチャット + キャラアニメ対応版 */
(function(){
  // ====== 設定解決 ======
  var endpoint =
    (window.APP_CONFIG && window.APP_CONFIG.AI_PROXY_ENDPOINT) ||
    (window.CONFIG && window.CONFIG.AI_ENDPOINT) ||
    (window.FAQ_CONFIG && window.FAQ_CONFIG.AI_ENDPOINT) ||
    '/api/chat';

  // ====== DOM 参照 ======
  var chatBox, input, send, reminder;
  var charImg, balloon, balloonText, indicator;
  var history = [];           // 直近履歴
  var knowledge = [];         // 参照候補用
  var pendingReferences = []; // フォールバック参照
  var waitTimer = null;       // 30秒待ち切り
  var talkTimer = null;       // 口パク
  var typingTimer = null;     // タイプライタ

  // 画像パス（ファイル名はこの通りに配置）
  var CHAR = {
    idle:   'assets/img/char/char_idle.png',
    search: 'assets/img/char/char_search.png',
    wait:   'assets/img/char/char_wait.png',
    talk:   'assets/img/char/char_talk_open.png',
    sorry:  'assets/img/char/char_apology.png',
  };

  // ====== ユーティリティ ======
  function scrollToBottom(){
    if (!chatBox) return;
    chatBox.scrollTop = chatBox.scrollHeight;
  }

  function setChar(src){
    if (charImg) charImg.src = src || CHAR.idle;
  }

  function setBalloon(text){
    if (balloonText) balloonText.textContent = text || '';
  }

  function showIndicator(show){
    if (!indicator) return;
    indicator.hidden = !show;
  }

  function clearTimers(){
    if (waitTimer){ clearTimeout(waitTimer); waitTimer = null; }
    if (talkTimer){ clearInterval(talkTimer); talkTimer = null; }
    if (typingTimer){ clearInterval(typingTimer); typingTimer = null; }
  }

  function startSearchingUI(){
    clearTimers();
    setChar(CHAR.search);
    setBalloon('ボクが探してくるね、ちょっと待ってて！');
    showIndicator(true);
    // 30秒経過で「ハテナ」へ
    waitTimer = setTimeout(function(){
      setChar(CHAR.wait);
      setBalloon('うーん…情報が見つかるか、もう少しだけ待ってね。');
    }, 30000);
  }

  function startTalkingUI(fullText, doneCb){
    clearTimers();
    showIndicator(false);

    // 口パク（idle と talk を交互）
    var mouthOpen = false;
    talkTimer = setInterval(function(){
      mouthOpen = !mouthOpen;
      setChar(mouthOpen ? CHAR.talk : CHAR.idle);
    }, 180);

    // 吹き出しタイプライタ + チャットバブルへもタイプ出力
    typewriteToChat(fullText, function(){
      // 喋り終えたら idle に戻す
      clearTimers();
      setChar(CHAR.idle);
      if (doneCb) doneCb();
    });
  }

  function typewriteToChat(text, onDone){
    var bubble = appendBubble('bot', '');
    var i = 0;
    var arr = String(text||'').split('');
    typingTimer = setInterval(function(){
      if (i >= arr.length){
        clearInterval(typingTimer); typingTimer = null;
        if (onDone) onDone();
        return;
      }
      bubble.textContent += arr[i++];
      scrollToBottom();
    }, 18); // 速さはお好みで
  }

  function appendBubble(role, text){
    if (!chatBox) return null;
    var bubble = document.createElement('div');
    bubble.className = 'bubble ' + role;
    bubble.textContent = text || '';
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
    title.textContent = '参照情報';
    wrap.appendChild(title);

    var list = document.createElement('ul');
    list.className = 'refs';
    references.forEach(function(ref){
      var item = document.createElement('li');
      var link = document.createElement('a');

      var home = (window.FAQ_CONFIG && window.FAQ_CONFIG.HOME_URL) ||
                 (window.CONFIG && (window.CONFIG.HOME_URL || window.CONFIG.HP_LINK));

      link.textContent = ref.question || ref.url || 'FAQリンク';
      link.href = ref.url || home || '#';
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

  function tokenize(text){
    return Array.from(new Set(String(text || '')
      .toLowerCase()
      .replace(/([。、，・！？・\-])/g, ' ')
      .split(/[^ぁ-んァ-ン一-龥a-z0-9]+/).filter(Boolean)));
  }

  function rankByQuery(query, limit){
    if (!knowledge.length) return [];
    var qTokens = tokenize(query);
    if (!qTokens.length) return [];
    return knowledge.map(function(item){
      var tokens = new Set([].concat(tokenize(item.question), tokenize(item.answer)));
      var overlap = qTokens.filter(function(t){ return tokens.has(t); });
      var score = overlap.length / Math.max(tokens.size || 1, 1);
      return Object.assign({}, item, { score: score });
    }).filter(function(item){ return item.score > 0; })
      .sort(function(a,b){ return b.score - a.score; })
      .slice(0, Math.min(limit || 3, knowledge.length));
  }

  function buildAnswerFromReferences(refs){
    if (!refs || !refs.length) return '回答を取得できませんでした。';
    var head = 'AI応答が取れなかったから、近そうなFAQを案内するね。';
    var lines = refs.map(function(ref){ return '・' + (ref.question || ref.url || 'FAQ'); });
    return [head, '', lines.join('\n')].join('\n');
  }

  function extractAnswer(data){
    if (data && data.ok === false) return '';
    if (data && typeof data.answer === 'string') return data.answer;
    try{
      var c = data.candidates;
      if (Array.isArray(c) && c[0] && c[0].content && Array.isArray(c[0].content.parts)) {
        var parts = c[0].content.parts;
        var text = parts.map(function(p){ return p.text || ''; }).join('').trim();
        if (text) return text;
      }
    }catch(_){}
    return '';
  }

  function handleError(error){
    console.error('[AI] error:', error);
    clearTimers();
    setChar(CHAR.sorry);
    setBalloon('ごめん、エラーが出ちゃった…。もう一度ためしてみて！');
    showIndicator(false);

    if (pendingReferences.length){
      startTalkingUI(buildAnswerFromReferences(pendingReferences));
      appendReferences(pendingReferences);
      pendingReferences = [];
    } else {
      startTalkingUI('エラーが発生しました。時間をおいて再度お試しください。');
    }
  }

  function loadKnowledgeBase(){
    try{
      if (!window.FAQ || typeof window.FAQ.loadFAQ !== 'function') return;
      var cfg = window.FAQ_CONFIG || window.CONFIG || {};
      window.FAQ.loadFAQ(cfg).then(function(list){
        knowledge = Array.isArray(list) ? list : [];
      }).catch(function(err){ console.warn('[AI] failed to load FAQ data', err); });
    }catch(err){ console.warn('[AI] loadKnowledgeBase error', err); }
  }

  // ====== 送信処理 ======
  function sendMessage(){
    if (!input) return;
    var value = (input.value || '').trim();
    if (!value) return;

    input.value = '';
    appendBubble('me', value);
    setLoading(true);

    // キャラ：検索モード開始
    startSearchingUI();

    // 事前参照候補（フォールバック用）
    pendingReferences = rankByQuery(value, 3);

    // リクエスト送信
    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // プリフライト回避
      body: JSON.stringify({
        message: value,
        history: history.slice(-6)
      })
    })
      .then(function(res){
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function(data){
        var references = Array.isArray(data && data.references) ? data.references : [];
        var rawAnswer = extractAnswer(data);

        clearTimers(); // 検索モード終了
        setChar(CHAR.idle);
        showIndicator(false);

        var finalAnswer = rawAnswer;
        if ((!finalAnswer || !finalAnswer.trim()) && data && data.error){
          finalAnswer = 'AI応答を取得できませんでした: ' + data.error;
        }
        if ((!finalAnswer || !finalAnswer.trim()) && pendingReferences.length){
          finalAnswer = buildAnswerFromReferences(pendingReferences);
        }
        if (!finalAnswer || !finalAnswer.trim()){
          // 返答なし → 謝る
          setChar(CHAR.sorry);
          setBalloon('ごめんね、うまく見つけられなかった…。もう少し詳しく教えてくれる？');
          appendBubble('bot', '分かりませんでした。公式サイトをご確認いただくか、お問い合わせください。');
          if (pendingReferences.length) appendReferences(pendingReferences);
          pendingReferences = [];
          setLoading(false);
          history.push({ role:'user', content:value });
          history.push({ role:'assistant', content:'（no answer）' });
          return;
        }

        // 返答あり → 口パクで喋る
        setBalloon('見つかったよ！説明するね。');
        startTalkingUI(finalAnswer, function(){
          // 終了後：参照を表示
          if (references.length){
            appendReferences(references);
          } else if (pendingReferences.length){
            appendReferences(pendingReferences);
          }
        });

        // 履歴
        history.push({ role: 'user',      content: value        });
        history.push({ role: 'assistant', content: finalAnswer  });

        // リマインダ更新
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

    charImg      = document.getElementById('charImg');
    balloon      = document.getElementById('charBalloon');
    balloonText  = document.getElementById('charBalloonText');
    indicator    = document.getElementById('charIndicator');

    if (send){
      send.addEventListener('click', sendMessage);
    }
    if (input){
      input.addEventListener('keydown', function(evt){
        if (evt.key === 'Enter' && !evt.shiftKey){
          evt.preventDefault();
          sendMessage();
        }
      });
    }

    loadKnowledgeBase();
  });

})();

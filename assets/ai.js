/* assets/ai.js — Gemini プロキシ呼び出し用（完全版）
 * - endpoint は window.APP_CONFIG.AI_PROXY_ENDPOINT（例: .../exec?action=ai）
 *   → なければ window.CONFIG.AI_ENDPOINT / window.FAQ_CONFIG.AI_ENDPOINT を順に参照
 * - POST は text/plain で送信（プリフライト回避）
 * - レスポンスは {answer:"..."} でも Gemini 生JSON でも読めるようにパース
 * - 画面要素ID: chatBox, aiInput, aiSend, aiReminder
 */
(function(){
  // ====== 設定解決 ======
  var endpoint =
    (window.APP_CONFIG && window.APP_CONFIG.AI_PROXY_ENDPOINT) ||
    (window.CONFIG && window.CONFIG.AI_ENDPOINT) ||
    (window.FAQ_CONFIG && window.FAQ_CONFIG.AI_ENDPOINT) ||
    '/api/chat'; // 最後の保険（使われない想定）

  // ====== DOM 参照 ======
  var chatBox, input, send, reminder;
  var history = []; // {role:'user'|'assistant', content:string} の配列（最後の数件だけ送る）
  var knowledge = [];
  var pendingReferences = [];

  // ====== ユーティリティ ======
  function scrollToBottom(){
    if (!chatBox) return;
    chatBox.scrollTop = chatBox.scrollHeight;
  }

  function appendBubble(role, text){
    if (!chatBox) return null;
    var bubble = document.createElement('div');
    bubble.className = 'bubble ' + role; // CSS: .bubble.me / .bubble.bot
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

  function handleError(error){
    console.error('[AI] error:', error);
    if (pendingReferences.length){
      appendBubble('bot', buildAnswerFromReferences(pendingReferences));
      appendReferences(pendingReferences);
      pendingReferences = [];
    } else {
      appendBubble('bot', 'エラーが発生しました。時間をおいて再度お試しください。');
    }
  }

  // Gemini/自前の両レスポンスに対応して本文を抽出
  function extractAnswer(data){
    if (data && data.ok === false) return '';
    // 1) 自前形式 { answer: "..." }
    if (data && typeof data.answer === 'string') return data.answer;

    // 2) Gemini 生JSON
    try{
      var c = data.candidates;
      if (Array.isArray(c) && c[0] && c[0].content && Array.isArray(c[0].content.parts)) {
        // parts: [{ text }, { text }, ...] の連結
        var parts = c[0].content.parts;
        var text = parts.map(function(p){ return p.text || ''; }).join('').trim();
        if (text) return text;
      }
    }catch(_){ /* fallthrough */ }

    // 3) 他の形式（例: safety/rating 等のみ）に備えたフォールバック
    return '';
  }

  function tokenize(text){
    return Array.from(new Set(String(text || '')
      .toLowerCase()
      .replace(/([。、，・！？・\-])/g, ' ')
      .split(/[^ぁ-んァ-ン一-龥a-z0-9]+/)
      .filter(Boolean)));
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
    var head = 'AI応答を取得できなかったため、FAQから参考になりそうな情報をご案内します。';
    var lines = refs.map(function(ref){
      return '・' + (ref.question || ref.url || 'FAQ');
    });
    return [head, '', lines.join('\n')].join('\n');
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

    pendingReferences = rankByQuery(value, 3);

    var payload = {
      message: value,
      // 履歴は直近6 turnsだけ送る（過剰トークン抑制）
      history: history.slice(-6)
    };

    fetch(endpoint, {
      method: 'POST',
      // ← これが超重要：Simple Request にしてプリフライト回避
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    })
      .then(function(res){
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function(data){
        // 本文抽出（どの形式でもOK）
        var answer = extractAnswer(data);
        var references = Array.isArray(data && data.references) ? data.references : [];

        if ((!answer || !answer.trim()) && data && data.error){
          answer = 'AI応答を取得できませんでした: ' + data.error;
        }

        if ((!answer || !answer.trim()) && pendingReferences.length){
          answer = buildAnswerFromReferences(pendingReferences);
        }

        if (!answer || !answer.trim()){
          answer = '回答を取得できませんでした。';
        }

        appendBubble('bot', answer);

        // 参照リンク（存在すれば表示・無ければ FAQ 検索結果を表示）
        if (references.length){
          appendReferences(references);
        } else if (pendingReferences.length){
          appendReferences(pendingReferences);
        }

        // リマインド用のメッセージ（存在すれば差し替え）
        if (data && data.reminder && reminder) reminder.textContent = data.reminder;

        // 履歴更新
        history.push({ role: 'user',      content: value  });
        history.push({ role: 'assistant', content: answer });
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

    if (!chatBox || !input || !send) return;

    send.addEventListener('click', sendMessage);
    input.addEventListener('keydown', function(evt){
      if (evt.key === 'Enter' && !evt.shiftKey){
        evt.preventDefault();
        sendMessage();
      }
    });
  });

  document.addEventListener('DOMContentLoaded', loadKnowledgeBase);
})();

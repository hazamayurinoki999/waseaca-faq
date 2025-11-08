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

  function clone(obj){
    try { return JSON.parse(JSON.stringify(obj || null)) || null; }
    catch (_){ return null; }
  }

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

  function prepareRecord(entry){
    var rec = {
      question: entry.question || entry.q || '',
      answer: entry.answer || entry.a || '',
      url: entry.url || entry.href || '',
      source: entry.source || '',
    };
    rec.tokens = tokenize([rec.question, rec.answer, rec.url].join(' '));
    return rec;
  }

  function rankByQuery(query, limit){
    if (!knowledge.length) return [];
    var qTokens = tokenize(query);
    if (!qTokens.length) return [];
    return knowledge.map(function(item){
      var tokens = Array.isArray(item.tokens) ? item.tokens : tokenize([item.question, item.answer, item.url].join(' '));
      var overlap = qTokens.filter(function(t){ return tokens.indexOf(t) !== -1; });
      var score = overlap.length / Math.max(tokens.length || 1, 1);
      return Object.assign({}, item, { score: score });
    }).filter(function(item){ return item.score > 0; })
      .sort(function(a,b){ return b.score - a.score; })
      .slice(0, Math.min(limit || 3, knowledge.length));
  }

  function isRefusal(answer){
    if (!answer) return true;
    var normalized = String(answer || '').replace(/[\s\u3000]+/g, '');
    if (!normalized) return true;
    var keywords = ['わかりません', '分かりません', '分かりかねます', 'お答えできません', '対応できません', '不明です'];
    return keywords.some(function(word){ return normalized.indexOf(word) !== -1; });
  }

  function buildContextBlock(refs){
    if (!refs || !refs.length) return '';
    return refs.map(function(ref, idx){
      var lines = [];
      lines.push('【' + (idx + 1) + '】' + (ref.question || ref.url || '関連情報'));
      if (ref.answer) lines.push(ref.answer);
      if (ref.url) lines.push('URL: ' + ref.url);
      return lines.join('\n');
    }).join('\n\n');
  }

  function buildAnswerFromReferences(refs){
    if (!refs || !refs.length) return '回答を取得できませんでした。';
    var top = refs[0] || {};
    var message = [
      'AIからの回答を得られなかったため、FAQから見つかった情報を共有します。',
      '',
      (top.question ? '■ ' + top.question : ''),
      top.answer || '',
    ].filter(Boolean).join('\n');

    if (refs.length > 1){
      message += '\n\nその他の参考情報:\n' + refs.slice(1).map(function(ref){
        return '・' + (ref.question || ref.url || 'FAQ');
      }).join('\n');
    }

    if (top.url){
      message += '\n\n詳細はこちら: ' + top.url;
    }

    return message;
  }

  function loadKnowledgeBase(){
    var cfg = window.CONFIG || {};
    var endpoint = (cfg && cfg.APPS_SCRIPT_ENDPOINT) || '';
    var fetched = false;

    function applyData(payload){
      knowledge = [];
      var combined = [];
      if (payload && Array.isArray(payload.faq)){
        payload.faq.forEach(function(item){
          if (!item) return;
          combined.push(prepareRecord({
            question: item['質問'] || item.question,
            answer: item['回答'] || item.answer,
            url: item['引用URL'] || item.url,
            source: 'faq'
          }));
        });
      }
      if (payload && Array.isArray(payload.knowledge)){
        payload.knowledge.forEach(function(item){
          if (!item) return;
          combined.push(prepareRecord({
            question: item['質問'] || item.question,
            answer: item['回答'] || item.answer,
            url: item['参照URL'] || item.url,
            source: 'knowledge'
          }));
        });
      }
      if (payload && Array.isArray(payload.allowedLinks)){
        payload.allowedLinks.forEach(function(item){
          if (!item || !String(item.URL || item.url || '').trim()) return;
          combined.push(prepareRecord({
            question: item['メモ'] || item.memo || item.URL || item.url,
            answer: item['メモ'] || item.memo || '',
            url: item['URL'] || item.url,
            source: 'link'
          }));
        });
      }
      knowledge = combined;
    }

    if (endpoint){
      try {
        fetch(endpoint, { method: 'GET', mode: 'cors', cache: 'no-store' })
          .then(function(res){ if (!res.ok) throw new Error('HTTP ' + res.status); fetched = true; return res.json(); })
          .then(function(json){ applyData(json); })
          .catch(function(err){
            if (!fetched) console.warn('[AI] failed to fetch app config dataset', err);
            fallbackLoad();
          });
        return;
      } catch (error) {
        console.warn('[AI] loadKnowledgeBase fetch error', error);
      }
    }
    fallbackLoad();

    function fallbackLoad(){
      try{
        if (!window.FAQ || typeof window.FAQ.loadFAQ !== 'function') return;
        var cfg = window.FAQ_CONFIG || window.CONFIG || {};
        window.FAQ.loadFAQ(cfg).then(function(list){
          knowledge = Array.isArray(list) ? list.map(function(item){
            return prepareRecord({
              question: item.question,
              answer: item.answer,
              url: item.url,
              source: 'faq'
            });
          }) : [];
        }).catch(function(err){ console.warn('[AI] failed to load FAQ data', err); });
      }catch(err){ console.warn('[AI] loadKnowledgeBase error', err); }
    }
  }

  // ====== 送信処理 ======
  function sendMessage(){
    if (!input) return;
    var value = (input.value || '').trim();
    if (!value) return;

    input.value = '';
    appendBubble('me', value);
    setLoading(true);

    pendingReferences = rankByQuery(value, 5);

    var refsForPrompt = clone(pendingReferences) || [];
    var contextBlock = buildContextBlock(refsForPrompt);
    var promptMessage = value;
    if (contextBlock){
      promptMessage += '\n\n---\n以下はFAQやナレッジベースの参考情報です:\n' + contextBlock;
    }

    var payload = {
      message: promptMessage,
      rawQuestion: value,
      // 履歴は直近6 turnsだけ送る（過剰トークン抑制）
      history: history.slice(-6)
    };

    if (contextBlock){
      payload.context = contextBlock;
    }

    if (refsForPrompt.length){
      payload.references = refsForPrompt.map(function(ref){
        return {
          question: ref.question,
          answer: ref.answer,
          url: ref.url,
          source: ref.source
        };
      });
    }

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
        var referenceSource = references.length ? references : refsForPrompt;

        if ((!answer || !answer.trim()) && data && data.error){
          answer = 'AI応答を取得できませんでした: ' + data.error;
        }

        if ((!answer || !answer.trim()) && referenceSource.length){
          answer = buildAnswerFromReferences(referenceSource);
        }

        if (!answer || !answer.trim()){
          answer = '回答を取得できませんでした。';
        }

        if (isRefusal(answer) && referenceSource.length){
          answer = buildAnswerFromReferences(referenceSource);
          references = referenceSource;
        }

        appendBubble('bot', answer);

        // 参照リンク（存在すれば表示・無ければ FAQ 検索結果を表示）
        if (references.length){
          appendReferences(references);
        } else if (referenceSource.length){
          appendReferences(referenceSource);
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

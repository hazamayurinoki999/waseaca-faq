/*
 * グローバル設定を1か所で定義し、従来の window.CONFIG / window.FAQ_CONFIG の両方に適用する。
 * これによりマージ時に発生していた "CONFIG" と "FAQ_CONFIG" の重複定義/参照の不整合を解消する。
 */
(function(){
  var DEFAULT_APP_CONFIG = {
    CONTACT_ENDPOINT: "https://script.google.com/macros/s/AKfycbx5PFY-yguMbQ3IrGYneJ86894RQAPQoZUQNDBoaxaJcfzSfYwPO0N0KVwT-UlTFwQ/exec?action=contact",
    AI_PROXY_ENDPOINT: "https://script.google.com/macros/s/AKfycbx5PFY-yguMbQ3IrGYneJ86894RQAPQoZUQNDBoaxaJcfzSfYwPO0N0KVwT-UlTFwQ/exec?action=ai"
  };

  var appConfig = Object.assign({}, DEFAULT_APP_CONFIG, window.APP_CONFIG || {});
  window.APP_CONFIG = appConfig;

  function resolveBaseEndpoint(endpoint){
    if (!endpoint) return '';
    try {
      var parsed = new URL(endpoint, window.location.origin);
      parsed.search = '';
      parsed.hash = '';
      return parsed.toString();
    } catch (_) {
      var idx = String(endpoint).indexOf('?');
      return idx >= 0 ? String(endpoint).slice(0, idx) : String(endpoint);
    }
  }

  var baseEndpoint = resolveBaseEndpoint(appConfig.CONTACT_ENDPOINT);

  var base = {
    SHEET_ID: "1tDXdwHcKAI_785C1tplQsqUUuiwDvxHVA7uuLyK0iGc",
    SHEET_NAME: "FAQ",
    REQUIRED_HEADERS: ["カテゴリ","質問","回答","公開フラグ"],
    HP_LINK: "https://waseaca-singapore.com/",
    HOME_URL: "https://waseaca-singapore.com/",
    AI_ENDPOINT: appConfig.AI_PROXY_ENDPOINT || "/api/chat",
    APPS_SCRIPT_ENDPOINT: baseEndpoint
  };

  // 既存設定があればマージする（後勝ち）。
  window.CONFIG = Object.assign({}, base, window.CONFIG || {});

  if (!window.CONFIG.APPS_SCRIPT_ENDPOINT) {
    window.CONFIG.APPS_SCRIPT_ENDPOINT = baseEndpoint;
  }
  if (!window.CONFIG.AI_ENDPOINT) {
    window.CONFIG.AI_ENDPOINT = appConfig.AI_PROXY_ENDPOINT || "/api/chat";
  }

  // FAQ画面用の互換エイリアスを生成。必要項目のみ抜き出しておく。
  window.FAQ_CONFIG = Object.assign({
    SHEET_ID: window.CONFIG.SHEET_ID,
    SHEET_NAME: window.CONFIG.SHEET_NAME,
    REQUIRED_HEADERS: window.CONFIG.REQUIRED_HEADERS,
    HOME_URL: window.CONFIG.HOME_URL || window.CONFIG.HP_LINK,
    AI_ENDPOINT: window.CONFIG.AI_ENDPOINT,
  }, window.FAQ_CONFIG || {});
})();

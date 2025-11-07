/*
 * 設定を一元化し、 window.CONFIG / window.APP_CONFIG / window.FAQ_CONFIG を同じ情報源から生成する。
 * 以前は複数の設定オブジェクトが別々に存在し、マージ時にコンフリクトが発生しやすかったため統合した。
 */
(function(){
  function appendAction(endpoint, action){
    if (!endpoint) return '';
    var value = String(endpoint).trim();
    if (!value) return '';
    try {
      var url = new URL(value, window.location.href);
      url.hash = '';
      url.searchParams.set('action', action);
      return url.toString();
    } catch (_err) {
      var idx = value.indexOf('?');
      var base = idx >= 0 ? value.slice(0, idx) : value;
      return base + '?action=' + action;
    }
  }

  var defaults = {
    SHEET_ID: "1tDXdwHcKAI_785C1tplQsqUUuiwDvxHVA7uuLyK0iGc",
    SHEET_NAME: "FAQ",
    REQUIRED_HEADERS: ["カテゴリ","質問","回答","公開フラグ"],
    HP_LINK: "https://waseaca-singapore.com/",
    HOME_URL: "https://waseaca-singapore.com/",
    AI_ENDPOINT: "/api/chat",
    APPS_SCRIPT_ENDPOINT: "https://script.google.com/macros/s/AKfycbyUZY5vcrm8lQatRzyUBqHNZTZtpWZtbf6kHUKxI9X4grHns2LZp5x33xMyA2FzYFU/exec"
  };

  var legacy = window.CONFIG || window.APP_CONFIG || {};
  var config = Object.assign({}, defaults, legacy);

  if (!config.AI_ENDPOINT && config.AI_PROXY_ENDPOINT) {
    config.AI_ENDPOINT = config.AI_PROXY_ENDPOINT;
  }

  if (!config.CONTACT_ENDPOINT && config.APPS_SCRIPT_ENDPOINT) {
    config.CONTACT_ENDPOINT = appendAction(config.APPS_SCRIPT_ENDPOINT, 'contact');
  }

  if (!config.AI_PROXY_ENDPOINT && config.APPS_SCRIPT_ENDPOINT) {
    config.AI_PROXY_ENDPOINT = appendAction(config.APPS_SCRIPT_ENDPOINT, 'ai');
  }

  window.CONFIG = config;
  window.APP_CONFIG = config;

  window.FAQ_CONFIG = Object.assign({
    SHEET_ID: config.SHEET_ID,
    SHEET_NAME: config.SHEET_NAME,
    REQUIRED_HEADERS: config.REQUIRED_HEADERS,
    HOME_URL: config.HOME_URL || config.HP_LINK,
    AI_ENDPOINT: config.AI_ENDPOINT,
  }, window.FAQ_CONFIG || {});
})();

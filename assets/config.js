// 共通設定（全ページで最初に読み込む）
(function(){
  var defaults = {
    SHEET_ID: "1tDXdwHcKAI_785C1tplQsqUUuiwDvxHVA7uuLyK0iGc",
    SHEET_NAME: "FAQ",
    HOME_URL: "https://waseaca-singapore.com/",
    AI_ENDPOINT: "/api/chat",
    BASE_PATH: "",
    FAQ_JSON_URL: "",
    PAGE_MAP: null
  };
  var existing = (window.FAQ_CONFIG && typeof window.FAQ_CONFIG === 'object') ? window.FAQ_CONFIG : {};
  window.FAQ_CONFIG = Object.assign({}, defaults, existing);
})();

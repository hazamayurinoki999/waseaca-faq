/*
 * グローバル設定を1か所で定義し、従来の window.CONFIG / window.FAQ_CONFIG の両方に適用する。
 * これによりマージ時に発生していた "CONFIG" と "FAQ_CONFIG" の重複定義/参照の不整合を解消する。
 */
(function(){
  var base = {
    SHEET_ID: "1tDXdwHcKAI_785C1tplQsqUUuiwDvxHVA7uuLyK0iGc",
    SHEET_NAME: "FAQ",
    REQUIRED_HEADERS: ["カテゴリ","質問","回答","公開フラグ"],
    HP_LINK: "https://waseaca-singapore.com/",
    HOME_URL: "https://waseaca-singapore.com/",
    AI_ENDPOINT: "/api/chat",
    APPS_SCRIPT_ENDPOINT: "https://script.google.com/macros/s/AKfycbx5PFY-yguMbQ3IrGYneJ86894RQAPQoZUQNDBoaxaJcfzSfYwPO0N0KVwT-UlTFwQ/exec",
  };

  // 既存設定があればマージする（後勝ち）。
  window.CONFIG = Object.assign({}, base, window.CONFIG || {});

  // FAQ画面用の互換エイリアスを生成。必要項目のみ抜き出しておく。
  window.FAQ_CONFIG = Object.assign({
    SHEET_ID: window.CONFIG.SHEET_ID,
    SHEET_NAME: window.CONFIG.SHEET_NAME,
    REQUIRED_HEADERS: window.CONFIG.REQUIRED_HEADERS,
    HOME_URL: window.CONFIG.HOME_URL || window.CONFIG.HP_LINK,
    AI_ENDPOINT: window.CONFIG.AI_ENDPOINT,
  }, window.FAQ_CONFIG || {});
})();

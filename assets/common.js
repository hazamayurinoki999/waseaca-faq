/* Common helpers + Google Sheets loader + home link init */
(function () {
  function $(s) { return document.querySelector(s); }
  function escapeHtml(s) {
    s = String(s == null ? '' : s);
    return s.replace(/[&<>"']/g, function (m) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]; });
  }
  function isPublic(v) { return (v === true) || (String(v || '').trim().toUpperCase() === 'TRUE'); }
  function hueByName(name) { var s = String(name || ''), h = 0; for (var i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) >>> 0; } return (h % 360); }

  function loadFAQ(cfg) {
    var SHEET_ID = cfg.SHEET_ID;
    var SHEET_NAME = cfg.SHEET_NAME || 'FAQ';
    var API_URL = 'https://docs.google.com/spreadsheets/d/' + SHEET_ID + '/gviz/tq?tqx=out:json&headers=1&sheet=' + encodeURIComponent(SHEET_NAME);
    return fetch(API_URL, { cache: 'no-store' })
      .then(function (res) { return res.text(); })
      .then(function (text) {
        if (text.indexOf('/*O_o*/') !== 0) throw new Error('シート公開設定またはID/タブ名を確認してください。');
        var json; try { json = JSON.parse(text.substring(47, text.length - 2)); } catch (e) { throw new Error('シート応答の解析に失敗しました。'); }
        var header = (json.table.cols || []).map(function (c) { return (c && c.label) ? String(c.label).trim() : ''; });
        var rows = (json.table.rows || []).map(function (r) { return (r.c || []).map(function (c) { return c ? c.v : ''; }); });
        var invalid = header.every(function (h) { return !h || /^[A-Z]$/.test(h); });
        if (invalid && rows.length) header = rows.shift().map(function (v) { return String(v == null ? '' : v).trim(); });
        var map = {}; header.forEach(function (n, i) { var k = String(n || '').trim(); if (k) map[k] = i; });
        ['カテゴリ', '質問', '回答', '公開フラグ'].forEach(function (k) { if (!(k in map)) throw new Error('見出し不足: ' + k); });
        return rows.map(function (r) {
          return { category: r[map['カテゴリ']] || '', question: r[map['質問']] || '', answer: r[map['回答']] || '', public: r[map['公開フラグ']] };
        }).filter(function (it) { return isPublic(it.public); });
      });
  }

  function initHomeLinks() {
    var url = (window.FAQ_CONFIG && FAQ_CONFIG.HOME_URL) || '/';
    document.querySelectorAll('[data-home]').forEach(function (a) { a.href = url; });
    var sub = document.querySelector('.brand .subtle'); if (sub) sub.classList.add('site-note');
  }
  document.addEventListener('DOMContentLoaded', initHomeLinks);

  window.FAQ = { $, escapeHtml, isPublic, hueByName, loadFAQ };
})();

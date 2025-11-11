/* Common helpers + Google Sheets loader + home link init */
(function () {
  function $(s) { return document.querySelector(s); }
  function escapeHtml(s) {
    s = String(s == null ? '' : s);
    return s.replace(/[&<>"']/g, function (m) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]; });
  }
  function isPublic(v) {
    if (v === true) return true;
    if (v === false || v == null) return false;

    if (typeof v === 'number') {
      if (Number.isNaN(v)) return false;
      return v > 0;
    }

    var raw = String(v || '').trim();
    if (!raw) return false;

    var normalized = raw.toLowerCase();
    var normalizedNoSpace = normalized.replace(/\s+/g, '');
    var upper = raw.toUpperCase();

    var truthy = ['TRUE', 'T', 'YES', 'Y', 'ON', '1'];
    if (truthy.indexOf(upper) !== -1) return true;

    var truthyJp = ['公開', '公開する', '公開済', '公開済み', '表示', 'はい'];
    if (truthyJp.indexOf(normalizedNoSpace) !== -1) return true;

    var falsy = ['FALSE', 'F', 'NO', 'N', 'OFF', '0'];
    if (falsy.indexOf(upper) !== -1) return false;

    var falsyJp = ['非公開', '未公開', '非表示', 'いいえ'];
    if (falsyJp.indexOf(normalizedNoSpace) !== -1) return false;

    return false;
  }
  function hueByName(name) { var s = String(name || ''), h = 0; for (var i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) >>> 0; } return (h % 360); }

  function normalizeFaqRecords(records) {
    if (!Array.isArray(records)) return [];
    return records.map(function (row) {
      if (!row) return null;
      if (Array.isArray(row)) {
        return {
          category: row[0] || '',
          question: row[1] || '',
          answer: row[2] || '',
          public: row.length > 3 ? row[3] : true
        };
      }
      var cat = row.category;
      if (cat == null) cat = row['カテゴリ'];
      var question = row.question;
      if (question == null) question = row['質問'];
      var answer = row.answer;
      if (answer == null) answer = row['回答'];
      var pub;
      if ('public' in row) pub = row.public;
      else if ('公開フラグ' in row) pub = row['公開フラグ'];
      else pub = true;
      return {
        category: cat || '',
        question: question || '',
        answer: answer || '',
        public: pub
      };
    }).filter(function (row) { return row && isPublic(row.public); });
  }

  function toErrorMessage(err) {
    if (!err) return '';
    if (typeof err === 'string') return err;
    if (err && typeof err.message === 'string') return err.message;
    try { return JSON.stringify(err); } catch (_) { return String(err); }
  }

  function loadFAQFromSheet(cfg) {
    var SHEET_ID = String(cfg.SHEET_ID || '').trim();
    var SHEET_NAME = cfg.SHEET_NAME || 'FAQ';
    if (!SHEET_ID) return Promise.reject(new Error('SHEET_IDが設定されていません。'));
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

  function loadFAQFromApi(cfg) {
    var base = (cfg && (cfg.FAQ_ENDPOINT || cfg.APPS_SCRIPT_ENDPOINT)) || '';
    base = String(base || '').trim();
    if (!base) return Promise.reject(new Error('FAQエンドポイントが設定されていません。'));
    var url = base;
    if (url.indexOf('?') === -1) url += '?action=faq';
    else if (!/[?&]action=/.test(url)) url += '&action=faq';
    return fetch(url, { cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) throw new Error('FAQエンドポイントの取得に失敗しました（' + res.status + '）');
        return res.json();
      })
      .then(function (json) {
        if (json && json.ok === false) throw new Error(json.message || 'FAQエンドポイントがエラーを返しました。');
        var records = null;
        if (Array.isArray(json)) records = json;
        else if (Array.isArray(json.items)) records = json.items;
        else if (Array.isArray(json.faq)) records = json.faq;
        else if (Array.isArray(json.records)) records = json.records;
        else if (Array.isArray(json.data)) records = json.data;
        if (records == null) throw new Error('FAQデータが空、または認識できませんでした。');
        return normalizeFaqRecords(records);
      });
  }

  function loadFAQ(cfg) {
    cfg = cfg || {};
    var hasSheet = !!(cfg.SHEET_ID && String(cfg.SHEET_ID).trim());
    var hasApi = !!((cfg.FAQ_ENDPOINT && String(cfg.FAQ_ENDPOINT).trim()) || (cfg.APPS_SCRIPT_ENDPOINT && String(cfg.APPS_SCRIPT_ENDPOINT).trim()));

    if (hasSheet) {
      return loadFAQFromSheet(cfg).catch(function (sheetError) {
        if (!hasApi) throw sheetError;
        return loadFAQFromApi(cfg).catch(function (apiError) {
          var message = toErrorMessage(sheetError);
          var apiMessage = toErrorMessage(apiError);
          throw new Error(message + ' / ' + apiMessage);
        });
      });
    }

    if (hasApi) {
      return loadFAQFromApi(cfg);
    }

    return Promise.reject(new Error('FAQデータの取得先が設定されていません。'));
  }

  function initHomeLinks() {
    var url = (window.FAQ_CONFIG && window.FAQ_CONFIG.HOME_URL)
      || (window.CONFIG && (window.CONFIG.HOME_URL || window.CONFIG.HP_LINK))
      || '/';
    document.querySelectorAll('[data-home]').forEach(function (a) { a.href = url; });
    var sub = document.querySelector('.brand .subtle'); if (sub) sub.classList.add('site-note');
  }
  document.addEventListener('DOMContentLoaded', initHomeLinks);

  window.FAQ = { $, escapeHtml, isPublic, hueByName, loadFAQ };
})();

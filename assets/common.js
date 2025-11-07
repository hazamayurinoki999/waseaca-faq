/* Common helpers + Google Sheets loader + home link init */
(function () {
  function $(s) { return document.querySelector(s); }
  function escapeHtml(s) {
    s = String(s == null ? '' : s);
    return s.replace(/[&<>"']/g, function (m) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]; });
  }
  function isPublic(v) { return (v === true) || (String(v || '').trim().toUpperCase() === 'TRUE'); }
  function hueByName(name) { var s = String(name || ''), h = 0; for (var i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) >>> 0; } return (h % 360); }

  function fromJsonEntry(entry) {
    if (!entry || typeof entry !== 'object') return { category: '', question: '', answer: '', public: false };
    function pick(obj, keys) {
      for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        if (key in obj && obj[key] != null) return obj[key];
      }
      return undefined;
    }
    var category = pick(entry, ['category', 'カテゴリ', 'Category']) || '';
    var question = pick(entry, ['question', '質問', 'Question']) || '';
    var answer = pick(entry, ['answer', '回答', 'Answer']) || '';
    var visibility = pick(entry, ['public', '公開フラグ', 'published']);
    var url = pick(entry, ['url', 'URL', 'link']);
    return {
      category: category,
      question: question,
      answer: answer,
      public: visibility == null ? true : visibility,
      url: url || ''
    };
  }

  function loadFAQ(cfg) {
    cfg = cfg || window.FAQ_CONFIG || {};
    var directUrl = cfg.FAQ_JSON_URL || cfg.SHEET_JSON_URL || cfg.JSON_URL;
    if (directUrl) {
      var resolved = resolvePath(directUrl);
      return fetch(resolved, { cache: 'no-store' })
        .then(function (res) {
          if (!res.ok) throw new Error('FAQ_JSON_URL の取得に失敗しました (HTTP ' + res.status + ')');
          return res.json();
        })
        .then(function (json) {
          var list;
          if (Array.isArray(json)) list = json;
          else if (json && Array.isArray(json.items)) list = json.items;
          else if (json && Array.isArray(json.data)) list = json.data;
          else throw new Error('FAQ_JSON_URL の形式が不正です。配列、または items/data 配下の配列を返してください。');
          return list.map(fromJsonEntry).filter(function (it) { return isPublic(it.public); });
        });
    }

    if (!cfg.SHEET_ID) {
      return Promise.reject(new Error('SHEET_ID が設定されていません。assets/config.js を確認してください。'));
    }
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

  function resolvePath(target) {
    var cfg = window.FAQ_CONFIG || {};
    if (target == null && target !== '') return target;
    var original = target;
    var str = String(target == null ? '' : target).trim();
    var map = cfg.PAGE_MAP || cfg.PATH_MAP;
    if (map) {
      if (Object.prototype.hasOwnProperty.call(map, original)) {
        str = map[original] == null ? '' : String(map[original]);
      } else if (Object.prototype.hasOwnProperty.call(map, str)) {
        str = map[str] == null ? '' : String(map[str]);
      }
    }
    if (!str) {
      var baseOnly = cfg.BASE_PATH || '';
      if (!baseOnly) return '';
      if (/^https?:\/\//i.test(baseOnly)) return baseOnly;
      return baseOnly || '/';
    }
    if (/^(https?:)?\/\//i.test(str) || /^mailto:/i.test(str) || /^tel:/i.test(str) || str.charAt(0) === '#') return str;
    var base = cfg.BASE_PATH || '';
    if (!base) return str;
    if (/^https?:\/\//i.test(base)) {
      try {
        var normalizedBase = base.replace(/\/?$/, '/');
        return new URL(str, normalizedBase).toString();
      } catch (err) {
        console.warn('BASE_PATH の解析に失敗しました。相対パス結合にフォールバックします。', err);
      }
    }
    var trimmedBase = base.replace(/\/$/, '');
    if (!trimmedBase) return str.charAt(0) === '/' ? str : '/' + str;
    if (str.charAt(0) === '/') return trimmedBase + str;
    return trimmedBase + '/' + str;
  }

  function initHomeLinks() {
    var url = resolvePath((window.FAQ_CONFIG && FAQ_CONFIG.HOME_URL) || '/');
    document.querySelectorAll('[data-home]').forEach(function (a) { a.href = url; });
    document.querySelectorAll('[data-nav]').forEach(function (a) {
      var dest = a.getAttribute('data-nav');
      if (!dest) return;
      var resolved = resolvePath(dest);
      if (resolved) a.href = resolved;
    });
    var sub = document.querySelector('.brand .subtle'); if (sub) sub.classList.add('site-note');
  }
  document.addEventListener('DOMContentLoaded', initHomeLinks);

  window.FAQ = { $, escapeHtml, isPublic, hueByName, loadFAQ, resolvePath };
})();

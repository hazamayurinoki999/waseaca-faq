# Waseda Academy Singapore FAQ Center

静的なFAQポータルにAI検索（Gemini APIを想定）を組み込むためのプロジェクトです。`index.html` / `search.html` / `faq.html` に加え、`ai.html` からサーバレス/常駐APIを呼び出して回答を取得します。

## 今回実装した主な内容（ざっくり）

1. **AI用バックエンドサーバーを追加**  
   `server/index.js` が FAQデータを読み込み、Gemini API（設定時）またはローカルFAQから回答を作ります。
2. **AIチャット画面をAPI連携に変更**  
   `ai.html` と `assets/ai.js` が `/api/chat` へ問い合わせ、回答と参照リンクを表示します。
3. **FAQデータの置き場所を整備**  
   `server/data/faq.json` にカテゴリ・質問・回答・URLを登録しておくと、AI回答と検索で再利用されます。
4. **環境変数サンプルや利用手順を整備**  
   `.env.example` とこのREADMEで、無料枠のGeminiキーを使った動かし方をまとめました。

「何が入っているのか」をまず把握したいときは、上の4点だけ覚えておけば大丈夫です。

## ディレクトリ構成

```
.
├── ai.html                # AIチャット画面（フロントエンド）
├── assets/                # 共通スタイル・JS
│   ├── ai.js              # AIチャット用クライアント（API呼び出し）
│   ├── app.css            # UI スタイル
│   └── ...
├── server/
│   ├── index.js           # ExpressベースのAIバックエンド
│   └── data/faq.json      # FAQナレッジ（RAG向けベース）
├── .env.example           # 環境変数のサンプル
└── README.md
```

## セットアップ（初めて動かすとき）

1. 依存パッケージのインストール
   ```bash
   npm install
   ```
2. 環境変数ファイルの作成（必要に応じて）
   ```bash
   cp .env.example .env
   # GOOGLE_API_KEY に Gemini API キーを設定
   # PORT は任意（デフォルト 8788）
   ```
3. 開発サーバーの起動
   ```bash
   npm run dev
   ```
   - `http://localhost:8788/health` でバックエンドの起動を確認できます。
   - フロントエンドは `ai.html` をブラウザで開き、APIは `/api/chat` を経由して呼び出されます。

## 設定値（`assets/config.js`）

`assets/config.js` は全ページで共有する設定値をまとめています。既定値はそのまま残しつつ、事前に `window.FAQ_CONFIG` を定義しておけば値を上書きできます（Apps Script などサーバー側テンプレートからの差し込みにも対応）。

| キー | 役割 |
| ---- | ---- |
| `SHEET_ID` | Google スプレッドシートのID。公開設定済みのシートを指定してください。 |
| `SHEET_NAME` | 読み込むタブ名（既定値は `FAQ`）。 |
| `HOME_URL` | 「ホームへ」ボタンがリンクするURL。 |
| `AI_ENDPOINT` | AIチャットが問い合わせるAPIエンドポイント。Apps Script や Cloud Functions を使う場合はここにURLを設定します。 |
| `BASE_PATH` | ページ遷移時に付与するパスのプレフィックス。`/faq/` や `https://example.com/faq` のように設定すると、サブディレクトリ配信やApps Scriptホストでも画面遷移が壊れにくくなります。 |
| `FAQ_JSON_URL` | Googleシートではなく任意のJSON/APIからFAQを取得したい場合に指定します。相対パスでもOKです（例：`/api/faq`）。 |
| `PAGE_MAP` | 画面遷移先を個別に上書きするためのマップ。`{ "faq.html": "?page=faq" }` のように設定すると、Apps Scriptのクエリ形式などにも対応できます。 |

`BASE_PATH` は `index.html` のカード遷移や各ページのナビゲーションリンクにも自動的に反映されます。相対パスで運用している場合（例: Apps Scriptの `/exec` URL）に設定すると、ページ遷移の不具合を防げます。

`FAQ_JSON_URL` を指定すると、Googleスプレッドシートではなく任意のAPI/JSONレスポンスからFAQを読み込みます。レスポンスは `[ { "category": "...", "question": "...", "answer": "...", "public": true } ]` といった配列、もしくは `items`/`data` 配列を含むオブジェクトであれば利用できます。

`PAGE_MAP` は `data-nav` やトップページのカードに設定されているファイル名をキーに、任意の遷移先へ差し替える仕組みです。Google Apps Script のように単一の `/exec` URL へ `?page=faq` を付けて切り替える場合は以下のように設定します。

```html
<script>
  window.FAQ_CONFIG = {
    BASE_PATH: 'https://script.google.com/macros/s/XXXXX/exec',
    PAGE_MAP: {
      'index.html': '',
      'faq.html': '?page=faq',
      'search.html': '?page=search',
      'ai.html': '?page=ai'
    }
  };
</script>
```

## 仕組みの全体像

```
ブラウザ（ai.html）
   │ 1. 質問を入力
   ▼
Nodeサーバー（server/index.js）
   │ 2. FAQ JSONから候補検索
   │ 3. Gemini API（任意）へ送信
   │ 4. 回答 + 参照を整形
   ▼
ブラウザに返却（/api/chat）
   │ 5. 画面に回答を表示／リンクを案内
```

ポイントとなるファイルと役割は以下のとおりです。

- **server/index.js**: Expressサーバー。FAQ読み込み、Gemini呼び出し、フォールバック文生成、リマインダー付与を担当。
- **server/data/faq.json**: QAのデータベース。カテゴリ／質問／回答／URLの4項目を保持。
- **assets/ai.js**: 画面からAPIを叩き、チャットUIにメッセージと引用リンクを描画。
- **ai.html**: 注意書きやチャットエリアを含むUI。本READMEで案内した仕組みをそのまま使います。

## AIバックエンドの概要

- `server/data/faq.json` を読み込み、キーワード一致で上位候補を返す簡易検索を実装しています。
- `GOOGLE_API_KEY` が設定されている場合、Gemini 1.5 Flash を呼び出して回答を生成します。無料枠での動作を想定しています。
- APIキーが未設定でも、FAQデータのヒットを基にしたフォールバック回答が返るため、動作確認が可能です。
- すべての応答で「個人情報を入力しない」旨をリマインドします。

### APIエンドポイント

- `POST /api/chat`
  - 入力: `{ "message": "ユーザーからの質問", "history": [{"role":"user|assistant","content":"..."}] }`
  - 出力: `{ "answer": "...", "references": [ { "question": "...", "answer": "...", "url": "..." } ], "usedModel": true|false }`
- `POST /api/search`
  - 入力: `{ "query": "キーワード" }`
  - 出力: `{ "matches": [...] }`
- `GET /health`
  - バックエンドの状態確認用

## FAQデータを増やすとき

1. `server/data/faq.json` に、カテゴリ/質問/回答/URL を持つオブジェクト配列としてFAQを追記してください。
2. ファイル保存後は自動で再読み込みされます（ローカル開発環境では `fs.watch` により反映）。
3. 将来的にGoogleスプレッドシート等から自動取得する場合は、同じスキーマのJSONを生成して差し替えます。

## 安全に使うための注意点

- 個人情報を含む問い合わせ内容は送信しないでください。バックエンドでも記録・表示を行わない設計にしてください。
- 無料枠のトークン消費量は Google AI Studio / Vertex AI ダッシュボードで定期的に確認し、上限を超える前に通知設定を行うことを推奨します。
- 公開環境ではAPIキーをフロントエンドへ直接埋め込まず、今回のようなバックエンド経由でリクエストしてください。

## 今後の拡張候補

- Googleスプレッドシートや問い合わせログからのETLスクリプト自動化
- ベクトルデータベース（FAISS / Chroma 等）を使ったRAG精度向上
- Cloudflare Workers / Vercel などサーバレス環境へのデプロイ
- 回答ログのモニタリング、評価フローの整備


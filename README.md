# Waseda Academy Singapore FAQ Center

静的なFAQポータルにAI検索（Gemini APIを想定）を組み込むためのプロジェクトです。`index.html` / `search.html` / `faq.html` に加え、`ai.html` からサーバレス/常駐APIを呼び出して回答を取得します。

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

## セットアップ

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

## AIバックエンドの概要

- `server/data/faq.json` を読み込み、キーワード一致で上位候補を返す簡易検索を実装しています。
- `GOOGLE_API_KEY` が設定されている場合、Gemini 1.5 Flash を呼び出して回答を生成します。無料枠での動作を想定しています。
- APIキーが未設定でも、FAQデータのヒットを基にしたフォールバック回答が返るため、動作確認が可能です。
- すべての応答で「個人情報を入力しない」旨をリマインドします。

### エンドポイント

- `POST /api/chat`
  - 入力: `{ "message": "ユーザーからの質問", "history": [{"role":"user|assistant","content":"..."}] }`
  - 出力: `{ "answer": "...", "references": [ { "question": "...", "answer": "...", "url": "..." } ], "usedModel": true|false }`
- `POST /api/search`
  - 入力: `{ "query": "キーワード" }`
  - 出力: `{ "matches": [...] }`
- `GET /health`
  - バックエンドの状態確認用

## FAQデータの更新

1. `server/data/faq.json` に、カテゴリ/質問/回答/URL を持つオブジェクト配列としてFAQを追記してください。
2. ファイル保存後は自動で再読み込みされます（ローカル開発環境では `fs.watch` により反映）。
3. 将来的にGoogleスプレッドシート等から自動取得する場合は、同じスキーマのJSONを生成して差し替えます。

## 運用上の注意

- 個人情報を含む問い合わせ内容は送信しないでください。バックエンドでも記録・表示を行わない設計にしてください。
- 無料枠のトークン消費量は Google AI Studio / Vertex AI ダッシュボードで定期的に確認し、上限を超える前に通知設定を行うことを推奨します。
- 公開環境ではAPIキーをフロントエンドへ直接埋め込まず、今回のようなバックエンド経由でリクエストしてください。

## 今後の拡張候補

- Googleスプレッドシートや問い合わせログからのETLスクリプト自動化
- ベクトルデータベース（FAISS / Chroma 等）を使ったRAG精度向上
- Cloudflare Workers / Vercel などサーバレス環境へのデプロイ
- 回答ログのモニタリング、評価フローの整備


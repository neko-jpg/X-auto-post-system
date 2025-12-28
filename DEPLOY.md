# X-AUTO-POST-SYSTEM デプロイガイド

お父様向けイベント写真自動投稿システムのデプロイ手順です。

## 1. 事前準備

### 必要なもの
- [Netlify アカウント](https://netlify.com) (無料)
- [Gemini API Key](https://ai.google.dev/) (無料枠あり)
- GitHub アカウント (推奨)

## 2. ローカルセットアップ

```bash
# プロジェクトディレクトリに移動
cd X-AUTO-POST-SYSTEM-otakuDJ

# 依存関係をインストール
npm install
```

## 3. Netlify にデプロイ

### 方法A: GitHub連携（推奨）

1. GitHubにリポジトリをプッシュ
2. Netlify にログイン → 「New site from Git」
3. リポジトリを選択
4. ビルド設定（自動検出されるはず）:
   - Build command: (空欄でOK)
   - Publish directory: `app`
   - Functions directory: `netlify/functions`
5. 「Deploy site」をクリック

### 方法B: Netlify CLI

```bash
# Netlify CLI をインストール
npm install -g netlify-cli

# ログイン
netlify login

# 初期化
netlify init

# デプロイ
netlify deploy --prod
```

## 4. 環境変数の設定

Netlify 管理画面 → Site settings → Environment variables

| 変数名 | 値 |
|--------|-----|
| `GEMINI_API_KEY` | あなたのAPIキー |

## 5. 動作確認

1. デプロイ完了後のURLにアクセス
2. 「テキスト貼り付け」タブでイベント情報を入力
3. 写真をドラッグ＆ドロップ
4. 「コメント生成」ボタンをクリック

## 6. お父様への共有

デプロイ完了後のURL（例: `https://x-auto-post.netlify.app`）を共有するだけ！

Make.com Webhook URLは設定モーダルで入力してもらうか、あらかじめ設定しておく。

---

## トラブルシューティング

### API呼び出しがエラーになる
- 環境変数 `GEMINI_API_KEY` が正しく設定されているか確認
- Functions のログを Netlify 管理画面で確認

### 画像が大きすぎる
- 自動圧縮されるはずですが、6MB以上の場合はエラーになる可能性あり
- 事前に画像サイズを小さくしてください

### ルールベースコメントになる
- API接続エラー時は自動的にルールベースにフォールバック
- Netlify Functions のログを確認

# Our Diary

家族内で子どもの写真や記録を共有するReact + Viteアプリです。Vercel FunctionsでGoogle IDトークンを検証し、Neon Postgresに保存した家族所属とロールから権限を決定します。

## 権限

- `member`（メンバー）: 投稿者が共有した内容の閲覧
- `parent`（両親）: 全投稿の閲覧、投稿、編集、削除
- `admin`（管理者）: 両親の全権限、子どもとメンバーの管理

実際の権限は [api/_lib/permissions.js](api/_lib/permissions.js) で管理します。将来コメント機能を追加するときは、`member` に `comment:create` を加えられます。

## セットアップ

```bash
npm install
```

`.env.example` を参考に `.env.local` を作成します。`GOOGLE_CLIENT_ID` と `VITE_GOOGLE_CLIENT_ID` には同じGoogle OAuthクライアントIDを設定してください。

ローカル開発では `POSTGRES_HOST`、`POSTGRES_PORT`、`POSTGRES_DATABASE`、`POSTGRES_USER`、`POSTGRES_PASSWORD` を使用します。安全対策として、ローカル設定のホストがNeonの場合は接続を拒否します。

VercelのPreview／Productionだけが `DATABASE_URL` を使用します。この値はVercel Marketplaceで接続したNeonから注入し、ローカル設定には使用しません。

DBの初期構築は [database/README.md](database/README.md) の手順に従います。

## 開発と検証

ローカルPostgreSQLとAPIを含めて起動します。`.env.local` の `POSTGRES_*` だけを使用し、VercelやNeonのDevelopment環境変数は取得しません。

```bash
npm run dev
```

起動時にローカルDBへ接続できなければサーバーは開始しません。成功時は `Local database connected: ourdiary` と表示されます。

静的検証と本番ビルド:

```bash
npm run lint
npm run build
```

## 構成

- `src/`: Reactフロントエンド
- `api/auth-session.js`: Google認証とDB上の所属・ロール確認
- `api/_lib/`: サーバー専用の認証、DB、権限定義、API認可ヘルパー
- `database/`: Postgresスキーマ、初回管理者登録、セットアップ手順

画面上の表示・非表示は利便性のための制御にすぎません。今後追加する投稿・削除・管理APIでも、サーバー側で所属と権限を必ず再検証します。

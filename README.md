# Our Diary

家族内で子どもの写真や記録を共有するReact + Viteアプリです。Vercel FunctionsでGoogleログインを検証し、Postgresに保存した家族所属とロールから権限を決定します。

## 権限

- `member`: 共有された内容の閲覧
- `parent`: 閲覧、投稿、編集、削除
- `admin`: 両親の全権限、子ども・メンバー・Google Driveアルバムの管理

実際の権限は `api/_lib/permissions.js` で管理します。画面表示だけに依存せず、各APIでも所属と権限を再検証します。

## セットアップ

```bash
npm install
```

`.env.example`を参考に`.env.local`を作成します。ローカルDBには`POSTGRES_*`だけを使用し、Neonホストへの接続は拒否します。Vercel Preview / ProductionだけがNeonの`DATABASE_URL`を使用します。

DBは`database/README.md`の順にSQLを実行してください。

## Google Driveアルバム

Google Drive APIを利用して、指定したオーナーのGoogle DriveにOur Diary専用フォルダを作成します。

1. Google CloudでGoogle Drive APIを有効にします。
2. OAuth同意画面に`https://www.googleapis.com/auth/drive.file`スコープを追加します。
3. OAuthクライアントの承認済みリダイレクトURIに、ローカルと本番のコールバックURLを登録します。
   - `http://localhost:3000/api/google-drive-callback`
   - `https://<本番ドメイン>/api/google-drive-callback`
4. 承認済みJavaScript生成元にローカルと本番のオリジンを登録します。
5. `.env.local`とVercel Environment Variablesに環境別の値を設定します。
6. Google Cloudの同じプロジェクトで、写真閲覧専用のサービスアカウントとJSON鍵を作成します。
   - サービスアカウントにプロジェクトロールを付ける必要はありません。
   - JSON鍵の`client_email`を`GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL`へ設定します。
   - JSON鍵の`private_key`を`GOOGLE_DRIVE_SERVICE_ACCOUNT_PRIVATE_KEY`へ設定します。

```dotenv
GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret
GOOGLE_DRIVE_REDIRECT_URI=http://localhost:3000/api/google-drive-callback
GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY=32-byte-base64-value
GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL=our-diary-reader@your-project.iam.gserviceaccount.com
GOOGLE_DRIVE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
APP_BASE_URL=http://localhost:3000
```

暗号化キーは一度だけ生成し、環境ごとに別の値を設定します。

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

管理者は「Google Driveアルバム設定」でオーナーのメールアドレスとフォルダ名を入力し、24時間有効な招待URLを発行します。メール・LINE送信機能は持たず、URLだけを表示します。

オーナーが招待URLから承認すると、そのアカウント内にフォルダを作成します。写真閲覧用サービスアカウントには閲覧権限、両親と管理者には編集権限を設定します。利用者のリフレッシュトークンはAES-256-GCMで暗号化してDBに保存します。既存アルバムへサービスアカウントを初めて接続する場合は、環境変数を設定した後、アルバム所有者が画面の案内から一度だけGoogle Driveへ再接続します。

写真本体の経路は次のとおりです。

- アップロード: ブラウザ → Google Drive
- 閲覧: Google Drive → ブラウザ
- Vercel Function: フォルダ作成、共有設定、DriveファイルIDなどの小さなメタデータだけ

アップロード完了時にファイルID・名前・サイズ等だけをPostgresへ登録し、アルバム一覧はそのメタデータから生成します。Vercel Functionは写真・動画のバイト列を中継しません。閲覧には、対象フォルダだけを共有されたサービスアカウントの短時間アクセストークンを使用します。memberを含む閲覧者個人のGoogle Drive接続は不要です。アップロード時だけparent/admin本人が`drive.file`スコープでGoogle Driveへ接続します。

## 開発と検証

```bash
npm run dev
npm run lint
npm run build
```

## 主な構成

- `src/`: Reactフロントエンド
- `api/index.js`: すべての公開APIを受ける単一のVercel Function
- `api/_router.js`: 公開APIパスとハンドラーのホワイトリスト
- `api/_handlers/`: Googleログイン、日記、アルバム、Google DriveなどのAPI処理
- `api/_lib/`: 認証、権限、DB、Google Driveなどの共通処理
- `src/services/albumApi.js`: ブラウザとGoogle Drive間の直接アップロード・取得
- `database/`: Postgresスキーマとセットアップ手順

`vercel.json`の内部Rewriteにより、`/api/auth-session`など既存の公開URLは変更せずに`api/index.js`へ集約します。APIを追加するときは`api/_handlers/`へ処理を追加し、`api/_router.js`の許可リストへ登録してください。`api/`直下へ新しい公開エントリーポイントを追加するとVercel Function数が増えるため使用しません。

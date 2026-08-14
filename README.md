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

```dotenv
GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret
GOOGLE_DRIVE_REDIRECT_URI=http://localhost:3000/api/google-drive-callback
GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY=32-byte-base64-value
APP_BASE_URL=http://localhost:3000
```

暗号化キーは一度だけ生成し、環境ごとに別の値を設定します。

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

管理者は「Google Driveアルバム設定」でオーナーのメールアドレスとフォルダ名を入力し、24時間有効な招待URLを発行します。メール・LINE送信機能は持たず、URLだけを表示します。

オーナーが招待URLから承認すると、そのアカウント内にフォルダを作成します。家族メンバーには閲覧権限、両親と管理者には編集権限を設定します。リフレッシュトークンはAES-256-GCMで暗号化してDBに保存します。

写真本体の経路は次のとおりです。

- アップロード: ブラウザ → Google Drive
- 閲覧: Google Drive → ブラウザ
- Vercel Function: フォルダ作成、共有設定、ファイル一覧などの小さなメタデータだけ

Vercel Functionは写真・動画のバイト列を中継しません。非公開ファイルを表示するため、各利用者はアルバム画面でOur Diaryが管理するDriveファイルへのアクセスを承認します。`drive.file`スコープだけを使い、利用者自身のDrive全体にはアクセスしません。閲覧・編集の違いはDrive側のreader/writer権限で制御します。

## 開発と検証

```bash
npm run dev
npm run lint
npm run build
```

## 主な構成

- `src/`: Reactフロントエンド
- `api/auth-session.js`: GoogleログインとDB上の所属・ロール確認
- `api/drive-owner-invitations.js`: 管理者専用の招待URL発行
- `api/google-drive-callback.js`: オーナーのOAuth承認とDriveフォルダ作成
- `api/album-files.js`: 認証済みユーザー向けの写真メタデータ一覧
- `src/services/albumApi.js`: ブラウザとGoogle Drive間の直接アップロード・取得
- `database/`: Postgresスキーマとセットアップ手順

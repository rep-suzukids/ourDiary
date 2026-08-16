# Database setup

このアプリでは、Vercel Marketplaceから接続したNeon Postgresを使用します。

1. Vercelのプロジェクトで `Storage` を開き、MarketplaceからNeonを追加します。
2. データベースをプロジェクトへ接続し、`DATABASE_URL` が追加されたことを確認します。
3. NeonのSQL Editorで `001_initial_schema.sql` を実行します。
4. `002_seed_admin.example.sql` の家族名と管理者メールアドレスを書き換えて、一度だけ実行します。
5. Google Driveアルバム機能を利用する場合は `004_google_drive_albums.sql` を実行します。
   - 既に `003_google_photos_albums.sql` を実行済みでも、ロールバックは不要です。
   - 新規環境では `003` を飛ばして `004` を実行できます。
6. Driveへ直接アップロードした写真のメタデータ管理用に `005_drive_album_files.sql` を実行します。
7. 固定の子ども2人と日記日付を追加する `006_fixed_children_and_diary_dates.sql` を実行します。
8. ミルク・搾乳記録を追加する `007_care_events.sql` を実行します。
9. Vercelの環境変数に `GOOGLE_CLIENT_ID` を追加します。値は `VITE_GOOGLE_CLIENT_ID` と同じです。
10. 再デプロイし、登録した管理者Googleアカウントでログインします。

`google_subject` は最初の正常なログイン時に、Googleが発行する変更されないユーザーIDへ自動的に紐づきます。以降はメールアドレスだけでは別アカウントへ置き換えられません。

## Roles

| Role | 表示名 | 現在の権限 |
| --- | --- | --- |
| `member` | メンバー | 共有された投稿の閲覧 |
| `parent` | 両親 | 全投稿の閲覧、投稿、編集、削除 |
| `admin` | 管理者 | 両親の全権限、子どもとメンバーの管理 |

コメント機能を追加するときは `member` に `comment:create` を追加します。ロール名やDBスキーマを変更する必要はありません。

## Entry visibility

- `parents_only`: 両親・管理者だけに公開
- `family_members`: 同じ家族の全メンバーに公開
- `selected_members`: `entry_viewers` に登録したメンバーだけに公開

画面に表示するだけの権限制御は安全ではありません。投稿APIを追加するときは `api/_lib/authorization.js` を利用して所属と操作権限を確認し、読取クエリでも公開範囲を確認してください。

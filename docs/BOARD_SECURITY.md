# 掲示板の管理・レート制限・バックアップ

## デプロイ前の必須設定

Cloudflare Workers の Secrets に次を設定する（GitHubへコミットしない）。

- `RECAPTCHA_SECRET_KEY`: 現行 reCAPTCHA v3 の秘密鍵
- `RATE_LIMIT_SALT`: 推測困難なランダム値（例: 32バイトをhex化した値）
- `BOARD_ADMIN_TOKEN`: 管理者用の長いランダムBearerトークン（例: 32バイトをhex化）

例: `npx wrangler secret put RATE_LIMIT_SALT` と `npx wrangler secret put BOARD_ADMIN_TOKEN`。
`wrangler.jsonc` の R2 バインディングに対応する非公開バケットを事前作成する。

```sh
npx wrangler r2 bucket create poslin-board-backups
npm ci
npm run build
npx wrangler deploy
```

**注意:** このPRのマージだけでは、SecretsやR2は作成されない。R2のバケットが存在しない状態ではデプロイが失敗する可能性がある。Cronは毎日18:00 UTC（03:00 JST）にWorkerの `scheduled` を起動する。Workers の Cron 設定が反映されていることを確認する。

## ブラウザ管理画面とCloudflare Access（必須）

管理画面は `https://poslin.org/admin/board/`。公開画面では「削除（非公開）」と「復元して再公開」を切り替える。投稿は物理削除しない。

Cloudflare Zero Trust → Access → Applications → Add an application → Self-hosted から、次の**2つのパス**に管理者本人のメールアドレスだけを許可するAccessポリシーを設定する。

- `poslin.org/admin/*`
- `poslin.org/api/admin/*`

できればメールOTPまたは既存の認証プロバイダーを使用する。**Allow Everyoneは使用しない。**
Accessアプリケーションの **AUD (Application Audience Tag)** を取得してWorkersの `ACCESS_AUD` に、チームドメイン `https://<team>.cloudflareaccess.com` を `ACCESS_TEAM_DOMAIN` に設定する。
アプリを2つに分けた場合は、API用AccessアプリのAUDを使う。WorkerはAPIリクエストのAccess JWTのRS256署名、aud、iss、有効期限を検証するため、Cloudflare Access未設定では管理APIを使用できない。管理画面にはトークンを入力する必要はない。

**本番デプロイ前にCloudflare Accessを設定すること。** 管理画面HTML自体は静的ファイルなので、AccessポリシーなしではURLを知っている人に表示される。ただしAPIの保護はWorker側でも必須検証され、投稿データ・操作は拒否される。

## 管理者API

ブラウザ管理画面はCloudflare Accessのログインで使う。以下のBearerトークンは定期バックアップ処理・手動復旧など保守用で、ブラウザには埋め込まない。通常の外部API呼び出しはCloudflare Access JWT検証が必須。バックアップ用の内部呼び出しではBearerを使用する。

```sh
export BASE=https://poslin.org
export BOARD_ADMIN_TOKEN='Cloudflareへ設定した値'
curl -H "Authorization: Bearer $BOARD_ADMIN_TOKEN" "$BASE/api/admin/board"
curl -H "Authorization: Bearer $BOARD_ADMIN_TOKEN" "$BASE/api/admin/backup" -o board-backup.json

# 投稿ID 123 を非表示化 / 再表示 / 完全削除
curl -X POST "$BASE/api/admin/board" \
  -H "Authorization: Bearer $BOARD_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"id":123,"action":"hide"}'
```

`action` は `hide`, `show`, `delete`。`delete` は論理削除（非公開化）の別名であり物理削除しない。`show` で元に戻せる。管理APIの一覧には非表示投稿も含まれる。公開の `/api/board` は非表示を除外し最新50件だけを返すが、保存した投稿は50件を超えても自動削除しない。

## 投稿者の接続情報

受け付けた掲示板投稿には `CF-Connecting-IP` のIPアドレス、CloudflareがIPアドレスから推定した国・地域・市区町村・ASN・ASNの登録組織名・Ray ID、User-Agent、Sec-CH-UA、Accept-Language、画面サイズ・表示領域・表示倍率・タイムゾーンを保存する。接続情報は管理画面と管理用バックアップにだけ含め、公開APIには返さない。過去の投稿は接続情報が空欄となる。非公開化しても投稿と接続情報は残り、投稿データが保管される間は接続情報も保持する。

Cloudflareの地域情報は概算で、ASNの登録組織名は回線事業者とは限らない。画面サイズ・表示領域・表示倍率・タイムゾーンは投稿時にブラウザーから送信される。Cookie、Authorization、Cloudflare Access JWT、reCAPTCHAトークンは保存しない。バックアップJSONにもIPアドレスを含むため、取得後は管理者だけが扱い、安全な場所に保管する。

## バックアップと復旧

定期実行は日次のJSONスナップショットを `BOARD_BACKUPS` R2バケットの `board/YYYY-MM-DD.json` に出力する。毎日のキーは日付単位で上書きされるので、長期保存にはR2バケットのライフサイクルや別リージョン/別アカウントへの保管を検討する。R2のオブジェクト一覧から日付を指定して取り出し、別媒体にも保管する。

手動復元（**非破壊インポート**：既存IDは上書きせず、存在しないIDのみ追加）:

```sh
curl -X POST "$BASE/api/admin/restore" \
  -H "Authorization: Bearer $BOARD_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  --data-binary @board-backup.json
```

JSONは `version:1` と `posts` 配列からなる。復元APIは2MB、10,000件まで。追加件数が `restored` として返る。投稿件数が増えた場合はバックアップを分割し、必要に応じて復旧方法を拡張する。少なくとも初回デプロイ時とその後定期的に、テスト環境でバックアップ・復元のリハーサルを行う。

## 制限事項・確認項目

- 掲示板の投稿は同一IP由来（秘密ソルトを用いたハッシュ）で10分5回、最短30秒間隔。reCAPTCHA成功後に制限を判定する。共有IPでは誤検知の可能性あり。
- カウンター加算は同一IP由来で24時間に1回。ブラウザ内のlocalStorageとは別のサーバー側制限であり、既存のアクセスカウンターの意味が「端末ベース」から「IPベース」に近づく。
- 掲示板投稿のIPアドレスと端末情報は投稿データとともに保持し、非公開化しても残す。レート制限用イベント表にはソルト付きIPハッシュだけを保存し、古いイベントは約24時間後に掃除する。
- 管理者トークンが流出した場合は即座にローテーションする。
- CSPはreCAPTCHAの利用を前提とする。ブラウザのコンソールで拒否ログがないことを確認し、画像・外部スクリプトを追加した際は許可先を検討する。
- 本番前に `npm run build`、`npx wrangler deploy --dry-run`、投稿・削除・非表示・reCAPTCHA・バックアップの動作を検証する。

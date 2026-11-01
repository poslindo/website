# 編集から本番公開まで

このサイトはGitHubリポジトリ `poslindo/website` とCloudflare Workers Buildsで公開します。トップページはぽすりん堂、`/ramen/` は中華そば ぽす鈴です。ソースを編集し、生成先の `_site/` は直接編集しません。

## どこを編集するか

| 内容 | 編集するファイル |
| --- | --- |
| ぽすりん堂トップ | `circle-src/index.njk` |
| 共通メニュー・レイアウト | `circle-src/_includes/partials/nav.njk`、`circle-src/_includes/layouts/circle.njk` |
| 案内・メンバー・イベント・ドキュメント | `circle-src/about/`、`circle-src/member/`、`circle-src/event/`、`circle-src/document/` |
| ぽすりん堂のCSS | `circle.css` |
| ぽす鈴のページ・CSS・画像 | `ramen-src/` |
| 掲示板・カウンター処理 | `worker/index.js`、`circle-src/site.js` |
| Markdown記事の編集 | `/admin/content/`（Cloudflare Access認証後） |
| 連絡先 | `circle-src/contact/index.njk` |
| Cloudflare Workers設定 | `wrangler.jsonc` |

トップページのカウンターは、同じブラウザーからのアクセスを24時間に1回だけ数えます。ブラウザーの保存データを消した場合や別のブラウザーでは、新しい訪問として数えます。

`.njk` の先頭の `---` で囲まれた部分はページ設定です。公開URLを変えるとき以外は残します。CSSや写真を変更したら、HTML/CSS内のファイル名と保存名が一致することを確認します。

## Markdown記事の編集画面

`/admin/board/` の「記事を編集する」から、案内・イベント・ユーザー・ドキュメントのMarkdown記事を作成・編集できます。本文を中心に編集し、狭い画面では「本文」「プレビュー」をタブで切り替えます。タイトルは本文の直上に置き、分類・保存先フォルダー・ファイル名は「記事設定」にまとめます。見出し、リンク、画像、ルビ、字下げのツールバーからMarkdownを挿入できます。入力内容は自動で下書き保存され、上部の状態表示で未保存・保存済みを確認できます。「下書きを保存」と「公開する」は別の操作です。記事本文にYAML設定はありません。タイトルは画面で別に入力してMarkdownファイル内の非表示コメントに保存し、本文中の複数の`#`見出しはそのまま表示します。

本文はでんでんマークダウンに合わせ、行内改行、全角スペースの字下げ、`{漢字|かんじ}`のルビ記法、`![説明](https://example.com/image.jpg)`の画像URL記法を使えます。記事URLは分類とファイル名から決まります（例：`event/autumn-meetup.md` → `/event/autumn-meetup/`）。

下書きはCloudflare Durable Objectに保存され、GitHubや公開サイトは更新しません。「公開する」を選んだときだけGitHubの`main`を更新し、Workers Buildsが再ビルド・公開します。初回利用前にCloudflare Worker `website` へ `CONTENT_GITHUB_TOKEN` Secretを設定し、`poslindo/website` の `main` ブランチにContentsを書き込める権限を付与してください（設定コマンド：`npx wrangler secret put CONTENT_GITHUB_TOKEN`）。Cloudflare Accessのアプリには `/admin/*` と `/api/admin/*` を含め、許可する編集者だけを登録します。

## 1. ブランチを作る

GitHubで `main` から作業ブランチを作ります。例：`edit-circle-home`。編集したファイルをコミットし、作業ブランチへpushします。GitHub Desktopなら変更を確認してコミットし、`Push origin` を押します。

## 2. ローカルで表示を確認する

リポジトリのフォルダーで次を実行します。Node.jsが必要です。

```sh
npm ci
npm run dev
```

表示されたローカルURLを開き、`/`、`/ramen/`、案内・メンバー・イベント各ページを確認します。リンク、画像、スマートフォン幅の表示も見ます。

## 3. 本番用ビルドを確認する

```sh
npm run build
```

成功すると `_site/` が生成されます。リンク切れと必要ファイルの出力を検査します。エラーが出たら表示されたファイル名・リンクを直し、再実行します。

## 4. GitHubでPull Requestを作る

作業ブランチを `main` に向けたPull Requestにします。Cloudflare Workers BuildsはPRなどの非ProductionブランチにPreview commandを実行し、プレビューURLをPRへ投稿します。Cloudflareのチェックが成功したことと、プレビューで `/`、`/ramen/`、主要ページを確認します。

Gitコマンドを使う場合はブランチ名を置き換えます。

```sh
git status
git add .
git commit -m "Update circle homepage"
git push -u origin edit-circle-home
```

## 5. 本番へ反映する

Pull Requestの差分とプレビューを確認して `main` にマージします。Cloudflare Workers BuildsのProduction branchは `main` です。`main` への更新時はBuild command `npm run build` が実行され、その後Deploy command `npx wrangler deploy` が実行されます。デプロイ成功後、CloudflareのWorker `website` に接続した公開ドメインで `/`、`/ramen/`、各ページを確認します。

## Cloudflare Workers Buildsの設定

CloudflareダッシュボードのWorker `website` → **Settings → Build** で、本番とプレビューの両方にビルドコマンドを設定します。

**Production タブ**
- Production branch：`main`
- Build command：`npm run build`
- Deploy command：`npx wrangler deploy`
- Root directory：`/`

**Preview Base タブ**
- プレビューブランチのビルド：有効
- Build command：`npm run build`
- Preview command：`npx wrangler preview`
- Root directory：`/`

`wrangler.jsonc` は静的ファイルの場所を `_site` に指定し、PRプレビュー用の `previews` ブロックを含めます。`npx wrangler preview` はこのブロックを必要とします。

## reCAPTCHA v3のキー

Google reCAPTCHA管理画面でWebのスコア型キーを作り、公開ドメイン `poslin.org` を登録します。チャレンジ・本人確認は有効にしません。連絡先の表示ボタンと掲示板の投稿時に、画面操作を挟まず裏側でスコアを確認します。サイトキーは `wrangler.jsonc` の `RECAPTCHA_SITE_KEY` に設定し、Cloudflare Worker `website` の **Settings → Variables and Secrets** に次のSecretを追加します。

- `RECAPTCHA_SECRET_KEY`：Google CloudのIntegrationタブから取得するlegacy secret key。WorkerからGoogleの検証APIを呼ぶために使います。

どちらも設定されると、連絡先ページは確認後にメールアドレスを表示し、掲示板はスコア0.5以上かつ各操作に対応するアクション名の検証に成功した投稿だけを保存します。ローカル開発では `.dev.vars.example` を `.dev.vars` にコピーして値を設定します。`.dev.vars` はGitに追加しません。

既に作成済みのプレビューはPreview Baseの変更を引き継がない場合があります。その場合はWorkerの環境選択で該当ブランチを選び、**Settings → Build** のBuild commandにも `npm run build` を設定します。

## エラー時

- ビルドが止まる：CloudflareのBuild logで最初のエラーを読み、ローカルの `npm run build` で再現します。
- プレビューだけ失敗する：`wrangler.jsonc` に `previews` があるか、Preview commandが `npx wrangler preview` かを確認します。
- 本番デプロイが失敗する：Deploy commandが `npx wrangler deploy` で、`assets.directory` が `./_site` か確認します。
- CSS・画像が出ない：ぽすりん堂は `/circle.css`、ぽす鈴は `/ramen/ramen.css` を参照しているか確認します。画像の名前と相対パスも確認します。
- 公開後に戻す：GitHubで問題のコミットをRevertして `main` に反映し、再デプロイします。`_site/` の直接編集は次のビルドで消えます。

# 編集から本番公開まで

このサイトはGitHubリポジトリ `poslindo/website` をCloudflare Pagesがビルドして公開します。編集するのはソースファイルです。生成先の `_site/` は直接編集しません。

## 公開URLと編集場所

| 変更したい内容 | 編集するファイル |
| --- | --- |
| トップページ（ぽすりん堂） | `circle-src/index.njk` |
| 共通メニュー・共通レイアウト | `circle-src/_includes/partials/nav.njk`、`circle-src/_includes/layouts/circle.njk` |
| 案内・メンバー・イベント | `circle-src/about/`、`circle-src/member/`、`circle-src/event/` |
| ぽすりん堂のデザイン | `circle.css` |
| ぽす鈴ページ・デザイン・写真 | `ramen-src/index.html`、`ramen-src/ramen.css`、`ramen-src/`内の画像 |
| ビルド設定と検査 | `eleventy.config.js`、`scripts/verify.mjs` |

`.njk` の先頭にある `---` で囲んだ部分はページ設定です。本文を編集するときも残してください。

## 1. 作業ブランチを作る

GitHubで `main` から作業ブランチを作成します。例：`edit-circle-home`。作業中の変更をブランチに保存し、確認後にPull Requestを作ります。

## 2. ファイルを編集する

GitHub上で直接編集するか、GitHub DesktopやVS Codeでリポジトリを開いて編集します。新しいページは既存の `.njk` ページを参考に作り、設定に公開URL（`permalink`）を書きます。ぽす鈴のCSS名は `ramen.css` です。HTML内の読み込み先も一致させます。写真を置き換える場合は `ramen-src/` に入れ、HTML/CSSのファイル名と一致させます。

## 3. ローカルで確認する

Node.jsを用意し、リポジトリのフォルダーで実行します。

```sh
npm ci
npm run dev
```

ターミナルに表示されたローカルURLを開き、`/`、`/ramen/`、案内・メンバー・イベント各ページを確認します。リンク、写真、スマートフォン幅の表示も見ます。

## 4. 本番用ビルドを確認する

```sh
npm run build
```

成功すると `_site/` に公開用ファイルが生成されます。リンク切れと必要ファイルの出力が検査されます。エラーが出た場合は指摘されたファイルを直して再実行します。

## 5. GitHubへ送る

GitHub Desktopでは、変更内容を確認してコミットし、`Push origin` を押します。GitHubで作業ブランチから `main` へのPull Requestを作ります。

コマンドを使う場合はブランチ名を自分のものに置き換えます。

```sh
git status
git add .
git commit -m "Update circle homepage and ramen path"
git push -u origin edit-circle-home
```

## 6. 本番へ反映・デプロイ確認

Pull Requestの差分を確認して `main` にマージします。Cloudflare PagesはProduction branchの `main` を監視しているため、マージ後に自動で `npm run build` とデプロイが始まります。Cloudflare Pagesの最新デプロイでビルド成功を確認し、公開サイトの `/`、`/ramen/`、案内・メンバー・イベントページを開いて動作を確認します。

## 問題が起きたとき

- ビルドエラー：ログに出たファイル名とエラーを直し、`npm run build` を再実行します。
- CSSが反映されない：ぽすりん堂が `/circle.css`、ぽす鈴が `/ramen/ramen.css` を参照しているか確認します。
- 写真が表示されない：画像の保存場所とHTML/CSSのファイル名・相対パスを確認します。
- デプロイされない：Cloudflare PagesのProduction branchが `main`、出力先が `_site` であることと、最新デプロイのログを確認します。
- 公開後に戻す：修正コミットを作って再デプロイするか、GitHubで問題の変更をRevertします。`_site/` を直接直しても次のビルドで消えます。

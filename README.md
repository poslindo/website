# 中華そば ぽす鈴 / ぽすりん堂

中華そば「ぽす鈴」のトップページは、リポジトリ直下のHTML・CSS・写真を**そのまま公開**します。

同人サークル「ぽすりん堂」の `/about/`、`/member/`、`/event/` 以下は **Eleventy (11ty)** で生成します。完成したページは普通の軽量なHTMLです。ブラウザ側のJavaScriptは不要です。

## 編集する場所

| 内容 | ファイル |
| --- | --- |
| サイト共通レイアウト | `circle-src/_includes/layouts/circle.njk` |
| 共通メニュー | `circle-src/_includes/partials/nav.njk` |
| フッター | `circle-src/_includes/partials/footer.njk` |
| 共通デザイン | `circle.css` |
| 会社概要 | `circle-src/about/index.njk` |
| YUUU | `circle-src/member/YUUU/index.njk` |
| IYA | `circle-src/member/IYA/index.njk` |
| イベント | `circle-src/event/` |

個人ページの `.njk` では、先頭の `---` で囲まれた設定を残し、その下のHTMLを編集してください。

## ローカルで確認する

Node.jsをインストールした環境で以下を実行します。

```sh
npm ci
npm run dev
```

本番用の出力と検査：

```sh
npm run build
```

`_site/` に公開ファイルが生成されます。`npm run build` はリンク切れとぽす鈴トップページの無変更も検査します。

## Cloudflare Pages

- リポジトリ：`poslindo/website`
- Production branch：`main`
- Framework preset：`Eleventy`（または `None`）
- Build command：`npm run build`
- Build output directory：`_site`
- Root directory：リポジトリ直下

Eleventyで生成するのは同人サイトのページだけです。ぽす鈴のHTMLはビルド時にそのままコピーします。

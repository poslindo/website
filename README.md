# ぽすりん堂 / 中華そば ぽす鈴

トップページ（`/`）は同人サークル「ぽすりん堂」、中華そば「ぽす鈴」は `/ramen/` で公開します。

## 編集する場所

| 内容 | ファイル |
| --- | --- |
| ぽすりん堂トップ | `circle-src/index.njk` |
| 共通レイアウト・メニュー | `circle-src/_includes/` |
| 案内 | `circle-src/about/index.njk` |
| メンバー | `circle-src/member/` |
| イベント | `circle-src/event/` |
| ぽすりん堂共通CSS | `circle.css` |
| ぽす鈴ページ・CSS・画像 | `ramen-src/` |
| 掲示板・カウンター処理 | `worker/index.js`、`circle-src/site.js` |
| 連絡先 | `circle-src/contact/index.njk` |
| Workers設定 | `wrangler.jsonc` |
| 編集・公開手順 | `docs/DEPLOY.md` |

トップページのカウンターは、同じブラウザーでは24時間に1回だけ増えます。ブラウザーの保存データを消した場合や別のブラウザーでは、別の訪問として数えます。

トップの「最近の更新」には、ホーム・管理画面・Nunjucks サンプルを除いた公開ページのうち、Git で最近更新された5ページが自動表示されます。

reCAPTCHA v3のキー設定は [docs/DEPLOY.md](docs/DEPLOY.md#recaptcha-v3のキー) を参照してください。

`.njk` の先頭にある `---` から `---` までのページ設定は残してください。

## ローカル確認

```sh
npm ci
npm run dev
```

本番用ビルドとリンク検査は `npm run build` です。公開用ファイルは `_site/` に生成されます。`_site/` は直接編集しません。

## Cloudflare Workers Builds

- Production branch：`main`
- Build command：`npm run build`
- Deploy command：`npx wrangler deploy`
- Preview command：`npx wrangler preview`
- Root directory：`/`
- 静的ファイル：`wrangler.jsonc` の `assets.directory` で `./_site` を指定

`main` へのマージ後に本番デプロイ、作業ブランチやPRではプレビューが実行されます。詳細は [docs/DEPLOY.md](docs/DEPLOY.md) を参照してください。

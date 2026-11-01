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
| Workers設定 | `wrangler.jsonc` |
| 編集・公開手順 | `docs/DEPLOY.md` |

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

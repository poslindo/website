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
| 編集・公開手順 | `docs/DEPLOY.md` |

`.njk` の先頭にある `---` から `---` までのページ設定は残してください。

## ローカル確認

```sh
npm ci
npm run dev
```

本番用の生成とリンク検査は `npm run build` です。公開ファイルは `_site/` に生成されます。生成物を直接編集しないでください。

## Cloudflare Pages

- Production branch：`main`
- Build command：`npm run build`
- Build output directory：`_site`
- Root directory：リポジトリ直下

`main` への反映後、Cloudflare Pagesが自動でビルド・デプロイします。手順の詳細は [docs/DEPLOY.md](docs/DEPLOY.md) を参照してください。

// 公開前の最低限の検査。外部パッケージは使わない。
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve, join, dirname } from "node:path";

const output = resolve("_site");
const circleCss = readFileSync(resolve("circle.css"), "utf8");
assert.match(circleCss, /font-family:\s*"BIZ UDPGothic",/);
const circlePages = ["index.html", "about/index.html", "member/index.html", "event/index.html", "board/index.html", "contact/index.html", "document/index.html"];
const articlePages = ["document/markdown-sample/index.html", "document/MAFUYU/index.html"];
const ramenFiles = ["ramen/index.html", "ramen/ramen.css", "ramen/ramen-hero.jpg", "ramen/interior.jpg"];
for (const file of ramenFiles) assert.ok(existsSync(join(output, file)), `Missing ramen file: ${file}`);
assert.ok(existsSync(join(output, "site.js")), "Missing site.js");
assert.ok(existsSync(join(output, "markdown-editor-sample.md.txt")), "Missing Markdown editor sample source");

for (const file of [...circlePages, ...articlePages, "ramen/index.html"]) {
  const html = readFileSync(join(output, file), "utf8");
  for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const link = match[1].split("#")[0];
    if (!link || /^(https?:|mailto:|data:|javascript:)/.test(link)) continue;
    const base = link.startsWith("/") ? join(output, link.slice(1)) : resolve(output, dirname(file), link);
    const target = link.endsWith("/") ? join(base, "index.html") : base;
    assert.ok(existsSync(target), `Broken link in ${file}: ${link}`);
  }
}
const markdownArticle = readFileSync(join(output, "document/markdown-sample/index.html"), "utf8");
assert.match(markdownArticle, /<title>Markdownで記事を書く｜ぽすりん堂<\/title>/);
assert.match(markdownArticle, /<h1>Markdownで記事を書く<\/h1>/);
assert.match(markdownArticle, /<h2>Markdownで記事を書く<\/h2>/);
assert.match(markdownArticle, /<ruby>電子出版<rt>でんししゅっぱん<\/rt><\/ruby>/);
assert.match(markdownArticle, /<br>\n空行を入れない改行は/);
assert.match(markdownArticle, /<p>　全角スペース/);
for (const file of circlePages) {
  const html = readFileSync(join(output, file), "utf8");
  assert.ok(!/<img\b/i.test(html), `${file} must remain lightweight`);
  for (const match of html.matchAll(/<script\b[^>]*src="([^"]+)"/gi)) assert.equal(match[1], "/site.js", `${file} has an unexpected script`);
}
console.log("Verified circle pages, ramen files, and local links.");

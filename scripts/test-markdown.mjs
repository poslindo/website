import assert from "node:assert/strict";
import { createMarkdown } from "./markdown.mjs";
import { decodeArticleTitle, encodeArticleTitle } from "./article-title.mjs";

const markdown = createMarkdown();
assert.match(markdown.render("{電子出版|でんししゅっぱん}"), /<ruby>電子出版<rt>でんししゅっぱん<\/rt><\/ruby>/);
assert.match(markdown.render("{電子出版|でん|し|しゅっ|ぱん}"), /<ruby>電<rt>でん<\/rt>子<rt>し<\/rt>出<rt>しゅっ<\/rt>版<rt>ぱん<\/rt><\/ruby>/);
assert.match(markdown.render("本文の途中\n次の行"), /本文の途中<br>\n次の行/);
assert.match(markdown.render("`{文字|もじ}`"), /<code>\{文字\|もじ\}<\/code>/);
assert.match(markdown.render("![写真](https://example.com/photo.jpg)"), /<img src="https:\/\/example.com\/photo.jpg" alt="写真">/);
assert.doesNotMatch(markdown.render("<script>alert(1)</script>"), /<script>/);
assert.match(markdown.render("　字下げした段落"), /<p>　字下げした段落<\/p>/);
const titleMetadata = `<!-- article-title: ${encodeArticleTitle("編集画面のタイトル")} -->`;
assert.equal(decodeArticleTitle(titleMetadata), "編集画面のタイトル");
const titled = `${titleMetadata}\n\n# 本文の見出し\n\n# もうひとつの見出し`;
const titledHtml = markdown.render(titled);
assert.doesNotMatch(titledHtml, /article-title/);
assert.match(titledHtml, /<h1>本文の見出し<\/h1>/);
assert.match(titledHtml, /<h1>もうひとつの見出し<\/h1>/);

// 公開前の最低限の検査。外部パッケージは使わない。
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve, join, dirname } from "node:path";

const output = resolve("_site");
const circlePages = ["index.html", "about/index.html", "member/index.html", "event/index.html", "event/2026IYA/index.html", "board/index.html", "contact/index.html"];
const ramenFiles = ["ramen/index.html", "ramen/ramen.css", "ramen/ramen-hero.jpg", "ramen/interior.jpg"];
for (const file of ramenFiles) assert.ok(existsSync(join(output, file)), `Missing ramen file: ${file}`);
assert.ok(existsSync(join(output, "site.js")), "Missing site.js");

for (const file of [...circlePages, "ramen/index.html"]) {
  const html = readFileSync(join(output, file), "utf8");
  for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const link = match[1].split("#")[0];
    if (!link || /^(https?:|mailto:|data:|javascript:)/.test(link)) continue;
    const target = link.startsWith("/") ? join(output, link.slice(1)) : resolve(output, dirname(file), link);
    assert.ok(existsSync(target), `Broken link in ${file}: ${link}`);
  }
}
for (const file of circlePages) {
  const html = readFileSync(join(output, file), "utf8");
  assert.ok(!/<img\b/i.test(html), `${file} must remain lightweight`);
  for (const match of html.matchAll(/<script\b[^>]*src="([^"]+)"/gi)) assert.equal(match[1], "/site.js", `${file} has an unexpected script`);
}
console.log("Verified circle pages, ramen files, and local links.");

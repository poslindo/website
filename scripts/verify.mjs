// 公開前の最低限の検査。外部パッケージは使わない。
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve, join, dirname } from "node:path";

const output = resolve("_site");
const ramenFiles = ["index.html", "styles.css", "ramen-hero.jpg", "interior.jpg"];
const circlePages = [
  "about/index.html",
  "member/index.html",
  "member/IYA/index.html",
  "member/YUUU/index.html",
  "event/index.html",
  "event/2026IYA/index.html",
];

// ぽす鈴のファイルが一文字も変わっていないことを確認する。
for (const file of ramenFiles) {
  assert.deepEqual(readFileSync(join(output, file)), readFileSync(file), `${file} changed`);
}

for (const file of ["index.html", ...circlePages]) {
  const html = readFileSync(join(output, file), "utf8");
  for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const link = match[1].split("#")[0];
    if (!link || /^(https?:|mailto:|data:)/.test(link)) continue;
    const target = link.startsWith("/")
      ? join(output, link.slice(1))
      : resolve(output, dirname(file), link);
    assert.ok(existsSync(target), `Broken link in ${file}: ${link}`);
  }
}

for (const file of circlePages) {
  const html = readFileSync(join(output, file), "utf8");
  assert.ok(!/<script\b|<img\b/i.test(html), `${file} must remain lightweight`);
}

console.log("Verified ramen files, 6 circle pages, and local links.");

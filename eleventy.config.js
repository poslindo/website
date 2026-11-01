import { readFileSync } from "node:fs";
import { createMarkdown } from "./scripts/markdown.mjs";
import { decodeArticleTitle } from "./scripts/article-title.mjs";

// ぽすりん堂の各ページと、ぽす鈴の静的サイトをまとめて出力する。
export default function (eleventyConfig) {
  eleventyConfig.setLibrary("md", createMarkdown());
  eleventyConfig.addGlobalData("layout", "layouts/circle.njk");
  eleventyConfig.addGlobalData("eleventyComputed", {
    title: (data) => {
      if (!data.page.inputPath.endsWith(".md")) return data.title;
      const source = readFileSync(data.page.inputPath, "utf8");
      return decodeArticleTitle(source) ?? data.page.fileSlug;
    },
  });
  eleventyConfig.addPassthroughCopy("circle.css");
  eleventyConfig.addPassthroughCopy("circle-src/site.js");
  eleventyConfig.addPassthroughCopy("circle-src/admin-board.js");
  eleventyConfig.addPassthroughCopy("circle-src/admin-content.js");
  eleventyConfig.addPassthroughCopy({ "circle-src/markdown-editor-sample.md.txt": "markdown-editor-sample.md.txt" });
  eleventyConfig.addPassthroughCopy({ "ramen-src": "ramen" });

  for (const category of ["about", "event", "member", "document"]) {
    eleventyConfig.addCollection(`content_${category}`, (collectionApi) =>
      collectionApi.getAll()
        .filter(item => item.data.layout === "layouts/circle.njk" && item.url.startsWith(`/${category}/`) && item.url !== `/${category}/`)
        .sort((a, b) => b.date - a.date)
    );
  }

  eleventyConfig.addCollection("recentPages", (collectionApi) =>
    collectionApi.getAll()
      .filter(({ data, url }) => data.layout === "layouts/circle.njk"
        && url !== "/"
        && !url.startsWith("/admin/")
        && !url.startsWith("/document/njk-sample/"))
      .sort((a, b) => b.date - a.date)
      .slice(0, 5)
      .map(({ date, data, url }) => ({
        date: date.toISOString().slice(0, 10),
        label: new Intl.DateTimeFormat("ja-JP", { dateStyle: "long", timeZone: "Asia/Tokyo" }).format(date),
        title: data.title,
        url,
      }))
  );

  return {
    dir: { input: "circle-src", includes: "_includes", output: "_site" },
    templateFormats: ["njk", "md"],
  };
}

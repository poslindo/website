// ぽすりん堂の各ページと、ぽす鈴の静的サイトをまとめて出力する。
export default function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy("circle.css");
  eleventyConfig.addPassthroughCopy("circle-src/site.js");
  eleventyConfig.addPassthroughCopy("circle-src/admin-board.js");
  eleventyConfig.addPassthroughCopy({ "ramen-src": "ramen" });

  eleventyConfig.addCollection("recentPages", (collectionApi) =>
    collectionApi.getAll()
      .filter(({ data, url }) => data.layout === "layouts/circle.njk"
        && url !== "/"
        && !url.startsWith("/admin/")
        && !url.startsWith("/njk-sample/"))
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
    templateFormats: ["njk"],
  };
}

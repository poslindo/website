// ぽすりん堂の各ページと、ぽす鈴の静的サイトをまとめて出力する。
export default function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy("circle.css");
  eleventyConfig.addPassthroughCopy({ "ramen-src": "ramen" });

  return {
    dir: { input: "circle-src", includes: "_includes", output: "_site" },
    templateFormats: ["njk"],
  };
}

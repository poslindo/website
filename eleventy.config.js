// 同人サークル側だけEleventyで生成する。
// ぽす鈴のトップページ・CSS・写真は加工せずにそのまま公開する。
export default function (eleventyConfig) {
  for (const file of [
    "index.html",
    "styles.css",
    "ramen-hero.jpg",
    "interior.jpg",
    "circle.css",
  ]) {
    eleventyConfig.addPassthroughCopy(file);
  }

  return {
    dir: {
      input: "circle-src",
      includes: "_includes",
      output: "_site",
    },
    templateFormats: ["njk"],
  };
}

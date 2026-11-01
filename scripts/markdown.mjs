import MarkdownIt from "markdown-it";

function dendenRuby(markdown) {
  markdown.inline.ruler.before("emphasis", "denden_ruby", (state, silent) => {
    const start = state.pos;
    if (state.src.charCodeAt(start) !== 0x7b) return false;
    const end = state.src.indexOf("}", start + 1);
    if (end < 0) return false;
    const value = state.src.slice(start + 1, end);
    const separator = value.indexOf("|");
    if (separator < 1 || separator === value.length - 1 || value.includes("\\|")) return false;
    if (silent) return true;
    const token = state.push("denden_ruby", "ruby", 0);
    token.meta = {
      base: value.slice(0, separator),
      readings: value.slice(separator + 1).split("|"),
    };
    state.pos = end + 1;
    return true;
  });

  markdown.renderer.rules.denden_ruby = (tokens, index) => {
    const { base, readings } = tokens[index].meta;
    const chars = Array.from(base);
    const escape = markdown.utils.escapeHtml;
    if (chars.length === readings.length) {
      return `<ruby>${chars.map((char, index) => `${escape(char)}<rt>${escape(readings[index])}</rt>`).join("")}</ruby>`;
    }
    return `<ruby>${escape(base)}<rt>${escape(readings.join(""))}</rt></ruby>`;
  };
}

export function createMarkdown() {
  const markdown = new MarkdownIt({ html: false, breaks: true, linkify: true });
  markdown.core.ruler.before("block", "article_title_metadata", state => {
    state.src = state.src.replace(/^<!-- article-title: [A-Za-z0-9+/=]+ -->(?:\r?\n)+/, "");
  });
  dendenRuby(markdown);
  return markdown;
}

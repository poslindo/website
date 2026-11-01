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

function dendenAlignment(markdown) {
  markdown.block.ruler.before("paragraph", "denden_alignment", (state, startLine, endLine, silent) => {
    const start = state.bMarks[startLine] + state.tShift[startLine];
    const open = /^:::(center|right)\s*$/.exec(state.src.slice(start, state.eMarks[startLine]));
    if (!open || state.sCount[startLine] - state.blkIndent >= 4) return false;
    if (silent) return true;

    let end = startLine + 1;
    for (; end < endLine; end++) {
      const line = state.bMarks[end] + state.tShift[end];
      if (/^:::\s*$/.test(state.src.slice(line, state.eMarks[end]))) break;
    }
    if (end === endLine) return false;

    const token = state.push("denden_alignment", "div", 0);
    token.meta = { alignment: open[1] };
    token.content = state.getLines(startLine + 1, end, state.blkIndent, false);
    token.map = [startLine, end + 1];
    token.block = true;
    state.line = end + 1;
    return true;
  });

  markdown.renderer.rules.denden_alignment = (tokens, index) => {
    const token = tokens[index];
    return `<div class="text-${token.meta.alignment}">\n${markdown.render(token.content)}</div>\n`;
  };
}

export function createMarkdown() {
  const markdown = new MarkdownIt({ html: false, breaks: true, linkify: true });
  markdown.core.ruler.before("block", "article_title_metadata", state => {
    state.src = state.src.replace(/^<!-- article-title: [A-Za-z0-9+/=]+ -->(?:\r?\n)+/, "");
  });
  dendenRuby(markdown);
  dendenAlignment(markdown);
  return markdown;
}

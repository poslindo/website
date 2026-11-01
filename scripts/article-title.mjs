export function encodeArticleTitle(title) {
  const bytes = new TextEncoder().encode(title);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function decodeArticleTitle(source) {
  const match = source.match(/^<!-- article-title: ([A-Za-z0-9+/=]+) -->/);
  if (!match) return null;
  const binary = atob(match[1]);
  return new TextDecoder().decode(Uint8Array.from(binary, char => char.charCodeAt(0)));
}

export function stripArticleTitle(source) {
  return source.replace(/^<!-- article-title: [A-Za-z0-9+/=]+ -->(?:\r?\n)+/, "");
}

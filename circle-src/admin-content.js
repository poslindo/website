const form = document.querySelector("#content-form");
const category = document.querySelector("#content-category");
const existing = document.querySelector("#content-existing");
const title = document.querySelector("#content-title");
const filename = document.querySelector("#content-filename");
const body = document.querySelector("#content-body");
const image = document.querySelector("#content-image");
const save = document.querySelector("#content-save");
const status = document.querySelector("#content-status");

async function request(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    cache: "no-store",
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "保存できませんでした。");
  return result;
}

async function loadFiles() {
  const { files } = await request(`/api/admin/content?category=${encodeURIComponent(category.value)}`);
  existing.replaceChildren(new Option("新しい記事", ""));
  for (const file of files) existing.add(new Option(file, file));
}

async function loadArticle() {
  if (!existing.value) {
    title.value = "";
    filename.value = "";
    body.value = "";
    return;
  }
  const query = new URLSearchParams({ category: category.value, filename: existing.value });
  const article = await request(`/api/admin/content?${query}`);
  title.value = article.title;
  filename.value = article.filename;
  body.value = article.body;
}

category.addEventListener("change", () => {
  title.value = "";
  filename.value = "";
  body.value = "";
  loadFiles().catch(error => { status.textContent = error.message; });
});
image.addEventListener("click", () => {
  const url = prompt("画像のURL（https://...）");
  if (!url) return;
  let imageUrl;
  try {
    imageUrl = new URL(url);
    if (imageUrl.protocol !== "https:") throw new Error();
  } catch {
    status.textContent = "画像URLはhttps://から入力してください。";
    return;
  }
  const alt = prompt("画像の説明（代替テキスト）") || "";
  const markdown = `![${alt.replace(/\]/g, "\\]")}](${imageUrl.href})`;
  const start = body.selectionStart;
  body.setRangeText(markdown, start, body.selectionEnd, "end");
  body.focus();
});
existing.addEventListener("change", () => loadArticle().catch(error => { status.textContent = error.message; }));
form.addEventListener("submit", async event => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  save.disabled = true;
  status.textContent = "保存中…";
  try {
    await request("/api/admin/content", {
      method: "POST",
      body: JSON.stringify({ category: category.value, filename: filename.value, title: title.value, body: body.value }),
    });
    status.textContent = "保存しました。ビルド後に公開ページへ反映されます。";
    await loadFiles();
    existing.value = filename.value;
  } catch (error) {
    status.textContent = error.message;
  } finally {
    save.disabled = false;
  }
});

loadFiles().catch(error => { status.textContent = error.message; });

const form = document.querySelector("#content-form");
const category = document.querySelector("#content-category");
const existing = document.querySelector("#content-existing");
const title = document.querySelector("#content-title");
const filename = document.querySelector("#content-filename");
const body = document.querySelector("#content-body");
const preview = document.querySelector("#content-preview");
const previewError = document.querySelector("#content-preview-error");
const sampleSource = document.querySelector("#content-sample-source");
const useSample = document.querySelector("#content-use-sample");
const draftSave = document.querySelector("#content-draft-save");
const publish = document.querySelector("#content-publish");
const status = document.querySelector("#content-status");
const workspace = document.querySelector(".content-editor-workspace");
const writeTab = document.querySelector("#content-tab-write");
const previewTab = document.querySelector("#content-tab-preview");

async function request(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    cache: "no-store",
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  let result;
  try { result = await response.json(); }
  catch { throw new Error(`HTTP ${response.status}: サーバーからJSON応答を取得できませんでした。`); }
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${result.error || "処理に失敗しました。"}`);
  return result;
}

let activeDraftId = null;
let previewTimer;
let draftTimer;
let previewController;
let savingDraft = false;
let dirty = false;
let sample = "";
let revision = 0;
workspace.dataset.mobileTab = "write";

function setStatus(message) { status.textContent = message; }
function markDirty() {
  revision++;
  dirty = true;
  setStatus("未保存の変更があります");
  clearTimeout(draftTimer);
  draftTimer = setTimeout(saveCurrentDraft, 900);
  schedulePreview();
}

async function loadFiles() {
  const params = `?category=${encodeURIComponent(category.value)}`;
  const [{ files }, { drafts }] = await Promise.all([
    request(`/api/admin/content${params}`),
    request(`/api/admin/content-drafts${params}`),
  ]);
  const selected = existing.value;
  existing.replaceChildren(new Option("新しい記事", ""));
  const articles = document.createElement("optgroup");
  articles.label = "公開中の記事";
  for (const file of files) articles.append(new Option(file, `article:${file}`));
  existing.append(articles);
  const savedDrafts = document.createElement("optgroup");
  savedDrafts.label = "下書き";
  for (const draft of drafts) savedDrafts.append(new Option(draft.title || draft.filename || "無題の下書き", `draft:${draft.id}`));
  existing.append(savedDrafts);
  if ([...existing.options].some(option => option.value === selected)) existing.value = selected;
}

async function renderPreview() {
  previewController?.abort();
  previewController = new AbortController();
  try {
    const result = await request("/api/admin/content/preview", {
      method: "POST",
      signal: previewController.signal,
      body: JSON.stringify({ title: title.value || "記事タイトル", body: body.value }),
    });
    const escapedTitle = (title.value || "記事タイトル").replace(/[&<>\"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]);
    preview.srcdoc = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><link rel="stylesheet" href="/circle.css"></head><body><h1>${escapedTitle}</h1><hr>${result.html}</body></html>`;
    previewError.hidden = true;
    previewError.textContent = "";
  } catch (error) {
    if (error.name === "AbortError") return;
    previewError.textContent = `プレビューを更新できません。${error.message}`;
    previewError.hidden = false;
  }
}

function schedulePreview() {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(renderPreview, 250);
}

async function loadArticle() {
  clearTimeout(draftTimer);
  if (!existing.value) {
    activeDraftId = null;
    title.value = "";
    filename.value = "";
    body.value = "";
    dirty = false;
    setStatus("新しい記事");
    schedulePreview();
    return;
  }
  if (existing.value.startsWith("draft:")) {
    activeDraftId = existing.value.slice(6);
    const draft = await request(`/api/admin/content-draft?id=${encodeURIComponent(activeDraftId)}`);
    category.value = draft.category;
    title.value = draft.title;
    filename.value = draft.filename;
    body.value = draft.body;
    dirty = false;
    setStatus(`下書き保存済み · ${new Date(draft.updatedAt).toLocaleString("ja-JP")}`);
  } else {
    const articleName = existing.value.slice(8);
    activeDraftId = null;
    const query = new URLSearchParams({ category: category.value, filename: articleName });
    const article = await request(`/api/admin/content?${query}`);
    title.value = article.title;
    filename.value = article.filename;
    body.value = article.body;
    dirty = false;
    setStatus("公開中の記事を編集中");
  }
  schedulePreview();
}

async function saveCurrentDraft() {
  if (savingDraft || !dirty) return;
  savingDraft = true;
  const savedRevision = revision;
  let saveAgain = false;
  existing.disabled = true;
  try {
    activeDraftId ||= crypto.randomUUID();
    const result = await request("/api/admin/content-drafts", {
      method: "POST",
      body: JSON.stringify({ id: activeDraftId, category: category.value, filename: filename.value, title: title.value, body: body.value }),
    });
    dirty = revision !== savedRevision;
    setStatus(dirty ? "保存中に変更があり、続けて保存します…" : `下書き保存済み · ${new Date(result.updatedAt).toLocaleString("ja-JP")}`);
    await loadFiles();
    existing.value = `draft:${activeDraftId}`;
    saveAgain = dirty;
  } catch (error) {
    setStatus(`下書きを保存できません。${error.message}`);
  } finally {
    savingDraft = false;
    existing.disabled = false;
    if (saveAgain) draftTimer = setTimeout(saveCurrentDraft, 0);
  }
}

async function publishArticle() {
  if (!form.reportValidity()) return;
  clearTimeout(draftTimer);
  publish.disabled = true;
  draftSave.disabled = true;
  setStatus("公開しています…");
  try {
    const result = await request("/api/admin/content", {
      method: "POST",
      body: JSON.stringify({ category: category.value, filename: filename.value, title: title.value, body: body.value }),
    });
    let draftCleanupFailed = false;
    if (activeDraftId) {
      try { await request(`/api/admin/content-draft?id=${encodeURIComponent(activeDraftId)}`, { method: "DELETE" }); }
      catch { draftCleanupFailed = true; }
    }
    activeDraftId = null;
    dirty = false;
    setStatus(`公開しました · ${result.url} · ビルド完了後に反映されます${draftCleanupFailed ? "（下書き一覧の整理は未完了です）" : ""}`);
    await loadFiles().catch(() => {});
    existing.value = `article:${filename.value}`;
  } catch (error) {
    dirty = true;
    revision++;
    await saveCurrentDraft();
    setStatus(`公開できません。入力内容を保持しました。${error.message}`);
  } finally {
    publish.disabled = false;
    draftSave.disabled = false;
  }
}

function insertText(before, after = "", placeholder = "") {
  const start = body.selectionStart;
  const end = body.selectionEnd;
  const selected = body.value.slice(start, end) || placeholder;
  body.setRangeText(`${before}${selected}${after}`, start, end, "select");
  body.focus();
  markDirty();
}

document.querySelector(".content-markdown-toolbar").addEventListener("click", event => {
  const action = event.target.closest("[data-insert]")?.dataset.insert;
  if (!action) return;
  if (action === "h2" || action === "h3") insertText(`${action === "h2" ? "##" : "###"} `, "", "見出し");
  if (action === "link") insertText("[", "](https://)", "リンク文字列");
  if (action === "image") insertText("![", "](https://)", "画像の説明");
  if (action === "ruby") insertText("{", "|よみ}", "漢字");
  if (action === "indent") {
    const start = body.selectionStart;
    const end = body.selectionEnd;
    const lineStart = body.value.lastIndexOf("\n", start - 1) + 1;
    const lineEnd = body.value.indexOf("\n", end) < 0 ? body.value.length : body.value.indexOf("\n", end);
    const selected = body.value.slice(lineStart, lineEnd).split("\n").map(line => `　${line}`).join("\n");
    body.setRangeText(selected, lineStart, lineEnd, "select");
    body.focus();
    markDirty();
  }
});

title.addEventListener("input", markDirty);
filename.addEventListener("input", markDirty);
body.addEventListener("input", markDirty);
category.addEventListener("change", () => {
  activeDraftId = null;
  existing.value = "";
  markDirty();
  loadFiles().catch(error => setStatus(`記事一覧を取得できません。${error.message}`));
});
existing.addEventListener("change", async () => {
  const selected = existing.value;
  await saveCurrentDraft();
  if (dirty) {
    existing.value = activeDraftId ? `draft:${activeDraftId}` : "";
    return;
  }
  existing.value = selected;
  loadArticle().catch(error => setStatus(`記事を読み込めません。${error.message}`));
});
draftSave.addEventListener("click", () => saveCurrentDraft());
publish.addEventListener("click", publishArticle);
form.addEventListener("submit", event => event.preventDefault());
useSample.addEventListener("click", () => {
  body.value = sample;
  title.value = "Markdown記事のサンプル";
  filename.value = "";
  existing.value = "";
  activeDraftId = null;
  markDirty();
});
writeTab.addEventListener("click", () => {
  workspace.dataset.mobileTab = "write";
  writeTab.setAttribute("aria-selected", "true");
  previewTab.setAttribute("aria-selected", "false");
});
previewTab.addEventListener("click", () => {
  workspace.dataset.mobileTab = "preview";
  writeTab.setAttribute("aria-selected", "false");
  previewTab.setAttribute("aria-selected", "true");
});

loadFiles().catch(error => setStatus(`記事一覧を取得できません。${error.message}`));
fetch("/markdown-editor-sample.md.txt", { cache: "no-store" }).then(response => {
  if (!response.ok) throw new Error();
  return response.text();
}).then(source => { sample = source; sampleSource.textContent = source; }).catch(() => { sampleSource.textContent = "サンプルを読み込めませんでした。"; });
schedulePreview();

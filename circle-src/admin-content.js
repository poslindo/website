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
const draftDelete = document.querySelector("#content-draft-delete");
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
let previewController;
let savingDraft = false;
let dirty = false;
let sample = "";
let revision = 0;
let loadedSelection = "";
let loadedCategory = category.value;
workspace.dataset.mobileTab = "write";

function setStatus(message) { status.textContent = message; }
function markDirty() {
  revision++;
  dirty = true;
  setStatus("未保存の変更があります。「下書きを保存」で保存できます。");
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

async function loadArticle(selection = existing.value) {
  if (!selection) {
    activeDraftId = null;
    title.value = "";
    filename.value = "";
    body.value = "";
    dirty = false;
    draftDelete.hidden = true;
    loadedSelection = "";
    loadedCategory = category.value;
    setStatus("新しい記事");
    schedulePreview();
    return;
  }
  if (selection.startsWith("draft:")) {
    activeDraftId = selection.slice(6);
    draftDelete.hidden = false;
    const draft = await request(`/api/admin/content-draft?id=${encodeURIComponent(activeDraftId)}`);
    title.value = draft.title;
    filename.value = draft.filename;
    body.value = draft.body;
    dirty = false;
    setStatus(`下書き保存済み · ${new Date(draft.updatedAt).toLocaleString("ja-JP")}`);
  } else {
    const articleName = selection.slice(8);
    activeDraftId = null;
    draftDelete.hidden = true;
    const query = new URLSearchParams({ category: category.value, filename: articleName });
    const article = await request(`/api/admin/content?${query}`);
    title.value = article.title;
    filename.value = article.filename;
    body.value = article.body;
    dirty = false;
    setStatus("公開中の記事を編集中");
  }
  loadedSelection = selection;
  schedulePreview();
}

async function saveCurrentDraft() {
  if (savingDraft || !dirty) return;
  savingDraft = true;
  const savedRevision = revision;
  existing.disabled = true;
  draftSave.disabled = true;
  publish.disabled = true;
  try {
    activeDraftId ||= crypto.randomUUID();
    const result = await request("/api/admin/content-drafts", {
      method: "POST",
      body: JSON.stringify({ id: activeDraftId, category: category.value, filename: filename.value, title: title.value, body: body.value }),
    });
    dirty = revision !== savedRevision;
    setStatus(dirty
      ? "下書きを保存しました。保存中に編集した変更は未保存です。もう一度保存してください。"
      : `下書き保存済み · ${new Date(result.updatedAt).toLocaleString("ja-JP")}`);
    await loadFiles().catch(() => {
      if (![...existing.options].some(option => option.value === `draft:${activeDraftId}`))
        existing.add(new Option(title.value || filename.value || "下書き", `draft:${activeDraftId}`));
    });
    existing.value = `draft:${activeDraftId}`;
    loadedSelection = existing.value;
    loadedCategory = category.value;
    draftDelete.hidden = false;
  } catch (error) {
    setStatus(`下書きを保存できません。${error.message}`);
  } finally {
    savingDraft = false;
    existing.disabled = false;
    draftSave.disabled = false;
    publish.disabled = false;
  }
}

async function publishArticle() {
  if (savingDraft) return;
  if (!form.reportValidity()) return;
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
    loadedSelection = existing.value;
    loadedCategory = category.value;
    draftDelete.hidden = true;
  } catch (error) {
    dirty = true;
    revision++;
    setStatus(`公開できません。編集内容は未保存のまま画面に残っています。「下書きを保存」で残せます。${error.message}`);
  } finally {
    publish.disabled = false;
    draftSave.disabled = false;
  }
}

async function deleteCurrentDraft() {
  if (!activeDraftId || !existing.value.startsWith("draft:")) return;
  if (!confirm("この保存済み下書きを完全に削除しますか？未保存の編集も破棄されます。")) return;
  draftDelete.disabled = true;
  try {
    await request(`/api/admin/content-draft?id=${encodeURIComponent(activeDraftId)}`, { method: "DELETE" });
    activeDraftId = null;
    dirty = false;
    existing.value = "";
    await loadFiles();
    await loadArticle("");
    setStatus("下書きを削除しました。");
  } catch (error) {
    setStatus(`下書きを削除できません。${error.message}`);
  } finally {
    draftDelete.disabled = false;
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
  if (dirty && !confirm("未保存の編集を破棄して分類を切り替えますか？")) {
    category.value = loadedCategory;
    return;
  }
  dirty = false;
  loadedCategory = category.value;
  activeDraftId = null;
  existing.value = "";
  loadArticle("");
  loadFiles().catch(error => setStatus(`記事一覧を取得できません。${error.message}`));
});
existing.addEventListener("change", async () => {
  const selected = existing.value;
  if (dirty && !confirm("未保存の編集を破棄して別の記事を開きますか？")) {
    existing.value = loadedSelection;
    return;
  }
  dirty = false;
  loadArticle(selected).catch(error => {
    existing.value = loadedSelection;
    setStatus(`記事を読み込めません。${error.message}`);
  });
});
draftSave.addEventListener("click", () => saveCurrentDraft());
draftDelete.addEventListener("click", deleteCurrentDraft);
publish.addEventListener("click", publishArticle);
form.addEventListener("submit", event => event.preventDefault());
useSample.addEventListener("click", () => {
  if (dirty && !confirm("未保存の編集を破棄してサンプルを読み込みますか？")) return;
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

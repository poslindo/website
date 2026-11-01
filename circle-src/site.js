const count = document.querySelector("#visit-count");
const kiriban = document.querySelector("#kiriban-message");
if (count) fetch("/api/counter", { method: "POST" }).then(r => r.json()).then(data => {
  count.textContent = data.count.toLocaleString("ja-JP");
  if (data.kiriban) kiriban.textContent = `キリ番 ${data.count.toLocaleString("ja-JP")} 番を踏みました！`;
}).catch(() => { count.textContent = "集計中"; });

const form = document.querySelector("#board-form");
const list = document.querySelector("#board-posts");
const status = document.querySelector("#board-status");
function renderPosts(posts) {
  list.replaceChildren();
  for (const post of posts) {
    const article = document.createElement("article"); article.className = "board-post";
    const heading = document.createElement("h3"); heading.textContent = post.name;
    const time = document.createElement("time"); time.dateTime = post.createdAt; time.textContent = new Date(post.createdAt).toLocaleString("ja-JP");
    const message = document.createElement("p"); message.textContent = post.message;
    article.append(heading, time, message); list.append(article);
  }
}
async function loadPosts() {
  const response = await fetch("/api/board");
  if (!response.ok) throw new Error("掲示板を読み込めませんでした。");
  renderPosts((await response.json()).posts);
}
if (list) loadPosts().catch(error => { status.textContent = error.message; });
if (form) form.addEventListener("submit", async event => {
  event.preventDefault(); status.textContent = "投稿中…";
  const fields = new FormData(form);
  try {
    const response = await fetch("/api/board", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: fields.get("name"), message: fields.get("message"), website: fields.get("website") }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "投稿に失敗しました。");
    form.reset(); status.textContent = "投稿しました。"; await loadPosts();
  } catch (error) { status.textContent = error.message; }
});
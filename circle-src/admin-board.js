const status = document.querySelector("#admin-status");
const list = document.querySelector("#admin-posts");
const refresh = document.querySelector("#admin-refresh");

async function fetchAdmin(url, options = {}) {
  const response = await fetch(url, { credentials: "same-origin", cache: "no-store", ...options });
  if (response.status === 401 || response.status === 403) {
    throw new Error("管理者認証が必要です。Cloudflare Accessの設定とログイン状態を確認してください。");
  }
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "通信に失敗しました。");
  return data;
}

async function load() {
  status.textContent = "読み込み中…";
  try {
    const { posts } = await fetchAdmin("/api/admin/board");
    list.replaceChildren();
    for (const post of [...posts].reverse()) {
      const article = document.createElement("article");
      article.className = "board-post";
      const title = document.createElement("h3");
      title.textContent = "#" + post.id + " " + post.name + (post.hidden ? "（非公開）" : "（公開中）");
      const time = document.createElement("time");
      time.dateTime = post.createdAt;
      time.textContent = new Date(post.createdAt).toLocaleString("ja-JP");
      const body = document.createElement("p");
      body.textContent = post.message;
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = post.hidden ? "復元して再公開" : "削除（非公開にする）";
      button.addEventListener("click", async () => {
        const action = post.hidden ? "show" : "delete";
        const question = post.hidden ? "この投稿を再公開しますか？" : "この投稿を非公開にしますか？ 後から復元できます。";
        if (!confirm(question)) return;
        button.disabled = true;
        try {
          await fetchAdmin("/api/admin/board", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: post.id, action })
          });
          await load();
        } catch (error) {
          status.textContent = error.message;
          button.disabled = false;
        }
      });
      article.append(title, time, body, button);
      list.append(article);
    }
    status.textContent = posts.length + "件の投稿があります。";
  } catch (error) {
    status.textContent = error.message;
  }
}

refresh.addEventListener("click", load);
load();

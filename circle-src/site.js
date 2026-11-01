const count = document.querySelector("#visit-count");
const kiriban = document.querySelector("#kiriban-message");
if (count) fetch("/api/counter", { method: "POST" }).then(r => r.json()).then(data => {
  count.textContent = data.count.toLocaleString("ja-JP");
  if (data.kiriban) kiriban.textContent = `キリ番 ${data.count.toLocaleString("ja-JP")} 番を踏みました！`;
}).catch(() => { count.textContent = "集計中"; });

const form = document.querySelector("#board-form");
const list = document.querySelector("#board-posts");
const status = document.querySelector("#board-status");
const contactStatus = document.querySelector("#contact-status");
const contactAddress = document.querySelector("#contact-address");
const contactInstructions = document.querySelector("#contact-instructions");
const contactReveal = document.querySelector("#contact-reveal");
let recaptchaSiteKey;

async function setupRecaptcha() {
  if (!form && !contactReveal) return;
  const statusTarget = form ? status : contactStatus;
  try {
    const configResponse = await fetch("/api/recaptcha/config");
    const { siteKey } = await configResponse.json();
    if (!configResponse.ok || !siteKey) throw new Error("reCAPTCHAの設定がありません。");
    recaptchaSiteKey = siteKey;
    if (!window.grecaptcha) await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}&hl=ja`;
      script.async = true;
      script.defer = true;
      script.onload = resolve;
      script.onerror = () => reject(new Error("reCAPTCHAを読み込めませんでした。"));
      document.head.append(script);
    });
    await new Promise(resolve => window.grecaptcha.ready(resolve));
    if (form) form.querySelector("button[type=submit]").disabled = false;
    if (contactReveal) contactReveal.disabled = false;
  } catch (error) { statusTarget.textContent = error.message; }
}

async function getRecaptchaToken(action) {
  if (!recaptchaSiteKey || !window.grecaptcha) throw new Error("reCAPTCHAを読み込めませんでした。");
  return window.grecaptcha.execute(recaptchaSiteKey, { action });
}

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
    const token = await getRecaptchaToken("board_post");
    const response = await fetch("/api/board", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: fields.get("name"), message: fields.get("message"), website: fields.get("website"), token }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "投稿に失敗しました。");
    form.reset(); status.textContent = "投稿しました。"; await loadPosts();
  } catch (error) { status.textContent = error.message; }
});

if (contactReveal) contactReveal.addEventListener("click", async () => {
  contactStatus.textContent = "確認中…";
  try {
    const token = await getRecaptchaToken("contact_reveal");
    const response = await fetch("/api/contact/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "確認できませんでした。");
    contactAddress.textContent = result.email.replace("@", " [at] ").replace(/\./g, " [dot] ");
    contactAddress.hidden = false;
    contactInstructions.hidden = false;
    contactStatus.textContent = "確認できました。";
  } catch (error) { contactStatus.textContent = error.message; }
});

setupRecaptcha();

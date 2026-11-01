import { DurableObject } from "cloudflare:workers";

const json = (data, status = 200) => Response.json(data, { status });
const emailAddress = "contact" + "@" + "poslin.org";

async function verifyRecaptcha(token, action, request, env) {
  if (!env.RECAPTCHA_SECRET_KEY) return json({ error: "reCAPTCHAの検証設定がありません。" }, 503);
  if (typeof token !== "string" || token.length === 0 || token.length > 5000) return json({ error: "reCAPTCHAを確認してください。" }, 400);
  const form = new URLSearchParams({ secret: env.RECAPTCHA_SECRET_KEY, response: token });
  let result;
  try {
    const response = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
    });
    if (!response.ok) return json({ error: "reCAPTCHAを検証できませんでした。" }, 502);
    result = await response.json();
  } catch { return json({ error: "reCAPTCHAを検証できませんでした。" }, 502); }
  if (!result.success || result.hostname !== new URL(request.url).hostname || result.action !== action || typeof result.score !== "number" || result.score < 0.5) {
    return json({ error: "reCAPTCHAの確認に失敗しました。もう一度お試しください。" }, 403);
  }
  return null;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
    if (request.method !== "GET" && request.method !== "POST") return json({ error: "Method not allowed" }, 405);
    const id = env.SITE_STATE.idFromName("site-state");
    return env.SITE_STATE.get(id).fetch(request);
  },
};

export class SiteState extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS site_counter (id INTEGER PRIMARY KEY, value INTEGER NOT NULL);`);
    ctx.storage.sql.exec(`INSERT OR IGNORE INTO site_counter (id, value) VALUES (1, 0);`);
    ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS board_posts (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, message TEXT NOT NULL, created_at TEXT NOT NULL);`);
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/api/recaptcha/config" && request.method === "GET") {
      return json({
        siteKey: this.env.RECAPTCHA_SITE_KEY || null,
        ready: Boolean(this.env.RECAPTCHA_SECRET_KEY),
      });
    }
    if (url.pathname === "/api/contact/verify" && request.method === "POST") {
      if (request.headers.get("Origin") !== url.origin) return json({ error: "不正な送信元です。" }, 403);
      if (Number(request.headers.get("Content-Length") || 0) > 6000) return json({ error: "確認情報が大きすぎます。" }, 413);
      let body;
      try {
        const raw = await request.text();
        if (new TextEncoder().encode(raw).byteLength > 6000) return json({ error: "確認情報が大きすぎます。" }, 413);
        body = JSON.parse(raw);
      } catch { return json({ error: "確認情報を読み取れません。" }, 400); }
      const error = await verifyRecaptcha(body?.token, "contact_reveal", request, this.env);
      return error || json({ email: emailAddress });
    }
    if (url.pathname === "/api/counter" && request.method === "POST") {
      const row = this.ctx.storage.sql.exec(`UPDATE site_counter SET value = value + 1 WHERE id = 1 RETURNING value`).one();
      return json({ count: row.value, kiriban: row.value % 1000 === 0 });
    }
    if (url.pathname === "/api/board" && request.method === "GET") {
      const posts = this.ctx.storage.sql.exec(`SELECT name, message, created_at AS createdAt FROM board_posts ORDER BY id DESC LIMIT 50`).toArray();
      return json({ posts });
    }
    if (url.pathname === "/api/board" && request.method === "POST") {
      const origin = request.headers.get("Origin");
      if (origin !== url.origin) return json({ error: "不正な送信元です。" }, 403);
      const length = Number(request.headers.get("Content-Length") || 0);
      if (length > 4096) return json({ error: "投稿が大きすぎます。" }, 413);
      let body;
      try {
        const raw = await request.text();
        if (new TextEncoder().encode(raw).byteLength > 4096) return json({ error: "投稿が大きすぎます。" }, 413);
        body = JSON.parse(raw);
      } catch { return json({ error: "投稿内容を読み取れません。" }, 400); }
      if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "投稿内容を読み取れません。" }, 400);
      if (body.website) return json({ ok: true });
      const name = typeof body.name === "string" ? body.name.trim() : "";
      const message = typeof body.message === "string" ? body.message.trim() : "";
      if (!name || name.length > 40 || !message || message.length > 500) return json({ error: "名前は1〜40文字、本文は1〜500文字で入力してください。" }, 400);
      const captchaError = await verifyRecaptcha(body.token, "board_post", request, this.env);
      if (captchaError) return captchaError;
      this.ctx.storage.sql.exec(`INSERT INTO board_posts (name, message, created_at) VALUES (?, ?, ?)`, name, message, new Date().toISOString());
      this.ctx.storage.sql.exec(`DELETE FROM board_posts WHERE id NOT IN (SELECT id FROM board_posts ORDER BY id DESC LIMIT 50)`);
      return json({ ok: true }, 201);
    }
    return json({ error: "Not found" }, 404);
  }
}

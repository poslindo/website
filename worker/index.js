import { DurableObject } from "cloudflare:workers";
import { decodeArticleTitle, encodeArticleTitle, stripArticleTitle } from "../scripts/article-title.mjs";

const json = (data, status = 200) => Response.json(data, { status });
const LIMIT_WINDOW_MS = 10 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const encoder = new TextEncoder();
const sameSecret = async (received, configured) => {
  if (!configured || typeof received !== "string") return false;
  const [a, b] = await Promise.all([received, configured].map(async value =>
    new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value)))));
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i];
  return difference === 0;
};
async function clientKey(request, env) {
  // Rate-limit records use hashes; the salt must be a Cloudflare secret.
  if (!env.RATE_LIMIT_SALT) throw new Error("RATE_LIMIT_SALT is missing");
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(env.RATE_LIMIT_SALT + ":" + ip));
  return Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, "0")).join("");
}
const noStore = response => {
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "no-store");
  return new Response(response.body, { status: response.status, headers });
};
const contentCategories = new Set(["about", "event", "member", "document"]);
const contentFilename = value => typeof value === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && value !== "index";
const githubHeaders = token => ({
  "Authorization": `Bearer ${token}`,
  "Accept": "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
});
async function contentApi(request, env, url) {
  const repository = env.CONTENT_REPOSITORY;
  const branch = env.CONTENT_BRANCH || "main";
  if (!env.CONTENT_GITHUB_TOKEN || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository || ""))
    return json({ error: "記事編集のGitHub設定がありません。管理者に連絡してください。" }, 503);
  const queryCategory = request.method === "POST" ? null : url.searchParams.get("category");
  let data;
  if (request.method === "POST") {
    try {
      if (Number(request.headers.get("Content-Length") || 0) > 300_000) return json({ error: "本文が長すぎます。" }, 413);
      data = await request.json();
    } catch { return json({ error: "入力内容を読み取れませんでした。" }, 400); }
  }
  const selectedCategory = data?.category || queryCategory;
  if (!contentCategories.has(selectedCategory)) return json({ error: "分類が正しくありません。" }, 400);
  const api = `https://api.github.com/repos/${repository}/contents/`;
  const headers = githubHeaders(env.CONTENT_GITHUB_TOKEN);
  const path = `circle-src/${selectedCategory}`;
  if (request.method === "GET" && !url.searchParams.has("filename")) {
    const response = await fetch(`${api}${path}?ref=${encodeURIComponent(branch)}`, { headers });
    if (!response.ok) return json({ error: "記事一覧を取得できませんでした。" }, response.status === 404 ? 404 : 502);
    const files = (await response.json()).filter(item => item.type === "file" && item.name.endsWith(".md"))
      .map(item => item.name.slice(0, -3)).filter(contentFilename);
    return json({ files });
  }
  if (request.method === "GET") {
    const name = url.searchParams.get("filename");
    if (!contentFilename(name)) return json({ error: "ファイル名が正しくありません。" }, 400);
    const response = await fetch(`${api}${path}/${name}.md?ref=${encodeURIComponent(branch)}`, { headers });
    if (!response.ok) return json({ error: "記事を読み込めませんでした。" }, response.status === 404 ? 404 : 502);
    const file = await response.json();
    const source = new TextDecoder().decode(Uint8Array.from(atob(file.content.replace(/\s/g, "")), char => char.charCodeAt(0)));
    return json({ filename: name, title: decodeArticleTitle(source) || name, body: stripArticleTitle(source) });
  }
  if (request.method === "POST") {
    const { filename: name, title, body } = data || {};
    if (!contentFilename(name) || typeof title !== "string" || !title.trim() || title.length > 150 || /[\r\n]/.test(title) ||
      typeof body !== "string" || new TextEncoder().encode(body).length > 250_000)
      return json({ error: "タイトル、ファイル名、本文を確認してください。" }, 400);
    const content = `<!-- article-title: ${encodeArticleTitle(title.trim())} -->\n\n${body.replace(/\s+$/, "")}\n`;
    const filePath = `${path}/${name}.md`;
    const route = await fetch(`${api}${path}/${name}?ref=${encodeURIComponent(branch)}`, { headers });
    if (route.ok) return json({ error: "同じURLになるフォルダーがすでにあります。別のファイル名を選んでください。" }, 409);
    if (route.status !== 404) return json({ error: "記事URLの重複を確認できませんでした。" }, 502);
    const existing = await fetch(`${api}${filePath}?ref=${encodeURIComponent(branch)}`, { headers });
    let sha;
    if (existing.ok) sha = (await existing.json()).sha;
    else if (existing.status !== 404) return json({ error: "既存記事を確認できませんでした。" }, 502);
    const bytes = new TextEncoder().encode(content);
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    const saved = await fetch(api + filePath, {
      method: "PUT",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ message: `記事を更新: ${name}`, content: btoa(binary), branch, ...(sha ? { sha } : {}) }),
    });
    if (!saved.ok) return json({ error: "GitHubへの保存に失敗しました。少し待って再度お試しください。" }, 502);
    return json({ ok: true, url: `/${selectedCategory}/${name}/` });
  }
  return json({ error: "Method not allowed" }, 405);
}

function decodeJwtPart(part) {
  const base64 = part.replace(/-/g, "+").replace(/_/g, "/");
  return JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "=")));
}
async function verifyAccess(request, env) {
  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) return false;
  const jwt = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!jwt || jwt.length > 12000) return false;
  try {
    const parts = jwt.split(".");
    if (parts.length !== 3) return false;
    const header = decodeJwtPart(parts[0]);
    const claims = decodeJwtPart(parts[1]);
    const teamUrl = new URL(env.ACCESS_TEAM_DOMAIN);
    if (teamUrl.protocol !== "https:" || !teamUrl.hostname.endsWith(".cloudflareaccess.com") ||
        teamUrl.pathname !== "/" || teamUrl.search || teamUrl.hash) return false;
    const issuer = teamUrl.origin;
    if (header.alg !== "RS256" || typeof header.kid !== "string" ||
        claims.iss !== issuer || !Array.isArray(claims.aud) ||
        !claims.aud.includes(env.ACCESS_AUD) ||
        !Number.isFinite(claims.exp) || claims.exp <= Date.now() / 1000 ||
        !Number.isFinite(claims.nbf) && claims.nbf !== undefined ||
        claims.nbf > Date.now() / 1000) return false;
    const certs = await fetch(issuer + "/cdn-cgi/access/certs");
    if (!certs.ok) return false;
    const body = await certs.json();
    const jwk = body.keys?.find(key => key.kid === header.kid && key.kty === "RSA");
    if (!jwk) return false;
    const key = await crypto.subtle.importKey("jwk", jwk, {
      name: "RSASSA-PKCS1-v1_5", hash: "SHA-256"
    }, false, ["verify"]);
    const signatureBase64 = parts[2].replace(/-/g, "+").replace(/_/g, "/");
    const signature = Uint8Array.from(atob(signatureBase64.padEnd(Math.ceil(signatureBase64.length / 4) * 4, "=")), c => c.charCodeAt(0));
    return await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, signature, encoder.encode(parts[0] + "." + parts[1]));
  } catch { return false; }
}
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
  async scheduled(event, env) {
    if (!env.BOARD_BACKUPS) throw new Error("BOARD_BACKUPS R2 binding is missing");
    const id = env.SITE_STATE.idFromName("site-state");
    const response = await env.SITE_STATE.get(id).fetch(new Request(
      "https://internal.invalid/api/admin/backup",
      { headers: { Authorization: "Bearer " + env.BOARD_ADMIN_TOKEN } }
    ));
    if (!response.ok) throw new Error("Backup export failed: " + response.status);
    const body = await response.text();
    const day = new Date(event.scheduledTime || Date.now()).toISOString().slice(0, 10);
    await env.BOARD_BACKUPS.put("board/" + day + ".json", body, {
      httpMetadata: { contentType: "application/json" }
    });
  },
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) {
      const response = await env.ASSETS.fetch(request);
      const headers = new Headers(response.headers);
      headers.set("X-Content-Type-Options", "nosniff");
      headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
      headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
      headers.set("X-Frame-Options", "DENY");
      const ramenPage = url.pathname === "/ramen" || url.pathname.startsWith("/ramen/");
      headers.set("Content-Security-Policy", [
        "default-src 'self'",
        "base-uri 'self'",
        "object-src 'none'",
        "frame-ancestors 'none'",
        "form-action 'self'",
        "script-src 'self'" + (ramenPage ? " 'unsafe-inline'" : "") + " https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/",
        "frame-src https://www.google.com/recaptcha/ https://recaptcha.google.com/recaptcha/",
        "connect-src 'self' https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: https: https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/"
      ].join("; "));
      return new Response(response.body, { status: response.status, headers });
    }
    if (request.method !== "GET" && request.method !== "POST") return json({ error: "Method not allowed" }, 405);
    let forwarded = request;
    if (url.pathname.startsWith("/api/admin/")) {
      // Reject untrusted client headers. Only this Worker adds this internal assertion.
      if (!await verifyAccess(request, env)) return noStore(json({ error: "Cloudflare Access認証が必要です。" }, 401));
      const headers = new Headers(request.headers);
      headers.delete("X-Internal-Board-Admin");
      headers.set("X-Internal-Board-Admin", "verified");
      forwarded = new Request(request, { headers });
      if (request.method === "POST" && request.headers.get("Origin") !== url.origin)
        return noStore(json({ error: "Invalid Origin" }, 403));
      if (url.pathname === "/api/admin/content") return noStore(await contentApi(request, env, url));
    }
    const id = env.SITE_STATE.idFromName("site-state");
    const response = await env.SITE_STATE.get(id).fetch(forwarded);
    return noStore(response);
  },
};

export class SiteState extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS site_counter (id INTEGER PRIMARY KEY, value INTEGER NOT NULL);`);
    ctx.storage.sql.exec(`INSERT OR IGNORE INTO site_counter (id, value) VALUES (1, 0);`);
    ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS board_posts (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, message TEXT NOT NULL, created_at TEXT NOT NULL);`);
    ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS rate_events (subject TEXT NOT NULL, kind TEXT NOT NULL, created_ms INTEGER NOT NULL);`);
    ctx.storage.sql.exec(`CREATE INDEX IF NOT EXISTS rate_events_lookup ON rate_events(subject, kind, created_ms);`);
    // Idempotent migrations for moderation and post connection metadata.
    const columns = ctx.storage.sql.exec(`PRAGMA table_info(board_posts)`).toArray().map(c => c.name);
    if (!columns.includes("hidden")) ctx.storage.sql.exec(`ALTER TABLE board_posts ADD COLUMN hidden INTEGER NOT NULL DEFAULT 0`);
    for (const [name, type] of [["ip_address", "TEXT"], ["request_metadata", "TEXT"]]) {
      if (!columns.includes(name)) ctx.storage.sql.exec(`ALTER TABLE board_posts ADD COLUMN ${name} ${type}`);
    }
  }

  async limited(request, kind, maxCount, windowMs, minGapMs = 0) {
    const key = await clientKey(request, this.env);
    const now = Date.now();
    const cutoff = now - windowMs;
    // A single Durable Object serializes synchronous SQL operations.
    const last = this.ctx.storage.sql.exec(
      `SELECT MAX(created_ms) AS value FROM rate_events WHERE subject = ? AND kind = ?`, key, kind
    ).one().value;
    const count = this.ctx.storage.sql.exec(
      `SELECT COUNT(*) AS value FROM rate_events WHERE subject = ? AND kind = ? AND created_ms > ?`,
      key, kind, cutoff
    ).one().value;
    if (count >= maxCount || (last !== null && now - last < minGapMs)) return true;
    this.ctx.storage.sql.exec(
      `INSERT INTO rate_events (subject, kind, created_ms) VALUES (?, ?, ?)`, key, kind, now
    );
    // Opportunistic cleanup keeps the table bounded for inactive clients.
    if (Math.random() < 0.02) this.ctx.storage.sql.exec(
      `DELETE FROM rate_events WHERE created_ms < ?`, now - DAY_MS
    );
    return false;
  }

  async authenticated(request) {
    const supplied = request.headers.get("Authorization") || "";
    return request.headers.get("X-Internal-Board-Admin") === "verified" || (supplied.startsWith("Bearer ") &&
      await sameSecret(supplied.slice(7), this.env.BOARD_ADMIN_TOKEN));
  }

  snapshot() {
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      posts: this.ctx.storage.sql.exec(
        `SELECT id, name, message, created_at AS createdAt, hidden, ip_address AS ipAddress,
          request_metadata AS requestMetadata FROM board_posts ORDER BY id`
      ).toArray()
    };
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/admin/")) {
      if (!await this.authenticated(request)) return json({ error: "Unauthorized" }, 401);
      if (request.method === "GET" && url.pathname === "/api/admin/board")
        return json({ posts: this.snapshot().posts });
      if (request.method === "GET" && url.pathname === "/api/admin/backup")
        return json(this.snapshot());
      if (request.method === "POST" && url.pathname === "/api/admin/board") {
        let data;
        try { data = await request.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
        if (!Number.isSafeInteger(data?.id) || data.id < 1 ||
          !["hide", "show", "delete"].includes(data?.action))
          return json({ error: "Invalid action or id" }, 400);
        // "delete" means reversible soft-delete, never SQL DELETE.
        const result = this.ctx.storage.sql.exec(
          `UPDATE board_posts SET hidden = ? WHERE id = ? RETURNING id`,
          data.action === "show" ? 0 : 1, data.id
        ).toArray();
        return result.length ? json({ ok: true }) : json({ error: "Not found" }, 404);
      }
      if (request.method === "POST" && url.pathname === "/api/admin/restore") {
        // Non-destructive import: do not overwrite current posts.
        if (Number(request.headers.get("Content-Length") || 0) > 2_000_000)
          return json({ error: "Backup too large" }, 413);
        let data;
        try {
          const raw = await request.text();
          if (encoder.encode(raw).length > 2_000_000) return json({ error: "Backup too large" }, 413);
          data = JSON.parse(raw);
        } catch { return json({ error: "Invalid backup" }, 400); }
        if (data?.version !== 1 || !Array.isArray(data.posts) || data.posts.length > 10000 ||
          !data.posts.every(p => Number.isSafeInteger(p.id) && p.id > 0 &&
            typeof p.name === "string" && p.name.length <= 40 &&
            typeof p.message === "string" && p.message.length <= 500 &&
            typeof p.createdAt === "string" && p.createdAt.length <= 40 &&
            (p.hidden === 0 || p.hidden === 1) &&
            (p.ipAddress == null || typeof p.ipAddress === "string") &&
            (p.requestMetadata == null || typeof p.requestMetadata === "string" && p.requestMetadata.length <= 4096)))
          return json({ error: "Invalid backup schema" }, 400);
        let restored = 0;
        this.ctx.storage.transactionSync(() => {
          for (const p of data.posts) {
            const result = this.ctx.storage.sql.exec(
              `INSERT OR IGNORE INTO board_posts (id, name, message, created_at, hidden, ip_address, request_metadata)
                VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`,
              p.id, p.name, p.message, p.createdAt, p.hidden,
              p.ipAddress ?? null, p.requestMetadata ?? null
            ).toArray();
            restored += result.length;
          }
        });
        return json({ ok: true, restored });
      }
      return json({ error: "Not found" }, 404);
    }
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
    if (url.pathname === "/api/counter" && request.method === "GET") {
      const row = this.ctx.storage.sql.exec(`SELECT value FROM site_counter WHERE id = 1`).one();
      return json({ count: row.value });
    }
    if (url.pathname === "/api/counter" && request.method === "POST") {
      try {
        if (await this.limited(request, "counter", 1, DAY_MS)) {
          const row = this.ctx.storage.sql.exec(`SELECT value FROM site_counter WHERE id = 1`).one();
          return json({ count: row.value, counted: false });
        }
      } catch { return json({ error: "Rate limit not configured" }, 503); }
      const row = this.ctx.storage.sql.exec(`UPDATE site_counter SET value = value + 1 WHERE id = 1 RETURNING value`).one();
      return json({ count: row.value, kiriban: row.value % 1000 === 0 });
    }
    if (url.pathname === "/api/board" && request.method === "GET") {
      const posts = this.ctx.storage.sql.exec(`SELECT name, message, created_at AS createdAt FROM board_posts WHERE hidden = 0 ORDER BY id DESC LIMIT 50`).toArray();
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
      const name = (typeof body.name === "string" ? body.name.trim() : "") || "名無しさん";
      const message = typeof body.message === "string" ? body.message.trim() : "";
      if (name.length > 40 || !message || message.length > 500) return json({ error: "名前は40文字以内、本文は1〜500文字で入力してください。" }, 400);
      const captchaError = await verifyRecaptcha(body.token, "board_post", request, this.env);
      if (captchaError) return captchaError;
      try {
        if (await this.limited(request, "board", 5, LIMIT_WINDOW_MS, 30_000))
          return json({ error: "投稿頻度が高すぎます。時間をおいてください。" }, 429);
      } catch { return json({ error: "Rate limit not configured" }, 503); }
      const cf = request.cf || {};
      const clientInfo = body.screenInfo && typeof body.screenInfo === "object" && !Array.isArray(body.screenInfo) ? body.screenInfo : {};
      const validDimension = value => Number.isSafeInteger(value) && value > 0 && value <= 32768 ? value : null;
      const metadata = {
        country: cf.country || null,
        region: cf.region || null,
        city: cf.city || null,
        asn: Number.isSafeInteger(cf.asn) ? cf.asn : null,
        asOrganization: cf.asOrganization || null,
        cfRay: request.headers.get("CF-Ray")?.slice(0, 128) || null,
        userAgent: request.headers.get("User-Agent")?.slice(0, 512) || null,
        clientHints: {
          brands: request.headers.get("Sec-CH-UA")?.slice(0, 512) || null,
          platform: request.headers.get("Sec-CH-UA-Platform")?.slice(0, 128) || null,
          mobile: request.headers.get("Sec-CH-UA-Mobile")?.slice(0, 16) || null,
        },
        acceptLanguage: request.headers.get("Accept-Language")?.slice(0, 256) || null,
        screenWidth: validDimension(clientInfo.screenWidth),
        screenHeight: validDimension(clientInfo.screenHeight),
        viewportWidth: validDimension(clientInfo.viewportWidth),
        viewportHeight: validDimension(clientInfo.viewportHeight),
        devicePixelRatio: Number.isFinite(clientInfo.devicePixelRatio) && clientInfo.devicePixelRatio > 0 && clientInfo.devicePixelRatio <= 10 ? clientInfo.devicePixelRatio : null,
        timezone: typeof clientInfo.timezone === "string" ? clientInfo.timezone.slice(0, 100) : null,
      };
      this.ctx.storage.sql.exec(
        `INSERT INTO board_posts (name, message, created_at, ip_address, request_metadata)
          VALUES (?, ?, ?, ?, ?)`,
        name, message, new Date().toISOString(), request.headers.get("CF-Connecting-IP"),
        JSON.stringify(metadata)
      );
      return json({ ok: true }, 201);
    }
    return json({ error: "Not found" }, 404);
  }
}

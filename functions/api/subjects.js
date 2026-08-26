const SUBJECT_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=UTF-8", "cache-control": "no-store" }
  });
}

function makeSlug(name) {
  return name.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

async function hashToken(token) {
  if (!token) return null;
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(token));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function parseCookies(cookieHeader) {
  const map = Object.create(null);
  if (!cookieHeader) return map;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    map[k] = v;
  }
  return map;
}

async function verifyAdminSession(context) {
  const expected = context.env.ADMIN_TOKEN;
  if (!expected) return false;
  const cookieHeader = context.request.headers.get('cookie') || '';
  const cookies = parseCookies(cookieHeader);
  const adminCookie = cookies.admin || '';
  if (!adminCookie) return false;
  const expectedHash = await hashToken(expected);
  return adminCookie === expectedHash;
}

export async function onRequestGet(context) {
  const sem = Number(new URL(context.request.url).searchParams.get("semester") || 1);
  if (!Number.isInteger(sem) || sem < 1 || sem > 8) return json({ error: "Invalid semester", subjects: [] }, 400);
  if (!context.env.DB) return json({ error: "D1 database is not configured", subjects: [] }, 503);
  try {
    const result = await context.env.DB.prepare(
      `SELECT slug, semester, name, description, created_at FROM subjects WHERE semester = ? ORDER BY created_at ASC, name COLLATE NOCASE`
    ).bind(sem).all();
    return json({ subjects: result.results || [] });
  } catch (error) {
    return json({ error: "Unable to load subjects", subjects: [] }, 500);
  }
}

export async function onRequestPost(context) {
  const expected = context.env.ADMIN_TOKEN;
  const supplied = context.request.headers.get("X-Admin-Token") || "";
  const hasSession = await verifyAdminSession(context);
  if (!expected || (supplied !== expected && !hasSession)) return json({ error: "Unauthorized" }, 401);
  if (!context.env.DB) return json({ error: "D1 database is not configured yet" }, 503);
  let body;
  try { body = await context.request.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  const semester = Number(body?.semester);
  const name = String(body?.name || "").trim();
  const description = String(body?.description || "").trim();
  const slug = String(body?.slug || makeSlug(name)).trim().toLowerCase();
  if (!name || !Number.isInteger(semester) || semester < 1 || semester > 8 || !SUBJECT_SLUG.test(slug)) {
    return json({ error: "Invalid subject. Required: name and semester 1-8." }, 400);
  }
  try {
    await context.env.DB.prepare(
      `INSERT INTO subjects (slug, semester, name, description) VALUES (?, ?, ?, ?)`
    ).bind(slug, semester, name, description).run();
  } catch {
    return json({ error: "Subject already exists in this semester." }, 409);
  }
  return json({ ok: true, subject: { slug, semester, name, description } }, 201);
}

export async function onRequestDelete(context) {
  // DELETE /api/subjects/:slug
  if (!await verifyAdminSession(context)) return json({ error: "Unauthorized" }, 401);
  if (!context.env.DB) return json({ error: "D1 database is not configured yet" }, 503);
  const url = new URL(context.request.url);
  const parts = url.pathname.split('/').filter(Boolean);
  const slug = parts.length >= 2 ? parts[parts.length - 1] : null;
  if (!slug || !SUBJECT_SLUG.test(slug)) return json({ error: "Invalid subject slug" }, 400);
  try {
    const res = await context.env.DB.prepare(`DELETE FROM subjects WHERE slug = ?`).bind(slug).run();
    return json({ ok: true });
  } catch (e) {
    return json({ error: "Unable to delete subject" }, 500);
  }
}

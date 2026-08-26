const CATEGORIES = new Set(["notes", "tutorials", "practicals", "project", "pyqs"]);
const SUBJECT_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=UTF-8",
      "cache-control": "no-store"
    }
  });
}

function validResource(body) {
  return body
    && typeof body.name === "string" && body.name.trim()
    && typeof body.url === "string" && /^https?:\/\//i.test(body.url)
    && Number.isInteger(Number(body.semester)) && Number(body.semester) >= 1 && Number(body.semester) <= 8
    && typeof body.subject === "string" && /^[a-z0-9-]+$/.test(body.subject)
    && CATEGORIES.has(body.category);
}

/* --- Admin session helpers (server-side only) --- */
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

/* --- Handlers --- */
export async function onRequestGet(context) {
  const db = context.env.DB;
  if (db) {
    try {
      const result = await db.prepare(
        `SELECT id, name, url, semester, subject, category, created_at
         FROM resources ORDER BY created_at DESC, name COLLATE NOCASE`
      ).all();
      return json({ resources: result.results || [] });
    } catch (error) {
      // During initial setup, fall back to the checked-in seed file.
    }
  }

  return json({ error: "D1 database is not configured", resources: [] }, 503);
}

export async function onRequestPost(context) {
  // Require admin session cookie created by POST /api/admin. We do NOT accept raw tokens from frontend anymore.
  if (!await verifyAdminSession(context)) return json({ error: "Unauthorized" }, 401);
  if (!context.env.DB) return json({ error: "D1 database is not configured yet" }, 503);

  let body;
  try { body = await context.request.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  if (!validResource(body)) {
    return json({ error: "Invalid resource. Required: name, https URL, semester 1-8, subject slug, category." }, 400);
  }

  const id = `${Number(body.semester)}-${body.subject}-${crypto.randomUUID()}`;
  await context.env.DB.prepare(
    `INSERT INTO resources (id, name, url, semester, subject, category)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(id, body.name.trim(), body.url.trim(), Number(body.semester), body.subject, body.category).run();

  return json({ ok: true, resource: { id, ...body, semester: Number(body.semester) } }, 201);
}

export async function onRequestDelete(context) {
  // DELETE /api/resources/:id requires admin session cookie
  if (!await verifyAdminSession(context)) return json({ error: "Unauthorized" }, 401);
  if (!context.env.DB) return json({ error: "D1 database is not configured yet" }, 503);
  const url = new URL(context.request.url);
  const parts = url.pathname.split('/').filter(Boolean);
  const id = parts.length >= 2 ? parts[parts.length - 1] : null;
  if (!id) return json({ error: "Invalid resource id" }, 400);
  try {
    await context.env.DB.prepare(`DELETE FROM resources WHERE id = ?`).bind(id).run();
    return json({ ok: true });
  } catch (e) {
    return json({ error: "Unable to delete resource" }, 500);
  }
}

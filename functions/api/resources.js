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
  const expected = context.env.ADMIN_TOKEN;
  const supplied = context.request.headers.get("X-Admin-Token") || "";
  if (!expected || supplied !== expected) return json({ error: "Unauthorized" }, 401);
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

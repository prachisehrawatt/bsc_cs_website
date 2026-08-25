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
  if (!expected || supplied !== expected) return json({ error: "Unauthorized" }, 401);
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

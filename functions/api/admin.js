function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=UTF-8", "cache-control": "no-store" }
  });
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

export async function onRequestPost(context) {
  // Accept JSON body { token } or X-Admin-Token header for compatibility
  let supplied = '';
  try {
    const body = await context.request.json().catch(() => null);
    if (body && typeof body.token === 'string') supplied = body.token;
  } catch (_) {}
  if (!supplied) supplied = context.request.headers.get('X-Admin-Token') || '';

  const expected = context.env.ADMIN_TOKEN;
  if (!expected || supplied !== expected) return json({ error: 'Unauthorized' }, 401);

  // Create a hashed session cookie so we don't store the raw token anywhere
  const hash = await hashToken(expected);
  const maxAge = 60 * 60 * 24; // 1 day
  const cookie = `admin=${hash}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json; charset=UTF-8', 'set-cookie': cookie } });
}

export async function onRequestGet(context) {
  // Return whether the session is authenticated or not (safe to call from frontend)
  const cookieHeader = context.request.headers.get('cookie') || '';
  const cookies = parseCookies(cookieHeader);
  const adminCookie = cookies.admin || '';
  const expected = context.env.ADMIN_TOKEN;
  if (!expected) return json({ authenticated: false });
  const expectedHash = await hashToken(expected);
  return json({ authenticated: Boolean(adminCookie && adminCookie === expectedHash) });
}

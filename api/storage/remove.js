import { createClient } from '@supabase/supabase-js';

function json(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

function getEnv(name) {
  return (process.env[name] ?? '').toString().trim();
}

function getBearerToken(req) {
  const auth = (req.headers.authorization ?? '').toString();
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
}

async function requireAdmin(req) {
  const url = getEnv('SUPABASE_URL');
  const anonKey = getEnv('SUPABASE_ANON_KEY');
  const token = getBearerToken(req);

  if (!url || !anonKey) {
    return { ok: false, status: 500, message: 'Missing SUPABASE_URL or SUPABASE_ANON_KEY.' };
  }
  if (!token) {
    return { ok: false, status: 401, message: 'Missing Authorization Bearer token.' };
  }

  const authed = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } }
  });

  const { data, error } = await authed.auth.getUser();
  if (error) {
    return { ok: false, status: 401, message: error.message || 'Invalid token.' };
  }

  const role = (data?.user?.user_metadata?.role ?? '').toString();
  if (role !== 'admin') {
    return { ok: false, status: 403, message: 'Forbidden: admin role required.' };
  }

  return { ok: true };
}

function getAdminClient() {
  const url = getEnv('SUPABASE_URL');
  const serviceRole = getEnv('SUPABASE_SERVICE_ROLE_KEY');

  if (!url || !serviceRole) {
    return { ok: false, status: 500, message: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.' };
  }

  const supabaseAdmin = createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });

  return { ok: true, supabaseAdmin };
}

function parseStorageUrl(u) {
  if (!u) return null;
  try {
    const s = String(u);
    let m = s.match(/\/storage\/v1\/object\/public\/(.*?)\/(.*)$/);
    if (m) return { bucket: m[1], path: decodeURIComponent(m[2]) };
    m = s.match(/object\/public\/(.*?)\/(.*)$/);
    if (m) return { bucket: m[1], path: decodeURIComponent(m[2]) };
    const idx = s.indexOf('poi-images/');
    if (idx !== -1) return { bucket: 'poi-images', path: s.substring(idx + 'poi-images/'.length).split('?')[0] };
    return null;
  } catch (e) { return null; }
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return json(res, 405, { error: 'Method Not Allowed' });
    }

    const admin = await requireAdmin(req);
    if (!admin.ok) return json(res, admin.status, { error: admin.message });

    const adminClient = getAdminClient();
    if (!adminClient.ok) return json(res, adminClient.status, { error: adminClient.message });

    const { supabaseAdmin } = adminClient;
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const url = (body?.url ?? '').toString();
    if (!url) return json(res, 400, { error: 'Missing url' });

    const parsed = parseStorageUrl(url);
    if (!parsed || !parsed.bucket || !parsed.path) return json(res, 400, { error: 'Cannot parse storage url' });

    const { error: remErr } = await supabaseAdmin.storage.from(parsed.bucket).remove([parsed.path]);
    if (remErr) return json(res, 500, { error: remErr.message ?? remErr });

    return json(res, 200, { ok: true });
  } catch (err) {
    return json(res, 500, { error: (err?.message ?? 'Server error').toString() });
  }
}

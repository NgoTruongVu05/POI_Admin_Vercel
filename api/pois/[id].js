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

async function readJsonBody(req) {
  try {
    if (req.body && typeof req.body === 'object') return req.body;
    if (typeof req.body === 'string' && req.body.trim() !== '') return JSON.parse(req.body);

    const raw = await new Promise((resolve, reject) => {
      let data = '';
      req.on('data', chunk => { data += chunk; });
      req.on('end', () => resolve(data));
      req.on('error', reject);
    });

    if (!raw || !raw.toString().trim()) return {};
    return JSON.parse(raw.toString());
  } catch {
    return {};
  }
}

function parsePriority(value) {
  const raw = (value ?? '').toString().trim();
  if (!/^\d+$/.test(raw)) return { ok: false, message: 'Priority must be an integer (digits only).' };
  const n = Number(raw);
  if (!Number.isInteger(n)) return { ok: false, message: 'Priority must be an integer.' };
  if (n < 0 || n > 20) return { ok: false, message: 'Priority must be between 0 and 20.' };
  return { ok: true, priority: n };
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
    console.log('[DELETE POI] Request:', { method: req.method, url: req.url, query: req.query, path: req.query?.id });

    if (req.method !== 'DELETE' && req.method !== 'PATCH') {
      res.setHeader('Allow', 'DELETE, PATCH');
      return json(res, 405, { error: 'Method Not Allowed' });
    }

    const id = (req.query?.id ?? '').toString();
    if (!id) return json(res, 400, { error: 'Missing id.' });

    // PATCH: admin-only update priority
    if (req.method === 'PATCH') {
      const admin = await requireAdmin(req);
      if (!admin.ok) return json(res, admin.status, { error: admin.message });

      const body = await readJsonBody(req);
      const parsed = parsePriority(body?.priority);
      if (!parsed.ok) return json(res, 400, { error: parsed.message });

      const adminClient = getAdminClient();
      if (!adminClient.ok) return json(res, adminClient.status, { error: adminClient.message });
      const { supabaseAdmin } = adminClient;

      const upd = await supabaseAdmin
        .from('pois')
        .update({ priority: parsed.priority })
        .eq('id', id)
        .select('id,priority')
        .maybeSingle();

      if (upd.error) return json(res, 500, { error: upd.error.message });
      if (!upd.data) return json(res, 404, { error: 'POI not found.' });
      return json(res, 200, { ok: true, data: upd.data });
    }

    // Authenticate user (admin or manager). Managers may delete only their own POIs.
    const url = getEnv('SUPABASE_URL');
    const anonKey = getEnv('SUPABASE_ANON_KEY');
    const token = getBearerToken(req);
    if (!url || !anonKey) return json(res, 500, { error: 'Missing SUPABASE_URL or SUPABASE_ANON_KEY.' });
    if (!token) return json(res, 401, { error: 'Missing Authorization Bearer token.' });

    const authed = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    const { data: userData, error: userErr } = await authed.auth.getUser();
    if (userErr) return json(res, 401, { error: userErr.message || 'Invalid token.' });
    const authedUserId = (userData?.user?.id ?? '').toString();
    const role = (userData?.user?.user_metadata?.role ?? '').toString();

    const adminClient = getAdminClient();
    if (!adminClient.ok) return json(res, adminClient.status, { error: adminClient.message });
    const { supabaseAdmin } = adminClient;

    console.log('[DELETE POI] Extracted id:', id, 'Role:', role);

    if (role === 'manager') {
      // ensure the manager owns this POI
      const pcheck = await supabaseAdmin.from('pois').select('user_id').eq('id', id).limit(1).single();
      if (pcheck.error) return json(res, 404, { error: 'POI not found.' });
      const ownerId = (pcheck.data?.user_id ?? '').toString();
      if (ownerId !== authedUserId) return json(res, 403, { error: 'Forbidden: not owner of POI.' });
    }

    // NOTE: Previously the server removed the POI's stored image when deleting the POI.
    // Per new requirement, stored images should not be deleted automatically here — keep them intact.

    // delete translations
    await supabaseAdmin.from('poitranslations').delete().eq('poi_id', id);
    // delete poi
    const del = await supabaseAdmin.from('pois').delete().eq('id', id);
    if (del.error) return json(res, 500, { error: del.error.message });

    return json(res, 200, { ok: true });
  } catch (err) {
    return json(res, 500, { error: (err?.message ?? 'Server error').toString() });
  }
}

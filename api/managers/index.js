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

  return { ok: true, url, token };
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

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET' && req.method !== 'POST') {
      res.setHeader('Allow', 'GET, POST');
      return json(res, 405, { error: 'Method Not Allowed' });
    }

    const admin = await requireAdmin(req);
    if (!admin.ok) return json(res, admin.status, { error: admin.message });

    const adminClient = getAdminClient();
    if (!adminClient.ok) return json(res, adminClient.status, { error: adminClient.message });

    const { supabaseAdmin } = adminClient;

    if (req.method === 'GET') {
      const { data, error } = await supabaseAdmin
        .from('user_roles')
        .select('user_id,email,role,created_at,updated_at')
        .order('created_at', { ascending: false });

      if (error) return json(res, 400, { error: error.message });
      return json(res, 200, { data: data ?? [] });
    }

    // POST: create manager
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const email = (body.email ?? '').toString().trim();
    const password = (body.password ?? '').toString();
    const role = (body.role ?? 'manager').toString();

    if (!email || !password) return json(res, 400, { error: 'Email and password are required.' });
    if (password.length < 6) return json(res, 400, { error: 'Password must be at least 6 characters.' });
    if (!['admin', 'manager'].includes(role)) return json(res, 400, { error: 'Invalid role.' });

    const createRes = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role }
    });

    if (createRes.error) return json(res, 400, { error: createRes.error.message });

    const userId = createRes.data?.user?.id;
    if (!userId) return json(res, 500, { error: 'User created but missing id.' });

    const upsertRes = await supabaseAdmin
      .from('user_roles')
      .upsert({ user_id: userId, email, role }, { onConflict: 'user_id' })
      .select('user_id,email,role,created_at,updated_at')
      .single();

    if (upsertRes.error) return json(res, 400, { error: upsertRes.error.message });

    return json(res, 201, { data: upsertRes.data });
  } catch (err) {
    return json(res, 500, { error: (err?.message ?? 'Server error').toString() });
  }
}

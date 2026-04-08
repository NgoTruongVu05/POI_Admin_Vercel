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

      // Resolve auth user id by email when possible to provide a safe id
      // that can be used with auth.admin.deleteUser. This helps when
      // user_roles.user_id contains provider subjects like "sin1::...".
      const rows = Array.isArray(data) ? data : [];
      console.log('[managers][GET] fetched %d user_roles rows', rows.length);
      const enhanced = [];
      for (const row of rows) {
        const email = (row?.email ?? '').toString();
        let auth_id = null;
        if (email) {
          try {
            console.log('[managers][GET] resolving auth id for email=%s', email);
            const { data: found, error: findErr } = await supabaseAdmin
              .from('auth.users')
              .select('id')
              .eq('email', email)
              .limit(1);
            if (findErr) {
              console.warn('[managers][GET] auth.users lookup error for email=%s: %o', email, findErr);
            } else if (Array.isArray(found) && found.length) {
              auth_id = found[0].id;
              console.log('[managers][GET] resolved auth id for email=%s -> %s', email, auth_id);
            } else {
              console.log('[managers][GET] no auth user found for email=%s', email);
            }
          } catch (e) {
            console.warn('[managers][GET] exception resolving auth id for email=%s: %o', email, e);
          }
        }
        enhanced.push(Object.assign({}, row, { auth_id }));
      }

      return json(res, 200, { data: enhanced });
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

    if (createRes.error || (createRes?.status && createRes.status >= 400)) {
      console.error('supabase.createUser response:', createRes);
      const msg = createRes.error?.message ?? createRes?.statusText ?? '';

      // If email already exists, try to find the user and update metadata + user_roles
      if (createRes.error?.code === 'email_exists' || /already been registered/i.test(msg) || createRes.status === 422) {
        try {
          const { data: found, error: findErr } = await supabaseAdmin
            .from('auth.users')
            .select('id,email')
            .eq('email', email)
            .limit(1);

          if (findErr) {
            console.error('find existing user error:', findErr);
            return json(res, 400, { error: msg || 'Email already exists' });
          }

          const existing = Array.isArray(found) && found.length ? found[0] : null;
          if (!existing) {
            return json(res, 400, { error: msg || 'Email already exists' });
          }

          // Update user metadata role
          const upd = await supabaseAdmin.auth.admin.updateUserById(existing.id, {
            user_metadata: { role }
          });
          if (upd.error) {
            console.error('update existing user metadata error:', upd);
            return json(res, 400, { error: upd.error.message ?? 'Cannot update existing user metadata' });
          }

          // Upsert into user_roles
          const upsertRes2 = await supabaseAdmin
            .from('user_roles')
            .upsert({ user_id: existing.id, email, role }, { onConflict: 'user_id' })
            .select('user_id,email,role,created_at,updated_at')
            .single();

          if (upsertRes2.error || (upsertRes2?.status && upsertRes2.status >= 400)) {
            console.error('supabase.upsert response (existing user):', upsertRes2);
            return json(res, 400, { error: upsertRes2.error?.message ?? 'Cannot upsert user_roles' });
          }

          return json(res, 200, { data: upsertRes2.data, notice: 'Existing user updated with new role' });
        } catch (e) {
          console.error('handle existing email exception:', e);
          return json(res, 500, { error: (e?.message ?? 'Server error').toString() });
        }
      }

      const errObj = {
        message: msg || 'Unknown error',
        details: createRes
      };
      return json(res, 400, { error: JSON.stringify(errObj) });
    }

    const userId = createRes.data?.user?.id;
    if (!userId) return json(res, 500, { error: 'User created but missing id.' });

    const upsertRes = await supabaseAdmin
      .from('user_roles')
      .upsert({ user_id: userId, email, role }, { onConflict: 'user_id' })
      .select('user_id,email,role,created_at,updated_at')
      .single();

    if (upsertRes.error || (upsertRes?.status && upsertRes.status >= 400)) {
      console.error('supabase.upsert response:', upsertRes);
      const errObj = {
        message: upsertRes.error?.message ?? upsertRes?.statusText ?? 'Unknown error',
        details: upsertRes
      };
      return json(res, 400, { error: JSON.stringify(errObj) });
    }

    return json(res, 201, { data: upsertRes.data });
  } catch (err) {
    return json(res, 500, { error: (err?.message ?? 'Server error').toString() });
  }
}

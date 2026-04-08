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

export default async function handler(req, res) {
  try {
    if (req.method !== 'PATCH' && req.method !== 'DELETE') {
      res.setHeader('Allow', 'PATCH, DELETE');
      return json(res, 405, { error: 'Method Not Allowed' });
    }

    const admin = await requireAdmin(req);
    if (!admin.ok) return json(res, admin.status, { error: admin.message });

    const adminClient = getAdminClient();
    if (!adminClient.ok) return json(res, adminClient.status, { error: adminClient.message });

    const { supabaseAdmin } = adminClient;
    const userId = (req.query?.id ?? '').toString();
    if (!userId) return json(res, 400, { error: 'Missing id.' });

    if (req.method === 'PATCH') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const role = (body.role ?? '').toString();
      if (!['admin', 'manager'].includes(role)) return json(res, 400, { error: 'Invalid role.' });

      const upd = await supabaseAdmin.auth.admin.updateUserById(userId, {
        user_metadata: { role }
      });
      if (upd.error) return json(res, 400, { error: upd.error.message });

      const upsert = await supabaseAdmin
        .from('user_roles')
        .upsert({ user_id: userId, email: (upd.data?.user?.email ?? '').toString(), role }, { onConflict: 'user_id' })
        .select('user_id,email,role,created_at,updated_at')
        .single();

      if (upsert.error) return json(res, 400, { error: upsert.error.message });
      return json(res, 200, { data: upsert.data });
    }

    // DELETE
    // Attempt to delete the auth user by the provided id. Some rows in `user_roles`
    // may contain non-auth identifiers (e.g. provider subject) which will cause
    // deleteUser to return NOT_FOUND. In that case try to resolve by email and
    // ensure the `user_roles` row is removed.
    let del = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (del.error) {
      // If user not found, try to resolve a real auth id via the user_roles email
      const roleRow = await supabaseAdmin.from('user_roles').select('email').eq('user_id', userId).limit(1).maybeSingle();
      const email = roleRow?.data?.email ?? '';

      // If we have an email, try to find auth user by email and delete by that id
      if (email) {
        const { data: found, error: findErr } = await supabaseAdmin
          .from('auth.users')
          .select('id')
          .eq('email', email)
          .limit(1);

        if (!findErr && Array.isArray(found) && found.length) {
          const realId = found[0].id;
          // If the id is different, try deleting that one
          if (realId && realId !== userId) {
            const del2 = await supabaseAdmin.auth.admin.deleteUser(realId);
            if (!del2.error) {
              // ensure cleanup of user_roles
              await supabaseAdmin.from('user_roles').delete().eq('user_id', userId);
              await supabaseAdmin.from('user_roles').delete().eq('user_id', realId);
              return json(res, 200, { ok: true, notice: 'Deleted by resolved auth id' });
            }
            // if del2.error, fall through to attempt cleanup of user_roles
          }
        }
      }

      // If we reach here the auth user could not be deleted (likely NOT_FOUND).
      // Remove the user_roles row to keep the list consistent and return success
      await supabaseAdmin.from('user_roles').delete().eq('user_id', userId);
      return json(res, 200, { ok: true, notice: 'Auth user not found; removed user_roles row' });
    }

    // user_roles row will be deleted by FK cascade; but ensure cleanup if not.
    await supabaseAdmin.from('user_roles').delete().eq('user_id', userId);

    return json(res, 200, { ok: true });
  } catch (err) {
    return json(res, 500, { error: (err?.message ?? 'Server error').toString() });
  }
}

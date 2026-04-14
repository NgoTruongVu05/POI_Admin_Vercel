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

function getAdminClient() {
  const url = getEnv('SUPABASE_URL');
  const serviceRole = getEnv('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceRole) {
    return { ok: false, status: 500, message: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.' };
  }

  return {
    ok: true,
    supabaseAdmin: createClient(url, serviceRole, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
    })
  };
}

async function getAuthedUser(req) {
  const url = getEnv('SUPABASE_URL');
  const anonKey = getEnv('SUPABASE_ANON_KEY');
  const token = getBearerToken(req);

  if (!url || !anonKey || !token) return { ok: false };

  const authed = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } }
  });

  const { data, error } = await authed.auth.getUser();
  if (error) return { ok: false };

  return {
    ok: true,
    user: data?.user ?? null,
    token
  };
}

function buildActor(user, bodyActor) {
  if (bodyActor) {
    const normalized = bodyActor.toLowerCase();
    if (normalized === 'admin' || normalized === 'manager' || normalized === 'tourist') return normalized;
  }
  const role = (user?.user_metadata?.role ?? '').toString();
  if (role === 'admin' || role === 'manager') return role;
  return 'tourist';
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET' && req.method !== 'POST') {
      res.setHeader('Allow', 'GET, POST');
      return json(res, 405, { error: 'Method Not Allowed' });
    }

    const adminClient = getAdminClient();
    if (!adminClient.ok) return json(res, adminClient.status, { error: adminClient.message });
    const { supabaseAdmin } = adminClient;

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const rawDeviceId = (body.device_id ?? '').toString().trim();
      const rawApp = (body.app ?? 'poi-mobile').toString().trim();
      const rawPlatform = (body.platform ?? '').toString().trim();
      const bodyActor = (body.actor ?? '').toString().trim();

      const authed = await getAuthedUser(req);
      const userId = (authed?.user?.id ?? '').toString();
      const clientId = userId ? `auth:${userId}` : (rawDeviceId ? `device:${rawDeviceId}` : '');

      if (!clientId) {
        return json(res, 400, { error: 'Missing identifier. Send Authorization Bearer token or device_id.' });
      }

      const actor = buildActor(authed?.user, bodyActor);

      const upsert = await supabaseAdmin
        .from('app_heartbeats')
        .upsert({
          client_id: clientId,
          user_id: userId || null,
          actor,
          app: rawApp || 'poi-mobile',
          platform: rawPlatform || null,
          last_seen: new Date().toISOString()
        }, { onConflict: 'client_id' });

      if (upsert.error) return json(res, 500, { error: upsert.error.message });

      return json(res, 200, { ok: true, client_id: clientId, actor });
    }

    const authed = await getAuthedUser(req);
    const role = (authed?.user?.user_metadata?.role ?? '').toString();
    if (!authed.ok || (role !== 'admin' && role !== 'manager')) {
      return json(res, 403, { error: 'Forbidden' });
    }

    const windowSecondsRaw = Number(req.query?.window_seconds ?? 120);
    const windowSeconds = Number.isFinite(windowSecondsRaw) && windowSecondsRaw > 0
      ? Math.min(Math.floor(windowSecondsRaw), 3600)
      : 120;

    const cutoff = new Date(Date.now() - (windowSeconds * 1000)).toISOString();

    const countRes = await supabaseAdmin
      .from('app_heartbeats')
      .select('client_id', { count: 'exact', head: true })
      .gte('last_seen', cutoff);

    if (countRes.error) return json(res, 500, { error: countRes.error.message });

    return json(res, 200, {
      active_users: countRes.count ?? 0,
      window_seconds: windowSeconds
    });
  } catch (err) {
    return json(res, 500, { error: (err?.message ?? 'Server error').toString() });
  }
}
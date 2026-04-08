import { createClient } from '@supabase/supabase-js';

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const email = process.argv[2];

  if (!url || !key) {
    console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
    process.exit(1);
  }
  if (!email) {
    console.error('Usage: node scripts/delete-user.js user@example.com');
    process.exit(1);
  }

  const supabaseAdmin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });

  try {
    console.log('[delete-user] lookup auth user by email=%s', email);
    const { data: found, error: findErr } = await supabaseAdmin
      .schema('auth')
      .from('users')
      .select('id')
      .eq('email', email)
      .limit(1);

    if (findErr) {
      console.error('[delete-user] lookup error:', findErr);
    }

    if (Array.isArray(found) && found.length) {
      const id = found[0].id;
      console.log('[delete-user] deleting auth user id=%s', id);
      const del = await supabaseAdmin.auth.admin.deleteUser(id);
      console.log('[delete-user] deleteUser result:', del);
    } else {
      console.log('[delete-user] no auth user found for email=%s', email);
    }

    console.log('[delete-user] deleting user_roles rows for email=%s', email);
    const delRole = await supabaseAdmin.from('user_roles').delete().eq('email', email);
    console.log('[delete-user] delete user_roles result:', delRole);
  } catch (e) {
    console.error('[delete-user] exception:', e);
    process.exit(1);
  }
}

main();

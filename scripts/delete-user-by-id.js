import { createClient } from '@supabase/supabase-js';

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const id = process.argv[2];

  if (!url || !key) {
    console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
    process.exit(1);
  }
  if (!id) {
    console.error('Usage: node scripts/delete-user-by-id.js <auth_user_id>');
    process.exit(1);
  }

  const supabaseAdmin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });

  try {
    console.log('[delete-user-by-id] attempting delete auth user id=%s', id);
    const del = await supabaseAdmin.auth.admin.deleteUser(id);
    console.log('[delete-user-by-id] deleteUser result:', del);

    console.log('[delete-user-by-id] deleting user_roles rows for user_id=%s', id);
    const delRole = await supabaseAdmin.from('user_roles').delete().eq('user_id', id);
    console.log('[delete-user-by-id] delete user_roles result:', delRole);
  } catch (e) {
    console.error('[delete-user-by-id] exception:', e);
    process.exit(1);
  }
}

main();

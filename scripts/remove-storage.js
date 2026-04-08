import { createClient } from '@supabase/supabase-js';

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

async function main() {
  const urlArg = process.argv[2];
  if (!urlArg) {
    console.error('Usage: node scripts/remove-storage.js <public-url>');
    process.exitCode = 2;
    return;
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.');
    process.exitCode = 3;
    return;
  }

  const parsed = parseStorageUrl(urlArg);
  if (!parsed) {
    console.error('Cannot parse storage URL:', urlArg);
    process.exitCode = 4;
    return;
  }

  console.log('Parsed:', parsed);

  const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });

  try {
    const { data, error } = await supabaseAdmin.storage.from(parsed.bucket).remove([parsed.path]);
    if (error) {
      console.error('Supabase remove error:', error);
      process.exitCode = 5;
      return;
    }
    console.log('Removed successfully:', data);
  } catch (err) {
    console.error('Unexpected error:', err?.message ?? err);
    process.exitCode = 6;
  }
}

main();

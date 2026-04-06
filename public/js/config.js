export function getEnv() {
  return (typeof window !== 'undefined' && window.__ENV) ? window.__ENV : {};
}

export function getSupabaseConfig() {
  const env = getEnv();
  const url = (env.SUPABASE_URL ?? '').toString().trim();
  const anonKey = (env.SUPABASE_ANON_KEY ?? '').toString().trim();
  return { url, anonKey };
}

export function isConfigured() {
  const { url, anonKey } = getSupabaseConfig();
  return Boolean(url && anonKey);
}

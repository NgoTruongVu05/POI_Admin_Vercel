import { isConfigured } from './config.js';

export function renderConfigMissing() {
  document.title = 'Cấu hình Supabase | POI Admin';
  document.body.className = 'min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center p-6';
  document.body.innerHTML = `
    <div class="w-full max-w-lg">
      <div class="bg-white border border-slate-100 rounded-3xl shadow-sm p-8">
        <h1 class="text-2xl font-light tracking-tight">Chưa cấu hình Supabase</h1>
        <p class="text-sm text-slate-500 mt-1">Thiếu <span class="font-mono">SUPABASE_URL</span> hoặc <span class="font-mono">SUPABASE_ANON_KEY</span>.</p>

        <div class="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
          <div class="font-semibold">Cách khắc phục</div>
          <ol class="list-decimal pl-5 mt-2 space-y-1">
            <li>Trên Vercel: Project Settings → Environment Variables</li>
            <li>Thêm <span class="font-mono">SUPABASE_URL</span> và <span class="font-mono">SUPABASE_ANON_KEY</span></li>
            <li>Redeploy</li>
          </ol>
        </div>

        <div class="mt-6 text-sm text-slate-600">
          Local: chạy <span class="font-mono">npm run dev</span> sau khi set env vars.
        </div>
      </div>
    </div>
  `;
}

export function ensureConfigured() {
  if (!isConfigured()) {
    renderConfigMissing();
    return false;
  }
  return true;
}

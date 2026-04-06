import { ensureConfigured } from '../bootstrap.js';
import { getSupabase } from '../supabaseClient.js';
import { signInWithPassword, getSession } from '../auth.js';
import { escapeHtml } from '../ui.js';

if (!ensureConfigured()) {
  // config page already rendered
} else {
  const existing = await getSession();
  if (existing) {
    window.location.href = '/';
  } else {
    render();
  }
}

function render() {
  document.title = 'Đăng nhập | POI Admin';
  document.body.className = 'min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center p-6';
  document.body.innerHTML = `
    <div class="w-full max-w-md">
      <div class="bg-white border border-slate-100 rounded-3xl shadow-sm p-8">
        <div>
          <h1 class="text-2xl font-light tracking-tight">Đăng nhập</h1>
          <p class="text-sm text-slate-500 mt-1">POI Admin (Supabase)</p>
        </div>

        <div id="errorBox" class="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 hidden"></div>

        <form id="loginForm" class="mt-6 space-y-5">
          <div>
            <label class="block text-xs font-bold uppercase text-slate-400 mb-2 tracking-widest">Email</label>
            <div class="relative">
              <span class="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-400"><i class="bi bi-person"></i></span>
              <input id="email" type="email" required class="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white focus:outline-none transition" placeholder="admin@company.com" />
            </div>
          </div>

          <div>
            <label class="block text-xs font-bold uppercase text-slate-400 mb-2 tracking-widest">Mật khẩu</label>
            <div class="relative">
              <span class="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-400"><i class="bi bi-lock"></i></span>
              <input id="password" type="password" required class="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white focus:outline-none transition" placeholder="••••••••" />
            </div>
          </div>

          <button id="submitBtn" type="submit" class="w-full rounded-xl bg-slate-900 px-4 py-3 text-white font-semibold hover:bg-slate-800 transition">
            Đăng nhập
          </button>
        </form>
      </div>
    </div>
  `;

  const form = document.getElementById('loginForm');
  const errorBox = document.getElementById('errorBox');
  const btn = document.getElementById('submitBtn');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorBox.classList.add('hidden');
    btn.disabled = true;
    btn.classList.add('opacity-70');

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    try {
      await signInWithPassword(email, password);
      window.location.href = '/';
    } catch (err) {
      const message = (err?.message ?? 'Đăng nhập thất bại.').toString();
      errorBox.innerHTML = escapeHtml(message);
      errorBox.classList.remove('hidden');
    } finally {
      btn.disabled = false;
      btn.classList.remove('opacity-70');
    }
  });
}

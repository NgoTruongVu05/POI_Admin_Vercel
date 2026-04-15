// Doi mk: 90

import { ensureConfigured } from '../bootstrap.js';
import { requireAuth, signInWithPassword } from '../auth.js';
import { getSupabase } from '../supabaseClient.js';
import { renderLayout } from '../layout.js';
import { escapeHtml } from '../ui.js';

if (!ensureConfigured()) {
  // config page already rendered
} else {
  const session = await requireAuth();
  if (session) {
    const main = renderLayout({ activeKey: 'settings', title: 'Cài đặt | POI Admin', user: session.user });
    await render(main, session.user);
  }
}

async function render(main, user) {
  const email = (user?.email ?? '').toString();

  main.innerHTML = `
    <div class="flex items-start justify-between gap-6">
      <div>
        <h1 class="text-2xl font-semibold">Đổi mật khẩu</h1>
        <p class="text-sm text-slate-500 mt-1">Quản lý thông tin bảo mật của bạn.</p>
      </div>
    </div>

    <div class="mt-8 flex justify-center">
      <div class="w-full max-w-xl space-y-6">
        <div class="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div class="px-6 py-5 border-b border-slate-100 flex items-center gap-2">
            <i class="bi bi-shield-lock text-blue-600"></i>
            <div class="font-semibold">Đổi mật khẩu</div>
          </div>

          <div class="px-6 py-6">
            <div id="successBox" class="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 hidden"></div>
            <div id="errorBox" class="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 hidden"></div>

            <form id="pwForm" class="space-y-4">
              <div>
                <label class="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Tài khoản</label>
                <input type="text" value="${escapeHtml(email)}" readonly class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
              </div>

              <div>
                <label class="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Mật khẩu hiện tại</label>
                <input id="current" type="password" class="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition" />
              </div>

              <div>
                <label class="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Mật khẩu mới</label>
                <input id="next" type="password" class="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition" placeholder="Nhập mật khẩu mới..." />
              </div>

              <div>
                <label class="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Xác nhận mật khẩu mới</label>
                <input id="confirm" type="password" class="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition" placeholder="Nhập lại mật khẩu mới..." />
              </div>

              <button id="submitBtn" type="submit" class="inline-flex items-center gap-2 rounded-xl bg-blue-600 text-white px-5 py-3 text-sm font-semibold hover:bg-blue-700 transition">
                <i class="bi bi-check2"></i>
                <span>Cập nhật mật khẩu</span>
              </button>
            </form>
          </div>
        </div>

        <div class="bg-blue-50 border border-blue-100 rounded-2xl px-6 py-5">
          <div class="flex items-center gap-2 text-blue-800 font-semibold">
            <i class="bi bi-info-circle"></i>
            <span>Lưu ý về bảo mật</span>
          </div>
          <ul class="mt-3 text-sm text-blue-900/80 list-disc pl-5 space-y-1">
            <li>Mật khẩu nên có ít nhất 6 ký tự.</li>
            <li>Kết hợp chữ cái, số và ký tự để tăng tính bảo mật.</li>
          </ul>
        </div>
      </div>
    </div>
  `;

  const supabase = getSupabase();

  const form = document.getElementById('pwForm');
  const successBox = document.getElementById('successBox');
  const errorBox = document.getElementById('errorBox');
  const submitBtn = document.getElementById('submitBtn');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    successBox.classList.add('hidden');
    errorBox.classList.add('hidden');

    const current = document.getElementById('current').value;
    const next = document.getElementById('next').value;
    const confirm = document.getElementById('confirm').value;

    if (!current || !next || !confirm) {
      showError('Vui lòng nhập đầy đủ thông tin.');
      return;
    }
    if (next !== confirm) {
      showError('Mật khẩu mới và xác nhận mật khẩu không khớp.');
      return;
    }
    if (next.length < 6) {
      showError('Mật khẩu nên có ít nhất 6 ký tự.');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.classList.add('opacity-70');

    try {
      // Re-authenticate
      await signInWithPassword(email, current);

      const res = await supabase.auth.updateUser({ password: next });
      if (res.error) throw res.error;

      successBox.textContent = 'Cập nhật mật khẩu thành công.';
      successBox.classList.remove('hidden');

      form.reset();
    } catch (err) {
      const msg = (err?.message ?? 'Có lỗi xảy ra khi cập nhật mật khẩu.').toString();
      showError(msg);
    } finally {
      submitBtn.disabled = false;
      submitBtn.classList.remove('opacity-70');
    }
  });

  function showError(msg) {
    errorBox.textContent = msg;
    errorBox.classList.remove('hidden');
  }
}

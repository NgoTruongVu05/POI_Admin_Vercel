import { ensureConfigured } from '../bootstrap.js';
import { requireAuth, getSession } from '../auth.js';
import { renderLayout } from '../layout.js';
import { escapeHtml } from '../ui.js';

if (!ensureConfigured()) {
  // config page already rendered
} else {
  const session = await requireAuth();
  if (session) {
    const main = renderLayout({ activeKey: 'managers', title: 'Quản lý người quản lý | POI Admin', user: session.user });
    await render(main, session.user);
  }
}

async function render(main, user) {
  const role = ((user?.user_metadata?.role ?? '') || '').toString();

  main.innerHTML = `
    <div class="flex items-start justify-between gap-6">
      <div>
        <h1 class="text-2xl font-semibold">Quản lý người quản lý</h1>
        <p class="text-sm text-slate-500 mt-1">Tạo Chủ quán/Admin và phân quyền bằng role.</p>
      </div>
    </div>

    <div class="mt-6">
      <div id="notAdmin" class="rounded-2xl border border-amber-200 bg-amber-50 px-6 py-5 text-amber-900 hidden">
        <div class="font-semibold">Bạn không có quyền truy cập trang này.</div>
        <div class="text-sm mt-1">Yêu cầu role <span class="font-mono">admin</span>. Role hiện tại: <span class="font-mono">${escapeHtml(role || '—')}</span></div>
      </div>

      <div id="adminContent" class="space-y-6 hidden">
        <div class="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div class="px-6 py-5 border-b border-slate-100 flex items-center gap-2">
            <i class="bi bi-person-plus text-blue-600"></i>
            <div class="font-semibold">Tạo người quản lý</div>
          </div>

          <div class="px-6 py-6">
            <div id="successBox" class="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 hidden"></div>
            <div id="errorBox" class="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 hidden"></div>

            <form id="createForm" class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="md:col-span-1">
                <label class="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Email</label>
                <input id="email" type="email" class="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition" placeholder="owner@email.com" autocomplete="off" />
              </div>

              <div class="md:col-span-1">
                <label class="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Mật khẩu</label>
                <input id="password" type="password" class="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition" placeholder="Tối thiểu 6 ký tự" autocomplete="new-password" />
              </div>

              <div class="md:col-span-1">
                <label class="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Role</label>
                <select id="role" class="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition">
                  <option value="manager" selected>Chủ quán</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div class="md:col-span-1 flex items-end">
                <button id="submitBtn" type="submit" class="inline-flex items-center gap-2 rounded-xl bg-blue-600 text-white px-5 py-3 text-sm font-semibold hover:bg-blue-700 transition">
                  <i class="bi bi-person-plus"></i>
                  <span>Tạo tài khoản</span>
                </button>
              </div>
            </form>

            <div class="mt-3 text-xs text-slate-500">Role được lưu vào <span class="font-mono">user_metadata.role</span> và bảng <span class="font-mono">user_roles</span>.</div>
          </div>
        </div>

        <div class="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div class="px-6 py-5 border-b border-slate-100 flex items-center justify-between gap-4">
            <div class="flex items-center gap-2">
              <i class="bi bi-people text-blue-600"></i>
              <div class="font-semibold">Danh sách quản lý</div>
            </div>
            <button id="refreshBtn" class="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition">
              <i class="bi bi-arrow-clockwise"></i>
              <span>Làm mới</span>
            </button>
          </div>

          <div class="px-6 py-6">
            <div id="listError" class="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 hidden"></div>
            <div class="overflow-x-auto">
              <table class="min-w-full text-sm">
                <thead>
                  <tr class="text-left text-slate-500">
                    <th class="py-2 pr-4">Email</th>
                    <th class="py-2 pr-4">Role</th>
                    <th class="py-2 pr-4">Tạo lúc</th>
                    <th class="py-2 pr-0"></th>
                  </tr>
                </thead>
                <tbody id="tbody" class="divide-y divide-slate-100"></tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  if (role !== 'admin') {
    document.getElementById('notAdmin').classList.remove('hidden');
    return;
  }

  document.getElementById('adminContent').classList.remove('hidden');

  const createForm = document.getElementById('createForm');
  const successBox = document.getElementById('successBox');
  const errorBox = document.getElementById('errorBox');
  const submitBtn = document.getElementById('submitBtn');
  const tbody = document.getElementById('tbody');
  const listError = document.getElementById('listError');
  const refreshBtn = document.getElementById('refreshBtn');

  refreshBtn.addEventListener('click', async () => {
    await loadList();
  });

  createForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    successBox.classList.add('hidden');
    errorBox.classList.add('hidden');

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const role = document.getElementById('role').value;

    if (!email || !password) {
      showError('Vui lòng nhập email và mật khẩu.');
      return;
    }
    if (password.length < 6) {
      showError('Mật khẩu nên có ít nhất 6 ký tự.');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.classList.add('opacity-70');

    try {
      const token = await getAccessToken();
      const res = await fetch('/api/managers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ email, password, role })
      });

        const json = await res.json().catch(() => null);
        if (!res.ok) {
          const text = await res.text().catch(() => null);
          const errMsg = (json?.error ?? json?.message) || text || 'Có lỗi xảy ra.';
          throw new Error(errMsg.toString());
        }

      successBox.textContent = 'Đã tạo tài khoản thành công.';
      successBox.classList.remove('hidden');
      createForm.reset();

      await loadList();
    } catch (err) {
      showError((err?.message ?? 'Có lỗi xảy ra.').toString());
    } finally {
      submitBtn.disabled = false;
      submitBtn.classList.remove('opacity-70');
    }
  });

  await loadList();

  async function loadList() {
    listError.classList.add('hidden');
    tbody.innerHTML = '';

    try {
      const token = await getAccessToken();
      const res = await fetch('/api/managers', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json?.error ?? 'Không thể tải danh sách.').toString());

      const rows = Array.isArray(json?.data) ? json.data : [];
      if (!rows.length) {
        tbody.innerHTML = `<tr><td class="py-4 text-slate-500" colspan="4">Chưa có quản lý nào.</td></tr>`;
        return;
      }

      tbody.innerHTML = rows.map(r => {
        const created = r.created_at ? new Date(r.created_at).toLocaleString() : '';
        const safeEmail = escapeHtml((r.email ?? '').toString());
        const safeId = escapeHtml((r.user_id ?? '').toString());
        const safeRole = escapeHtml((r.role ?? '').toString());

        return `
          <tr data-id="${safeId}">
            <td class="py-3 pr-4 text-slate-800">${safeEmail}</td>
            <td class="py-3 pr-4 text-slate-700 font-medium">${safeRole || '—'}</td>
            <td class="py-3 pr-4 text-slate-500">${escapeHtml(created)}</td>
            <td class="py-3 pr-0 text-right">
              <button class="delBtn inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition">
                <i class="bi bi-trash"></i><span>Xoá</span>
              </button>
            </td>
          </tr>
        `;
      }).join('');
      // Role column is display-only; no edit listeners.

      tbody.querySelectorAll('.delBtn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const tr = e.target.closest('tr');
          const id = tr?.getAttribute('data-id') || '';

          if (!id) return;
          if (!confirm('Xoá tài khoản này?')) return;

          try {
            const token = await getAccessToken();
            const res = await fetch(`/api/managers/${encodeURIComponent(id)}`, {
              method: 'DELETE',
              headers: {
                'Authorization': `Bearer ${token}`
              }
            });

            const json = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error((json?.error ?? 'Không thể xoá.').toString());

            await loadList();
          } catch (err) {
            listError.textContent = (err?.message ?? 'Không thể xoá.').toString();
            listError.classList.remove('hidden');
          }
        });
      });
    } catch (err) {
      listError.textContent = (err?.message ?? 'Không thể tải danh sách.').toString();
      listError.classList.remove('hidden');
    }
  }

  function showError(msg) {
    errorBox.textContent = msg;
    errorBox.classList.remove('hidden');
  }

  async function getAccessToken() {
    const session = await getSession();
    // Some supabase client versions / environments may expose the token under
    // different keys; try common alternatives as a fallback.
    const token = session?.access_token ?? session?.accessToken ?? session?.provider_token ?? session?.providerToken ?? session?.token;
    if (!token) throw new Error('Chưa đăng nhập.');
    return token;
  }
}

import { ensureConfigured } from '../bootstrap.js';
import { requireAuth } from '../auth.js';
import { getSupabase } from '../supabaseClient.js';
import { renderLayout } from '../layout.js';
import { escapeHtml, getQueryParam } from '../ui.js';

if (!ensureConfigured()) {
  // config page already rendered
} else {
  const session = await requireAuth();
  if (session) {
    const main = renderLayout({ activeKey: 'languages', title: 'Quản lý Ngôn ngữ | POI Admin', user: session.user });
    await render(main);
  }
}

async function render(main) {
  const supabase = getSupabase();
  const editCode = (getQueryParam('code') ?? '').trim().toLowerCase();
  const isEdit = Boolean(editCode);

  let languages = [];
  let flash = { type: '', message: '' };

  try {
    const res = await supabase.from('languages').select('code,name,is_active').order('code', { ascending: true });
    if (res.error) throw res.error;
    languages = res.data ?? [];
  } catch {
    languages = [];
  }

  let values = { code: '', name: '', is_active: true };
  let mode = 'add';
  if (isEdit) {
    const row = languages.find(x => (x.code ?? '').toString().toLowerCase() === editCode);
    if (row) {
      values = { code: row.code, name: row.name ?? '', is_active: Boolean(row.is_active) };
      mode = 'edit';
    } else {
      flash = { type: 'error', message: 'Không tìm thấy ngôn ngữ để sửa.' };
    }
  }

  main.innerHTML = `
    <div class="flex items-start justify-between gap-6">
      <div>
        <h1 class="text-2xl font-semibold">Quản lý Ngôn ngữ</h1>
        <p class="text-sm text-slate-500 mt-1">Thêm, sửa và bật/tắt trạng thái ngôn ngữ.</p>
      </div>

      <a href="/languages" class="inline-flex items-center gap-2 rounded-xl bg-blue-600 text-white px-4 py-2 text-sm font-semibold hover:bg-blue-700 transition">
        <i class="bi bi-plus-lg"></i>
        <span>Thêm ngôn ngữ mới</span>
      </a>
    </div>

    ${flash.message ? renderFlash(flash) : ''}

    <div class="mt-6 grid grid-cols-1 xl:grid-cols-12 gap-6">
      <section class="xl:col-span-7">
        <div class="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div class="px-6 py-5 border-b border-slate-100 font-semibold">Danh sách ngôn ngữ</div>
          <div class="overflow-x-auto">
            <table class="min-w-full border-collapse">
              <thead>
                <tr class="bg-slate-50 text-left text-sm text-slate-600 uppercase tracking-wider">
                  <th class="px-4 py-3">Mã</th>
                  <th class="px-4 py-3">Tên</th>
                  <th class="px-4 py-3">Trạng thái</th>
                  <th class="px-4 py-3">Hành động</th>
                </tr>
              </thead>
              <tbody>
                ${languages.length === 0 ? `
                  <tr><td class="px-4 py-4 text-sm text-slate-500" colspan="4">Chưa có ngôn ngữ nào.</td></tr>
                ` : languages.map(renderRow).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section class="xl:col-span-5">
        <div class="bg-white border border-slate-200 rounded-2xl p-6">
          <h2 class="text-lg font-semibold">${mode === 'edit' ? 'Chỉnh sửa ngôn ngữ' : 'Thêm ngôn ngữ mới'}</h2>
          <p class="text-sm text-slate-500 mt-1">Nhập mã, tên và trạng thái của ngôn ngữ.</p>

          <div id="errorBox" class="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 hidden"></div>

          <form id="langForm" class="mt-6 space-y-5">
            <label class="block">
              <div class="text-sm font-semibold text-slate-700">Mã ngôn ngữ <span class="text-rose-600">*</span></div>
              <input id="code" value="${escapeHtml(values.code)}" ${mode === 'edit' ? 'readonly aria-readonly="true"' : ''} class="mt-2 w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition" placeholder="vi" maxlength="2" required />
              <div class="mt-1 text-xs text-slate-500">Mã gồm 2 chữ cái, ví dụ: <span class="font-mono">vi</span>, <span class="font-mono">en</span>.</div>
            </label>

            <label class="block">
              <div class="text-sm font-semibold text-slate-700">Tên ngôn ngữ <span class="text-rose-600">*</span></div>
              <input id="name" value="${escapeHtml(values.name)}" class="mt-2 w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition" placeholder="Tiếng Việt" maxlength="100" required />
            </label>

            <label class="flex items-center gap-3">
              <input id="isActive" type="checkbox" ${values.is_active ? 'checked' : ''} class="h-4 w-4 text-blue-600 border-slate-300 rounded" />
              <span class="text-sm text-slate-700">Kích hoạt ngôn ngữ</span>
            </label>

            <div class="flex items-center justify-end gap-3">
              ${mode === 'edit' ? `<a href="/languages" class="inline-flex items-center gap-2 rounded-xl bg-white border border-slate-200 text-slate-700 px-4 py-2 text-sm font-semibold hover:bg-slate-50 transition">Huỷ</a>` : ''}
              <button id="submitBtn" type="submit" class="inline-flex items-center gap-2 rounded-xl bg-blue-600 text-white px-4 py-2 text-sm font-semibold hover:bg-blue-700 transition">
                <i class="bi bi-check2"></i>
                <span>${mode === 'edit' ? 'Cập nhật' : 'Thêm'}</span>
              </button>
            </div>
          </form>
        </div>
      </section>
    </div>
  `;

  // Toggle handlers
  main.querySelectorAll('[data-action="toggle"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const code = (btn.getAttribute('data-code') ?? '').toString();
      const isActive = (btn.getAttribute('data-active') ?? '') === 'true';
      try {
        const res = await supabase.from('languages').update({ is_active: !isActive }).eq('code', code);
        if (res.error) throw res.error;
        window.location.reload();
      } catch {
        window.alert('Không thể cập nhật trạng thái ngôn ngữ.');
      }
    });
  });

  // Form submit
  const form = document.getElementById('langForm');
  const errorBox = document.getElementById('errorBox');
  const submitBtn = document.getElementById('submitBtn');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorBox.classList.add('hidden');

    const code = document.getElementById('code').value.trim().toLowerCase();
    const name = document.getElementById('name').value.trim();
    const isActive = document.getElementById('isActive').checked;

    const errors = [];
    if (!code) errors.push('Vui lòng nhập mã ngôn ngữ.');
    else if (!/^[a-z]{2}$/.test(code)) errors.push('Mã ngôn ngữ phải gồm 2 chữ cái (ví dụ: vi, en).');
    if (!name) errors.push('Vui lòng nhập tên ngôn ngữ.');
    else if (name.length > 100) errors.push('Tên ngôn ngữ tối đa 100 ký tự.');

    if (errors.length) {
      errorBox.innerHTML = `<ul class="list-disc pl-5 space-y-1">${errors.map(x => `<li>${escapeHtml(x)}</li>`).join('')}</ul>`;
      errorBox.classList.remove('hidden');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.classList.add('opacity-70');

    try {
      if (mode === 'edit') {
        const res = await supabase.from('languages').update({ name, is_active: isActive }).eq('code', code);
        if (res.error) throw res.error;
      } else {
        const res = await supabase.from('languages').insert({ code, name, is_active: isActive });
        if (res.error) throw res.error;
      }

      window.location.href = '/languages';
    } catch (err) {
      const msg = (err?.message ?? 'Không thể lưu ngôn ngữ. Vui lòng thử lại.').toString();
      errorBox.textContent = msg;
      errorBox.classList.remove('hidden');
      submitBtn.disabled = false;
      submitBtn.classList.remove('opacity-70');
    }
  });

  function renderRow(language) {
    const code = (language.code ?? '').toString();
    const name = (language.name ?? '').toString();
    const isActive = Boolean(language.is_active);
    return `
      <tr class="border-t border-slate-100">
        <td class="px-4 py-4 text-sm font-semibold">${escapeHtml(code)}</td>
        <td class="px-4 py-4 text-sm">${escapeHtml(name)}</td>
        <td class="px-4 py-4 text-sm">
          <span class="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold ${isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}">
            ${isActive ? 'Hoạt động' : 'Tạm ngưng'}
          </span>
        </td>
        <td class="px-4 py-4 text-sm">
          <div class="flex flex-wrap gap-2">
            <a href="/languages?code=${encodeURIComponent(code)}" class="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-600 text-xs font-semibold hover:bg-slate-50 transition">
              <i class="bi bi-pencil"></i>
              Sửa
            </a>
            <button type="button" data-action="toggle" data-code="${escapeHtml(code)}" data-active="${isActive ? 'true' : 'false'}" class="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-600 text-xs font-semibold hover:bg-slate-50 transition">
              <i class="bi ${isActive ? 'bi-toggle2-on' : 'bi-toggle2-off'}"></i>
              ${isActive ? 'Tắt' : 'Bật'}
            </button>
          </div>
        </td>
      </tr>
    `;
  }

  function renderFlash({ type, message }) {
    const cls = type === 'error'
      ? 'mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700'
      : 'mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-700';

    return `<div class="${cls}">${escapeHtml(message)}</div>`;
  }
}

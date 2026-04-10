import { ensureConfigured } from '../bootstrap.js';
import { requireAuth, getSession } from '../auth.js';
import { getSupabase } from '../supabaseClient.js';
import { renderLayout } from '../layout.js';
import { escapeHtml, getQueryParam } from '../ui.js';

// Simple translator helper (uses Langbly same as POI form)
async function translateText(text, fromLang, toLang) {
  if (!text) return text;
  const apiUrl = 'https://api.langbly.com/language/translate/v2';
  const apiKey = 'PkgVTFvwtPoRdYKHNgoRFN';

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey
    },
    body: JSON.stringify({
      q: text,
      source: fromLang,
      target: toLang
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('Translation API error:', errText);
    throw new Error('Translation failed');
  }

  const data = await response.json();
  return data?.data?.translations?.[0]?.translatedText || text;
}

// Predefined language choices
const AVAILABLE_LANGUAGES = [
  { code: 'en', name: '(US) English' },
  { code: 'es', name: '(ES) Español' },
  { code: 'ja', name: '(JP) 日本語' },
  { code: 'ko', name: '(KR) 한국어' },
  { code: 'vi', name: '(VN) Tiếng Việt' },
  { code: 'zh-CN', name: '(CN) 汉语' },

  { code: 'fr', name: '(FR) Français' },
  { code: 'ar', name: '(SA) العربية' },
  { code: 'id', name: '(ID) Bahasa Indonesia' },
  { code: 'th', name: '(TH) ไทย' },
  { code: 'ms', name: '(MY) Bahasa Melayu' },
  { code: 'de', name: '(DE) Deutsch' },
  { code: 'pt', name: '(PT) Português' },
  { code: 'it', name: '(IT) Italiano' },
  { code: 'ru', name: '(RU) Русский' },
  { code: 'hi', name: '(IN) हिन्दी' }
];

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
  const session = await getSession();
  const role = ((session?.user?.user_metadata?.role ?? '') || '').toString();

  if (role !== 'admin') {
    main.innerHTML = `
      <div class="rounded-2xl border border-amber-200 bg-amber-50 px-6 py-5 text-amber-900">
        <div class="font-semibold">Bạn không có quyền truy cập trang này.</div>
        <div class="text-sm mt-1">Yêu cầu role <span class="font-mono">admin</span>. Role hiện tại: <span class="font-mono">${escapeHtml(role || '—')}</span></div>
      </div>
    `;
    return;
  }
  const isEdit = false;
  const isAdd = ((getQueryParam('new') ?? '').toString().trim() === '1');

  let languages = [];
  let flash = { type: '', message: '' };

  try {
    const res = await supabase.from('languages').select('code,name').order('code', { ascending: true });
    if (res.error) throw res.error;
    languages = res.data ?? [];
  } catch {
    languages = [];
  }

  let values = { code: '', name: '' };
  let mode = 'add';

  main.innerHTML = `
    <div class="flex items-start justify-between gap-6">
      <div>
        <h1 class="text-2xl font-semibold">Quản lý Ngôn ngữ</h1>
        <p class="text-sm text-slate-500 mt-1">Thêm và sửa ngôn ngữ.</p>
      </div>

      <a href="/languages?new=1" data-action="add" class="inline-flex items-center gap-2 rounded-xl bg-blue-600 text-white px-4 py-2 text-sm font-semibold hover:bg-blue-700 transition">
        <i class="bi bi-plus-lg"></i>
        <span>Thêm ngôn ngữ mới</span>
      </a>
    </div>

    ${flash.message ? renderFlash(flash) : ''}

    <div class="mt-6">
      <div class="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div class="px-6 py-5 border-b border-slate-100 font-semibold">Danh sách ngôn ngữ</div>
        <div class="overflow-x-auto">
          <table class="min-w-full border-collapse">
            <thead>
              <tr class="bg-slate-50 text-left text-sm text-slate-600 uppercase tracking-wider">
                <th class="px-4 py-3">Mã</th>
                <th class="px-4 py-3">Tên</th>
              </tr>
            </thead>
            <tbody>
              ${languages.length === 0 ? `
                <tr><td class="px-4 py-4 text-sm text-slate-500" colspan="2">Chưa có ngôn ngữ nào.</td></tr>
              ` : languages.map(renderRow).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div id="langModal" class="fixed inset-0 z-50 hidden">
      <div data-modal-overlay class="absolute inset-0 bg-slate-900/40"></div>
      <div class="absolute inset-0 overflow-y-auto">
        <div class="min-h-full flex items-start justify-center p-4 sm:p-6">
          <div class="w-full max-w-xl bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div class="px-6 py-5 border-b border-slate-100 flex items-start justify-between gap-4">
              <div>
                <h2 id="modalTitle" class="text-lg font-semibold">Thêm ngôn ngữ mới</h2>
                <p class="text-sm text-slate-500 mt-1">Nhập mã và tên của ngôn ngữ.</p>
              </div>
              <button type="button" data-modal-close class="shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition" aria-label="Đóng">
                <i class="bi bi-x-lg"></i>
              </button>
            </div>

            <div class="p-6">
              <div id="errorBox" class="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 hidden"></div>

              <form id="langForm" class="mt-5 space-y-5">
                <label class="block">
                  <div class="text-sm font-semibold text-slate-700">Chọn ngôn ngữ để thêm <span class="text-rose-600">*</span></div>
                  <select id="langSelect" class="mt-2 w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition">
                    <option value="">-- Chọn ngôn ngữ --</option>
                  </select>
                  <div class="mt-1 text-xs text-slate-500">Chọn một ngôn ngữ từ danh sách (chỉ hiển thị những ngôn ngữ chưa có).</div>
                </label>

                <div class="flex items-center justify-end gap-3">
                  <button type="button" data-modal-cancel class="inline-flex items-center gap-2 rounded-xl bg-white border border-slate-200 text-slate-700 px-4 py-2 text-sm font-semibold hover:bg-slate-50 transition">Huỷ</button>
                  <button id="submitBtn" type="submit" class="inline-flex items-center gap-2 rounded-xl bg-blue-600 text-white px-4 py-2 text-sm font-semibold hover:bg-blue-700 transition">
                    <i class="bi bi-check2"></i>
                    <span id="submitText">Thêm</span>
                  </button>
                </div>
                
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Note: toggle UI removed — status is still displayed but cannot be toggled here.

  // Modal add/edit handlers
  const modal = document.getElementById('langModal');
  const modalTitle = document.getElementById('modalTitle');
  const submitText = document.getElementById('submitText');
  const overlay = modal.querySelector('[data-modal-overlay]');
  const closeBtns = modal.querySelectorAll('[data-modal-close], [data-modal-cancel]');

  // Populate language dropdown with choices not already present
  const langSelect = document.getElementById('langSelect');
  const addBtn = main.querySelector('[data-action="add"]');
  try {
    const available = AVAILABLE_LANGUAGES.filter(a => !languages.find(l => (l.code ?? '').toString().toLowerCase() === a.code.toString().toLowerCase()));
    if (available.length === 0) {
      // disable add button when no languages left
      if (addBtn) {
        addBtn.classList.add('opacity-50');
        addBtn.setAttribute('aria-disabled', 'true');
        addBtn.addEventListener('click', (e) => e.preventDefault());
      }
      if (langSelect) {
        langSelect.innerHTML = '<option value="">(Tất cả ngôn ngữ đã được thêm)</option>';
        langSelect.disabled = true;
      }
    } else {
      langSelect.innerHTML = '<option value="">-- Chọn ngôn ngữ --</option>' + available.map(a => `<option value="${escapeHtml(a.code)}">${escapeHtml(a.name)}</option>`).join('');
      langSelect.disabled = false;
    }
  } catch (e) {
    console.error('Lỗi khi tạo danh sách ngôn ngữ', e);
  }

  function setUrl(params, { replace = false } = {}) {
    const url = new URL(window.location.href);
    url.searchParams.delete('code');
    url.searchParams.delete('new');
    if (params?.code) url.searchParams.set('code', params.code);
    if (params?.isNew) url.searchParams.set('new', '1');
    const next = url.pathname + (url.searchParams.toString() ? `?${url.searchParams.toString()}` : '');
    if (replace) window.history.replaceState({}, '', next);
    else window.history.pushState({}, '', next);
  }

  function openModal(nextMode, nextValues) {
    mode = 'add';
    values = { code: '', name: '' };

    modalTitle.textContent = 'Thêm ngôn ngữ mới';
    submitText.textContent = 'Thêm';

    const errorBox = document.getElementById('errorBox');
    const langSelect = document.getElementById('langSelect');
    if (errorBox) { errorBox.classList.add('hidden'); errorBox.textContent = ''; }
    if (langSelect) { langSelect.value = ''; langSelect.focus(); }

    modal.classList.remove('hidden');
    document.body.classList.add('overflow-hidden');
  }

  function closeModal({ replaceUrl = true } = {}) {
    modal.classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
    const errorBox = document.getElementById('errorBox');
    const submitBtn = document.getElementById('submitBtn');
    errorBox.classList.add('hidden');
    errorBox.textContent = '';
    submitBtn.disabled = false;
    submitBtn.classList.remove('opacity-70');
    if (replaceUrl) {
      setUrl({}, { replace: true });
    }
  }

  function openAdd({ syncUrl = true } = {}) {
    if (syncUrl) setUrl({ isNew: true });
    openModal('add', { code: '', name: '' });
  }

  // Open modal by clicking
  main.querySelectorAll('[data-action="add"]').forEach(a => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      openAdd();
    });
  });

  

  // Close modal
  overlay.addEventListener('click', () => closeModal());
  closeBtns.forEach(btn => btn.addEventListener('click', () => closeModal()));
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.classList.contains('hidden')) closeModal();
  });

  

  // Back/forward navigation
  window.addEventListener('popstate', () => {
    const isNew = ((getQueryParam('new') ?? '').toString().trim() === '1');
    if (isNew) return openAdd({ syncUrl: false });
    closeModal({ replaceUrl: false });
  });

  // Form submit
  const form = document.getElementById('langForm');
  const errorBox = document.getElementById('errorBox');
  const submitBtn = document.getElementById('submitBtn');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorBox.classList.add('hidden');

    const code = document.getElementById('langSelect')?.value?.trim();
    const selected = AVAILABLE_LANGUAGES.find(x => x.code === code);
    const name = selected?.name ?? '';

    const errors = [];
    if (!code) errors.push('Vui lòng chọn ngôn ngữ.');

    if (errors.length) {
      errorBox.innerHTML = `<ul class="list-disc pl-5 space-y-1">${errors.map(x => `<li>${escapeHtml(x)}</li>`).join('')}</ul>`;
      errorBox.classList.remove('hidden');
      return;
    }

    // Kiểm tra xem mã ngôn ngữ có được Langbly hỗ trợ không (nếu không phải 'vi')
    if (mode === 'add' && code && code !== 'vi') {
      try {
        // Gọi translate nhanh với chuỗi ngắn để kiểm tra hỗ trợ
        await translateText('Hello', 'vi', code);
      } catch (e) {
        errorBox.textContent = 'Mã ngôn ngữ không được hỗ trợ bởi Langbly hoặc có lỗi kết nối.';
        errorBox.classList.remove('hidden');
        return;
      }
    }

    submitBtn.disabled = true;
    submitBtn.classList.add('opacity-70');

    try {
      if (mode === 'edit') {
        const res = await supabase.from('languages').update({ name }).eq('code', code);
        if (res.error) throw res.error;
      } else {
        const res = await supabase.from('languages').insert({ code, name });
        if (res.error) throw res.error;

        // After adding a new language, translate existing POI descriptions
        try {
          const { data: pois, error: poiErr } = await supabase.from('pois').select('id,description');
          if (poiErr) throw poiErr;

          if (Array.isArray(pois) && pois.length) {
            await Promise.all(pois.map(async (p) => {
              try {
                let translatedDesc = p.description ?? null;
                if (p.description && code !== 'vi') {
                  translatedDesc = await translateText(p.description, 'vi', code);
                }

                await supabase.from('poitranslations').upsert({
                  poi_id: p.id,
                  lang_code: code,
                  description: translatedDesc || null
                }, { onConflict: 'poi_id,lang_code' });
              } catch (e) {
                console.error('Translation/upsert failed for POI', p?.id, e);
              }
            }));
          }
        } catch (e) {
          console.error('Error translating existing POIs for new language', code, e);
        }
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

  // Open modal if URL indicates add/edit
  if (isEdit && values.code) {
    openModal('edit', values);
  } else if (isAdd) {
    openModal('add', { code: '', name: '' });
  }

  function renderRow(language) {
    const code = (language.code ?? '').toString();
    const name = (language.name ?? '').toString();
    return `
      <tr class="border-t border-slate-100">
        <td class="px-4 py-4 text-sm font-semibold">${escapeHtml(code)}</td>
        <td class="px-4 py-4 text-sm">${escapeHtml(name)}</td>
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

import { ensureConfigured } from '../bootstrap.js';
import { requireAuth, getSession } from '../auth.js';
import { getSupabase } from '../supabaseClient.js';
import { renderLayout } from '../layout.js';
import { escapeHtml, getTailwindColorFromClass, waitForGlobal } from '../ui.js';

if (!ensureConfigured()) {
  // config page already rendered
} else {
  const session = await requireAuth();
  if (session) {
    const main = renderLayout({ activeKey: 'pois', title: 'Quản lý POIs | POI Admin', user: session.user });
    await render(main);
  }
}

async function render(main) {
  const session = await getSession();
  const userId = session?.user?.id ?? '';
  const role = ((session?.user?.user_metadata?.role ?? '') || '').toString();
  main.innerHTML = `
    <div class="flex items-start justify-between gap-6">
      <div>
        <h1 class="text-2xl font-semibold">Quản lý POIs</h1>
        <p class="text-sm text-slate-500 mt-1">Thêm, sửa, xoá các điểm tham quan trên bản đồ.</p>
      </div>
      <a href="/poi-form" class="inline-flex items-center gap-2 rounded-xl bg-blue-600 text-white px-4 py-2 text-sm font-semibold hover:bg-blue-700 transition">
        <i class="bi bi-plus-lg"></i>
        <span>Thêm POI mới</span>
      </a>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
      <section class="lg:col-span-4">
        <div class="relative">
          <span class="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-400"><i class="bi bi-search"></i></span>
          <input id="poiSearch" type="text" class="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition" placeholder="Tìm kiếm POI..." autocomplete="off" />
        </div>

        <div class="mt-4 bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div id="flash" class="hidden px-5 py-4 text-sm"></div>
          <div id="poiList" class="divide-y divide-slate-100"></div>
          <div id="poiEmpty" class="px-5 py-6 text-sm text-slate-500 text-center hidden">Không tìm thấy POI nào.</div>
        </div>
      </section>

      <section class="lg:col-span-8">
        <div class="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div id="map" class="h-[540px] w-full"></div>
        </div>
        <div class="text-[11px] text-slate-400 mt-2">Bản đồ dùng dữ liệu từ OpenStreetMap.</div>
      </section>
    </div>

    <div id="deleteModal" class="fixed inset-0 z-[9999] hidden items-center justify-center bg-slate-900/40 px-4">
      <div class="w-full max-w-md rounded-2xl bg-white border border-slate-200 p-6">
        <div class="text-lg font-semibold">Xoá POI</div>
        <div class="mt-2 text-sm text-slate-600">Bạn có chắc muốn xóa không?</div>
        <div class="mt-6 flex items-center justify-end gap-3">
          <button id="deleteCancel" type="button" class="inline-flex items-center rounded-xl bg-white border border-slate-200 text-slate-700 px-4 py-2 text-sm font-semibold hover:bg-slate-50 transition">Huỷ</button>
          <button id="deleteConfirm" type="button" class="inline-flex items-center rounded-xl bg-rose-600 text-white px-4 py-2 text-sm font-semibold hover:bg-rose-700 transition">Xoá</button>
        </div>
      </div>
    </div>
  `;

  const L = await waitForGlobal('L', 5000);
  if (!L) {
    showFlash('Không tải được Leaflet (bản đồ).', 'error');
    return;
  }

  const supabase = getSupabase();

  const map = L.map('map');
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  const stroke = getTailwindColorFromClass('text-blue-600') || '#2563eb';
  const fill = getTailwindColorFromClass('text-blue-500') || '#3b82f6';
  const geofenceOptions = { radius: 50, weight: 2, opacity: 0.9, fillOpacity: 0.12, interactive: false, color: stroke, fillColor: fill };

  let pois = [];
  try {
    const res = await supabase
      .from('pois')
      .select('id,name,description,lat,lng,user_id')
      .order('id', { ascending: false });

    if (res.error) throw res.error;
    pois = res.data ?? [];

    // If the user is a manager, only show POIs that belong to them
    if (role === 'manager' && userId) {
      pois = pois.filter(p => ((p.user_id ?? '') === userId));
    }
    // Load owner display names (from user_roles.email) for shown POIs
    try {
      const uids = Array.from(new Set(pois.map(p => (p.user_id ?? '').toString()).filter(Boolean)));
      if (uids.length) {
        const ur = await supabase.from('user_roles').select('user_id,email').in('user_id', uids);
        const map = {};
        if (!ur.error && Array.isArray(ur.data)) ur.data.forEach(r => map[(r.user_id ?? '').toString()] = r.email || '');
        pois.forEach(p => p.ownerName = map[(p.user_id ?? '').toString()] || '');
      } else {
        pois.forEach(p => p.ownerName = '');
      }
    } catch (e) {
      pois.forEach(p => p.ownerName = '');
    }
  } catch {
    pois = [];
  }

  const markersById = new Map();
  const bounds = [];

  for (const poi of pois) {
    const lat = Number(poi.lat);
    const lng = Number(poi.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      const ll = [lat, lng];
      bounds.push(ll);
      L.circle(ll, geofenceOptions).addTo(map);
      const marker = L.marker(ll).addTo(map);
      marker.bindTooltip(escapeHtml(poi.name || ''), { direction: 'top', offset: [0, -8], opacity: 0.95, sticky: true });
      markersById.set(poi.id, marker);
    }
  }

  if (bounds.length > 0) {
    map.fitBounds(bounds, { padding: [20, 20] });
  } else {
    // TP.HCM (District 1 area)
    map.setView([10.776889, 106.700806], 13);
  }

  const poiList = document.getElementById('poiList');
  const poiEmpty = document.getElementById('poiEmpty');
  const search = document.getElementById('poiSearch');

  renderList(pois);
  applyFilter('');

  search.addEventListener('input', () => {
    applyFilter(search.value);
  });

  function renderList(items) {
    if (items.length === 0) {
      poiList.innerHTML = '';
      poiEmpty.classList.remove('hidden');
      return;
    }

    poiEmpty.classList.add('hidden');
    poiList.innerHTML = items.map(poi => {
      const id = (poi.id ?? '').toString();
      const name = (poi.name ?? '').toString();
      const desc = (poi.description ?? '').toString();
      const ownerText = (poi.ownerName ?? '').toString();
      const dataSearch = `${name} ${desc} ${ownerText}`.toLowerCase();

      return `
        <div class="poi-row flex items-stretch justify-between gap-3 px-5 py-4 hover:bg-slate-50 transition" data-id="${escapeHtml(id)}" data-search="${escapeHtml(dataSearch)}">
          <button type="button" class="poi-item flex items-start gap-3 text-left min-w-0 flex-1">
            <div class="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mt-0.5"><i class="bi bi-geo-alt"></i></div>
            <div class="min-w-0 flex-1">
              <div class="font-semibold truncate">${escapeHtml(name)}</div>
              <div class="text-xs text-slate-500 truncate">${escapeHtml(desc)}</div>
              <div class="text-xs text-slate-400 mt-1">
                <span class="font-mono">${escapeHtml(ownerText || '—')}</span>
              </div>
            </div>
          </button>

          <div class="shrink-0 flex items-start gap-2">
            <a href="/poi-detail?id=${encodeURIComponent(id)}" class="w-10 h-10 rounded-xl border border-slate-200 text-slate-500 hover:bg-white hover:text-slate-700 hover:border-slate-300 transition flex items-center justify-center" title="Xem chi tiết" aria-label="Xem chi tiết">
              <i class="bi bi-eye"></i>
            </a>

            <a href="/poi-form?id=${encodeURIComponent(id)}" class="w-10 h-10 rounded-xl border border-slate-200 text-slate-500 hover:bg-white hover:text-blue-600 hover:border-blue-200 transition flex items-center justify-center" title="Sửa POI" aria-label="Sửa POI">
              <i class="bi bi-pencil"></i>
            </a>

            <button type="button" class="delete-btn w-10 h-10 rounded-xl border border-slate-200 text-slate-500 hover:bg-white hover:text-rose-600 hover:border-rose-200 transition flex items-center justify-center" title="Xoá POI" aria-label="Xoá POI" data-id="${escapeHtml(id)}">
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </div>
      `;
    }).join('');

    poiList.querySelectorAll('.poi-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const row = btn.closest('.poi-row');
        const id = row?.getAttribute('data-id') ?? '';
        const marker = markersById.get(id);
        if (marker) {
          map.setView(marker.getLatLng(), 16);
          marker.openPopup?.();
        }
      });
    });

    poiList.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', () => openDelete(btn.getAttribute('data-id') || ''));
    });
  }

  function applyFilter(value) {
    const q = (value ?? '').toString().trim().toLowerCase();
    const rows = Array.from(poiList.querySelectorAll('.poi-row'));
    let shown = 0;

    for (const row of rows) {
      const text = (row.getAttribute('data-search') ?? '').toString();
      const ok = q === '' || text.includes(q);
      row.style.display = ok ? '' : 'none';
      if (ok) shown++;
    }

    if (pois.length === 0) {
      poiEmpty.classList.remove('hidden');
    } else if (shown === 0) {
      poiEmpty.classList.remove('hidden');
    } else {
      poiEmpty.classList.add('hidden');
    }
  }

  // Delete modal
  const modal = document.getElementById('deleteModal');
  const cancelBtn = document.getElementById('deleteCancel');
  const confirmBtn = document.getElementById('deleteConfirm');
  let pendingDeleteId = '';

  cancelBtn.addEventListener('click', closeDelete);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeDelete(); });

  confirmBtn.addEventListener('click', async () => {
    if (!pendingDeleteId) return;

    confirmBtn.disabled = true;
    try {
      // Call server endpoint to delete POI (server will remove storage file using service key)
      const token = (session?.access_token ?? '') || '';
      const resp = await fetch(`/api/pois/${encodeURIComponent(pendingDeleteId)}`, {
        method: 'DELETE',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      const j = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(j?.error || 'Delete failed');
      window.location.reload();
    } catch {
      showFlash('Không thể xoá POI. Vui lòng thử lại.', 'error');
      confirmBtn.disabled = false;
      closeDelete();
    }
  });

  function openDelete(id) {
    pendingDeleteId = id;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }

  function closeDelete() {
    pendingDeleteId = '';
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }

  function showFlash(message, type) {
    const flash = document.getElementById('flash');
    flash.classList.remove('hidden');
    if (type === 'error') {
      flash.className = 'px-5 py-4 text-sm text-rose-700 bg-rose-50 border-b border-rose-100';
    } else {
      flash.className = 'px-5 py-4 text-sm text-emerald-700 bg-emerald-50 border-b border-emerald-100';
    }
    flash.textContent = message;
  }
}

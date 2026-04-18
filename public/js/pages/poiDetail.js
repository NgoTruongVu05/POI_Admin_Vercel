import { ensureConfigured } from '../bootstrap.js';
import { requireAuth } from '../auth.js';
import { getSupabase } from '../supabaseClient.js';
import { renderLayout } from '../layout.js';
import { escapeHtml, getQueryParam, getTailwindColorFromClass, waitForGlobal } from '../ui.js';

if (!ensureConfigured()) {
  // config page already rendered
} else {
  const session = await requireAuth();
  if (session) {
    const main = renderLayout({ activeKey: 'pois', title: 'Chi tiết POI | POI Admin', user: session.user });
    await render(main);
  }
}
// Hello world

async function render(main) {
  const L = await waitForGlobal('L', 5000);
  const id = (getQueryParam('id') ?? '').trim();

  if (!id) {
    main.innerHTML = `<div class="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">Thiếu POI ID.</div>`;
    return;
  }

  const supabase = getSupabase();

  let poi = null;
  try {
    let res = await supabase.from('pois').select('id,name,description,lat,lng,image,maplink,priority').eq('id', id).limit(1).single();
    if (res.error) {
      // Backward compatibility if DB doesn't have priority column yet
      res = await supabase.from('pois').select('id,name,description,lat,lng,image,maplink').eq('id', id).limit(1).single();
    }
    if (res.error) throw res.error;
    poi = res.data;
  } catch {
    poi = null;
  }

  main.innerHTML = `
    <div class="flex items-start justify-between gap-6">
      <div>
        <h1 class="text-2xl font-semibold">Chi tiết POI</h1>
        <p class="text-sm text-slate-500 mt-1">Xem thông tin chi tiết điểm tham quan.</p>
      </div>

      <div class="flex items-center gap-3">
        ${poi ? `
          <a href="/poi-form?id=${encodeURIComponent(id)}" class="inline-flex items-center gap-2 rounded-xl bg-blue-600 text-white px-4 py-2 text-sm font-semibold hover:bg-blue-700 transition">
            <i class="bi bi-pencil"></i>
            <span>Sửa</span>
          </a>
        ` : ''}

        <a href="/pois" class="inline-flex items-center gap-2 rounded-xl bg-white border border-slate-200 text-slate-700 px-4 py-2 text-sm font-semibold hover:bg-slate-50 transition">
          <i class="bi bi-arrow-left"></i>
          <span>Quay lại</span>
        </a>
      </div>
    </div>

    ${!poi ? `
      <div class="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">Không tìm thấy POI.</div>
    ` : `
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
        <section class="lg:col-span-5">
          <div class="bg-white border border-slate-200 rounded-2xl p-6">
            <div class="flex items-start justify-between gap-4">
              <div>
                <div class="text-sm text-slate-500">Mã POI</div>
                <div class="mt-1 font-semibold">${escapeHtml(poi.id)}</div>
              </div>
              <div class="flex-shrink-0">
                ${poi.image ? `<img src="${escapeHtml(poi.image)}" alt="Ảnh POI" class="w-32 h-32 object-cover rounded-lg border border-slate-200" />` : ''}
              </div>
            </div>

            <div class="mt-5 text-sm text-slate-500">Tên POI</div>
            <div class="mt-1 font-semibold">${escapeHtml(poi.name ?? '')}</div>

            <div class="mt-5 text-sm text-slate-500">Mô tả</div>
            <div class="mt-1 text-sm text-slate-700 whitespace-pre-line">${escapeHtml(poi.description ?? '')}</div>

            ${poi.maplink ? `
              <div class="mt-5 text-sm text-slate-500">Maplink</div>
              <div class="mt-1 text-sm text-slate-700 break-words"><a href="${escapeHtml(poi.maplink)}" target="_blank" rel="noopener noreferrer" class="text-blue-600 underline">${escapeHtml(poi.maplink)}</a></div>
            ` : ''}

            <div class="mt-5 grid grid-cols-2 gap-4">
              <div>
                <div class="text-sm text-slate-500">Latitude</div>
                <div class="mt-1 font-semibold">${escapeHtml(String(poi.lat ?? ''))}</div>
              </div>
              <div>
                <div class="text-sm text-slate-500">Longitude</div>
                <div class="mt-1 font-semibold">${escapeHtml(String(poi.lng ?? ''))}</div>
              </div>
            </div>

            <div class="mt-5">
              <div class="text-sm text-slate-500">Priority</div>
              <div class="mt-1 font-semibold">${escapeHtml(String(poi.priority ?? 0))}</div>
            </div>
          </div>
        </section>

        <section class="lg:col-span-7">
          <div class="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div id="detailMap" class="h-[520px] w-full"></div>
          </div>
          <div class="text-[11px] text-slate-400 mt-2">Bản đồ dùng dữ liệu từ OpenStreetMap.</div>
        </section>
      </div>
    `}
  `;

  if (!poi) return;
  if (!L) return;

  const map = L.map('detailMap');
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  const lat = Number(poi.lat);
  const lng = Number(poi.lng);
  const ll = [lat, lng];
  map.setView(ll, 16);

  // Force Leaflet to re-check container size (prevents gray/covered tiles)
  requestAnimationFrame(() => map.invalidateSize());
  setTimeout(() => map.invalidateSize(), 100);

  const marker = L.marker(ll).addTo(map);
  marker.bindTooltip(escapeHtml(poi.name ?? ''), { direction: 'top', offset: [0, -8], opacity: 0.95, sticky: true });
}

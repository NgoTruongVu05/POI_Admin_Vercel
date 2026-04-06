<?php
require_once __DIR__ . '/../auth.php';
require_login('login.php');

require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../layout.php';

if (session_status() !== PHP_SESSION_ACTIVE) {
  session_start();
}

function csrf_token(): string
{
  if (!isset($_SESSION['csrf_token']) || !is_string($_SESSION['csrf_token']) || $_SESSION['csrf_token'] === '') {
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
  }

  return $_SESSION['csrf_token'];
}

function verify_csrf(?string $token): bool
{
  $sessionToken = $_SESSION['csrf_token'] ?? '';
  if (!is_string($sessionToken) || $sessionToken === '' || !is_string($token)) {
    return false;
  }

  return hash_equals($sessionToken, $token);
}

$flashError = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST' && (string)($_POST['action'] ?? '') === 'delete_poi') {
  $id = trim((string)($_POST['id'] ?? ''));

  if (!verify_csrf($_POST['csrf_token'] ?? null)) {
    $flashError = 'Phiên làm việc không hợp lệ (CSRF). Vui lòng tải lại trang và thử lại.';
  } elseif ($id === '') {
    $flashError = 'Thiếu POI ID.';
  } else {
    try {
      $stmt = $conn->prepare('DELETE FROM pois WHERE id = :id');
      $stmt->execute([':id' => $id]);

      header('Location: ' . app_url('pages/pois.php'));
      exit();
    } catch (Throwable $e) {
      $flashError = 'Không thể xoá POI. Vui lòng thử lại.';
    }
  }
}

$pois = [];
try {
  $stmt = $conn->query('SELECT id, name, description, lat, lng FROM pois ORDER BY id DESC');
    $pois = $stmt->fetchAll(PDO::FETCH_ASSOC);
} catch (Throwable $e) {
    $pois = [];
}

layout_start('pois', 'Quản lý POIs | POI Admin');
?>

<div class="flex items-start justify-between gap-6">
    <div>
        <h1 class="text-2xl font-semibold">Quản lý POIs</h1>
        <p class="text-sm text-slate-500 mt-1">Thêm, sửa, xoá các điểm tham quan trên bản đồ.</p>
    </div>

    <a href="<?php echo htmlspecialchars(app_url('poi_form.php'), ENT_QUOTES, 'UTF-8'); ?>" class="inline-flex items-center gap-2 rounded-xl bg-blue-600 text-white px-4 py-2 text-sm font-semibold hover:bg-blue-700 transition">
        <i class="bi bi-plus-lg"></i>
        <span>Thêm POI mới</span>
    </a>
</div>

<div class="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
    <section class="lg:col-span-4">
        <div class="relative">
            <span class="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-400">
                <i class="bi bi-search"></i>
            </span>
            <input id="poiSearch" type="text" class="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition" placeholder="Tìm kiếm POI..." autocomplete="off" />
        </div>

        <div class="mt-4 bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div id="poiList" class="divide-y divide-slate-100">
            <?php if ($flashError !== '') : ?>
              <div class="px-5 py-4 text-sm text-rose-700 bg-rose-50 border-b border-rose-100">
                <?php echo htmlspecialchars($flashError, ENT_QUOTES, 'UTF-8'); ?>
              </div>
            <?php endif; ?>
                <?php if (empty($pois)) : ?>
                    <div class="px-5 py-6 text-sm text-slate-500 text-center">Không tìm thấy POI nào.</div>
                <?php else : ?>
                    <?php foreach ($pois as $poi) :
                    $id = (string)($poi['id'] ?? '');
                        $name = (string)($poi['name'] ?? '');
                        $desc = (string)($poi['description'] ?? '');
                        $lat = (float)($poi['lat'] ?? 0);
                        $lng = (float)($poi['lng'] ?? 0);
                      $searchTextRaw = $name . ' ' . $desc;
                        $searchText = function_exists('mb_strtolower')
                            ? mb_strtolower($searchTextRaw, 'UTF-8')
                            : strtolower($searchTextRaw);
                    ?>
                      <div
                        class="poi-row flex items-stretch justify-between gap-3 px-5 py-4 hover:bg-slate-50 transition"
                        data-id="<?php echo htmlspecialchars($id, ENT_QUOTES, 'UTF-8'); ?>"
                        data-lat="<?php echo $lat; ?>"
                        data-lng="<?php echo $lng; ?>"
                        data-search="<?php echo htmlspecialchars($searchText, ENT_QUOTES, 'UTF-8'); ?>"
                      >
                        <button type="button" class="poi-item flex items-start gap-3 text-left min-w-0 flex-1">
                          <div class="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mt-0.5">
                            <i class="bi bi-geo-alt"></i>
                          </div>
                          <div class="min-w-0 flex-1">
                            <div class="font-semibold truncate"><?php echo htmlspecialchars($name, ENT_QUOTES, 'UTF-8'); ?></div>
                            <div class="text-xs text-slate-500 truncate"><?php echo htmlspecialchars($desc, ENT_QUOTES, 'UTF-8'); ?></div>
                          </div>
                        </button>

                        <div class="shrink-0 flex items-start gap-2">
                          <button
                            type="button"
                            class="w-10 h-10 rounded-xl border border-slate-200 text-slate-500 hover:bg-white hover:text-slate-700 hover:border-slate-300 transition flex items-center justify-center"
                            title="Xem chi tiết"
                            aria-label="Xem chi tiết"
                            data-action="view-poi"
                            data-id="<?php echo htmlspecialchars($id, ENT_QUOTES, 'UTF-8'); ?>"
                          >
                            <i class="bi bi-eye"></i>
                          </button>

                          <a
                            href="<?php echo htmlspecialchars(app_url('poi_form.php?id=' . rawurlencode($id)), ENT_QUOTES, 'UTF-8'); ?>"
                            class="w-10 h-10 rounded-xl border border-slate-200 text-slate-500 hover:bg-white hover:text-blue-600 hover:border-blue-200 transition flex items-center justify-center"
                            title="Sửa POI"
                            aria-label="Sửa POI"
                          >
                            <i class="bi bi-pencil"></i>
                          </a>

                          <form method="post" action="<?php echo htmlspecialchars(app_url('pages/pois.php'), ENT_QUOTES, 'UTF-8'); ?>" class="flex items-start">
                            <input type="hidden" name="csrf_token" value="<?php echo htmlspecialchars(csrf_token(), ENT_QUOTES, 'UTF-8'); ?>" />
                            <input type="hidden" name="action" value="delete_poi" />
                            <input type="hidden" name="id" value="<?php echo htmlspecialchars($id, ENT_QUOTES, 'UTF-8'); ?>" />
                            <button
                              type="submit"
                              class="w-10 h-10 rounded-xl border border-slate-200 text-slate-500 hover:bg-white hover:text-rose-600 hover:border-rose-200 transition flex items-center justify-center"
                              title="Xoá POI"
                              aria-label="Xoá POI"
                              data-action="delete-poi"
                            >
                              <i class="bi bi-trash"></i>
                            </button>
                          </form>
                        </div>
                      </div>
                    <?php endforeach; ?>

                    <div id="poiEmptyRow" class="px-5 py-6 text-sm text-slate-500 text-center" style="display:none">Không tìm thấy POI nào.</div>
                <?php endif; ?>
            </div>
        </div>
    </section>

    <section class="lg:col-span-8">
        <div class="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div id="map" class="h-[540px] w-full"></div>
        </div>
        <div class="text-[11px] text-slate-400 mt-2">Bản đồ dùng dữ liệu từ OpenStreetMap.</div>
    </section>
</div>

<div id="poiDetailModal" class="fixed inset-0 z-[9999] hidden items-center justify-center bg-slate-900/40 px-4 py-6">
  <div class="w-[1100px] h-[720px] max-w-[calc(100vw-2rem)] max-h-[calc(100vh-3rem)] rounded-2xl bg-white border border-slate-200 overflow-hidden flex flex-col">
    <div class="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
      <div>
        <div class="text-lg font-semibold" id="poiDetailTitle">Chi tiết POI</div>
        <div class="text-xs text-slate-500 mt-0.5" id="poiDetailId"></div>
      </div>
      <button id="poiDetailCloseX" type="button" class="w-10 h-10 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 transition flex items-center justify-center" aria-label="Đóng">
        <i class="bi bi-x-lg"></i>
      </button>
    </div>

    <div class="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-0 min-h-0">
      <div class="lg:col-span-5 p-6 overflow-y-auto min-h-0">
        <div class="text-sm text-slate-500">Tên POI</div>
        <div class="mt-1 font-semibold" id="poiDetailName"></div>

        <div class="mt-5 text-sm text-slate-500">Mô tả</div>
        <div class="mt-1 text-sm text-slate-700 whitespace-pre-wrap break-words" id="poiDetailDesc"></div>
      </div>

      <div class="lg:col-span-7 border-t lg:border-t-0 lg:border-l border-slate-100 min-h-[320px] lg:min-h-0">
        <div id="poiDetailMap" class="h-[320px] lg:h-full w-full"></div>
      </div>
    </div>
  </div>
</div>

<div id="deletePoiModal" class="fixed inset-0 z-[9999] hidden items-center justify-center bg-slate-900/40 px-4">
  <div class="w-full max-w-md rounded-2xl bg-white border border-slate-200 p-6">
    <div class="text-lg font-semibold">Xoá POI</div>
    <div class="mt-2 text-sm text-slate-600">Bạn có chắc muốn xóa không?</div>

    <div class="mt-6 flex items-center justify-end gap-3">
      <button id="deletePoiCancel" type="button" class="inline-flex items-center rounded-xl bg-white border border-slate-200 text-slate-700 px-4 py-2 text-sm font-semibold hover:bg-slate-50 transition">
        Huỷ
      </button>
      <button id="deletePoiConfirm" type="button" class="inline-flex items-center rounded-xl bg-rose-600 text-white px-4 py-2 text-sm font-semibold hover:bg-rose-700 transition">
        Xoá
      </button>
    </div>
  </div>
</div>

<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
(function () {
  const pois = <?php echo json_encode($pois, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES); ?>;

  const map = L.map('map');
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  const markersById = new Map();
  const bounds = [];
  const GEOFENCE_RADIUS_M = 50;

  const geofenceCircleOptions = buildGeofenceCircleOptions();

  function buildGeofenceCircleOptions() {
    const stroke = getColorFromTailwindClass('text-blue-600');
    const fill = getColorFromTailwindClass('text-blue-500');
    const opts = {
      radius: GEOFENCE_RADIUS_M,
      weight: 2,
      opacity: 0.9,
      fillOpacity: 0.12,
      interactive: false
    };

    if (stroke) opts.color = stroke;
    if (fill) opts.fillColor = fill;
    return opts;
  }

  function getColorFromTailwindClass(className) {
    try {
      const el = document.createElement('span');
      el.className = className;
      el.style.position = 'absolute';
      el.style.left = '-9999px';
      el.style.top = '-9999px';
      document.body.appendChild(el);
      const color = getComputedStyle(el).color;
      el.remove();
      return (typeof color === 'string' && color.trim() !== '') ? color : null;
    } catch {
      return null;
    }
  }

  function addGeofenceCircle(mapInstance, ll) {
    return L.circle(ll, geofenceCircleOptions).addTo(mapInstance);
  }

  for (const poi of pois) {
    const id = (poi.id ?? '').toString();
    const lat = Number(poi.lat);
    const lng = Number(poi.lng);
    if (!id || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    addGeofenceCircle(map, [lat, lng]);
    const marker = L.marker([lat, lng]).addTo(map);
    const safeName = (poi.name ?? '').toString();
    marker.bindTooltip(escapeHtml(safeName), {
      direction: 'top',
      offset: [0, -8],
      opacity: 0.95,
      sticky: true
    });
    marker.bindPopup(
      `<div style="font-weight:600">${escapeHtml(safeName)}</div>`
    );

    marker.on('click', () => {
      openDetailModal(poi);
    });

    markersById.set(id, marker);
    bounds.push([lat, lng]);
  }

  if (bounds.length > 0) {
    map.fitBounds(bounds, { padding: [30, 30] });
  } else {
    map.setView([10.8231, 106.6297], 12);
  }

  const items = Array.from(document.querySelectorAll('.poi-item'));
  const rows = Array.from(document.querySelectorAll('.poi-row'));

  items.forEach((btn) => {
    btn.addEventListener('click', () => {
      const row = btn.closest('.poi-row');
      if (!row) return;

      const id = (row.dataset.id ?? '').toString();
      const lat = Number(row.dataset.lat);
      const lng = Number(row.dataset.lng);

      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        map.setView([lat, lng], 15, { animate: true });
      }

      const marker = markersById.get(id);
      if (marker) {
        marker.openPopup();
      }
    });
  });

  const search = document.getElementById('poiSearch');
  if (search) {
    search.addEventListener('input', () => {
      const q = (search.value || '').trim().toLowerCase();
      let visibleCount = 0;

      for (const row of rows) {
        const hay = (row.dataset.search || '');
        const isVisible = q === '' ? true : hay.includes(q);
        row.style.display = isVisible ? '' : 'none';
        if (isVisible) visibleCount++;
      }

      const emptyRow = document.getElementById('poiEmptyRow');
      if (emptyRow) {
        emptyRow.style.display = visibleCount === 0 ? '' : 'none';
      }
    });
  }

  function escapeHtml(str) {
    return str
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  // Delete confirmation modal
  const deleteModal = document.getElementById('deletePoiModal');
  const deleteCancel = document.getElementById('deletePoiCancel');
  const deleteConfirm = document.getElementById('deletePoiConfirm');
  const deleteButtons = Array.from(document.querySelectorAll('[data-action="delete-poi"]'));

  let pendingDeleteForm = null;

  function openDeleteModal(form) {
    pendingDeleteForm = form;
    if (!deleteModal) return;
    deleteModal.classList.remove('hidden');
    deleteModal.classList.add('flex');
    if (deleteCancel) deleteCancel.focus();
  }

  function closeDeleteModal() {
    pendingDeleteForm = null;
    if (!deleteModal) return;
    deleteModal.classList.add('hidden');
    deleteModal.classList.remove('flex');
  }

  deleteButtons.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const form = btn.closest('form');
      if (!form) return;
      openDeleteModal(form);
    });
  });

  if (deleteCancel) {
    deleteCancel.addEventListener('click', closeDeleteModal);
  }
  if (deleteConfirm) {
    deleteConfirm.addEventListener('click', () => {
      if (pendingDeleteForm) {
        pendingDeleteForm.submit();
      }
    });
  }

  // POI detail modal
  const detailModal = document.getElementById('poiDetailModal');
  const detailCloseX = document.getElementById('poiDetailCloseX');
  const detailIdEl = document.getElementById('poiDetailId');
  const detailNameEl = document.getElementById('poiDetailName');
  const detailDescEl = document.getElementById('poiDetailDesc');
  const viewButtons = Array.from(document.querySelectorAll('[data-action="view-poi"]'));

  let detailMap = null;
  let detailMarker = null;
  let detailCircle = null;

  function openDetailModal(poi) {
    if (!detailModal) return;

    const id = (poi?.id ?? '').toString();
    const name = (poi?.name ?? '').toString();
    const desc = (poi?.description ?? '').toString();
    const lat = Number(poi?.lat);
    const lng = Number(poi?.lng);

    if (detailIdEl) detailIdEl.textContent = id ? `ID: ${id}` : '';
    if (detailNameEl) detailNameEl.textContent = name;
    if (detailDescEl) detailDescEl.textContent = desc;

    detailModal.classList.remove('hidden');
    detailModal.classList.add('flex');

    // Init/update detail map
    const mapEl = document.getElementById('poiDetailMap');
    if (mapEl && typeof L !== 'undefined' && Number.isFinite(lat) && Number.isFinite(lng)) {
      const ll = [lat, lng];
      if (!detailMap) {
        detailMap = L.map('poiDetailMap');
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap contributors'
        }).addTo(detailMap);
      }

      if (!detailCircle) {
        detailCircle = addGeofenceCircle(detailMap, ll);
      } else {
        detailCircle.setLatLng(ll);
      }

      if (!detailMarker) {
        detailMarker = L.marker(ll).addTo(detailMap);
      } else {
        detailMarker.setLatLng(ll);
      }

      if (detailMarker.getTooltip && detailMarker.getTooltip()) {
        detailMarker.setTooltipContent(escapeHtml(name));
      } else {
        detailMarker.bindTooltip(escapeHtml(name), {
          direction: 'top',
          offset: [0, -8],
          opacity: 0.95,
          sticky: true
        });
      }

      detailMap.setView(ll, 16);
      detailMarker.bindPopup(
        `<div style="font-weight:600">${escapeHtml(name)}</div>`
      );
      detailMarker.openPopup();

      setTimeout(() => {
        detailMap.invalidateSize();
        detailMap.setView(ll, 16);
      }, 0);
    }
  }

  function closeDetailModal() {
    if (!detailModal) return;
    detailModal.classList.add('hidden');
    detailModal.classList.remove('flex');
  }

  viewButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = (btn.dataset.id ?? '').toString();
      const poi = pois.find((p) => (p?.id ?? '').toString() === id);
      if (!poi) return;
      openDetailModal(poi);
    });
  });

  if (detailCloseX) detailCloseX.addEventListener('click', closeDetailModal);
  if (detailModal) {
    detailModal.addEventListener('click', (e) => {
      if (e.target === detailModal) closeDetailModal();
    });
  }
})();
</script>

<?php layout_end(); ?>

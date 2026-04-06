<?php

declare(strict_types=1);

require_once __DIR__ . '/auth.php';
require_login('pages/login.php');

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/layout.php';

if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}

function csrf_token(): string
{
    if (!isset($_SESSION['csrf_token']) || !is_string($_SESSION['csrf_token']) || $_SESSION['csrf_token'] == '') {
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

function str_len(string $value): int
{
    return function_exists('mb_strlen') ? mb_strlen($value, 'UTF-8') : strlen($value);
}

$values = [
    'id' => '',
    'name' => '',
    'description' => '',
    'lat' => '',
    'lng' => '',
];

$errors = [];
$success = false;

$mode = 'add';
$editId = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $mode = (string)($_POST['mode'] ?? 'add');
    $mode = $mode === 'edit' ? 'edit' : 'add';
} else {
    $editId = trim((string)($_GET['id'] ?? ''));
    $mode = $editId !== '' ? 'edit' : 'add';
}

$isEdit = $mode === 'edit';

if ($_SERVER['REQUEST_METHOD'] !== 'POST' && $isEdit) {
    $editId = trim((string)($_GET['id'] ?? ''));
    if ($editId !== '') {
        try {
            $stmt = $conn->prepare('SELECT id, name, description, lat, lng FROM pois WHERE id = :id LIMIT 1');
            $stmt->execute([':id' => $editId]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            if (is_array($row) && (string)($row['id'] ?? '') !== '') {
                $values['id'] = (string)$row['id'];
                $values['name'] = (string)($row['name'] ?? '');
                $values['description'] = (string)($row['description'] ?? '');
                $values['lat'] = (string)($row['lat'] ?? '');
                $values['lng'] = (string)($row['lng'] ?? '');
            } else {
                $errors[] = 'Không tìm thấy POI để sửa.';
                $mode = 'add';
                $isEdit = false;
            }
        } catch (Throwable $e) {
            $errors[] = 'Không thể tải dữ liệu POI.';
            $mode = 'add';
            $isEdit = false;
        }
    } else {
        $errors[] = 'Thiếu POI ID.';
        $mode = 'add';
        $isEdit = false;
    }
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST' && !$isEdit) {
    // Suggest next ID (best-effort)
    try {
        $lastId = (string)($conn->query('SELECT id FROM pois ORDER BY id DESC LIMIT 1')->fetchColumn() ?: '');
        if ($lastId !== '' && preg_match('/^poi_(\d+)$/i', $lastId, $m)) {
            $next = (int)$m[1] + 1;
            $values['id'] = 'poi_' . str_pad((string)$next, 2, '0', STR_PAD_LEFT);
        }
    } catch (Throwable $e) {
        // ignore
    }
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $values['id'] = trim((string)($_POST['id'] ?? ''));
    $values['name'] = trim((string)($_POST['name'] ?? ''));
    $values['description'] = trim((string)($_POST['description'] ?? ''));
    $values['lat'] = trim((string)($_POST['lat'] ?? ''));
    $values['lng'] = trim((string)($_POST['lng'] ?? ''));

    if (!verify_csrf($_POST['csrf_token'] ?? null)) {
        $errors[] = 'Phiên làm việc không hợp lệ (CSRF). Vui lòng tải lại trang và thử lại.';
    }

    if ($values['id'] === '') {
        $errors[] = 'Vui lòng nhập Mã POI (ID).';
    } elseif (str_len($values['id']) > 50) {
        $errors[] = 'Mã POI (ID) tối đa 50 ký tự.';
    } elseif (!preg_match('/^[A-Za-z0-9_-]+$/', $values['id'])) {
        $errors[] = 'Mã POI (ID) chỉ nên gồm chữ, số, dấu gạch dưới (_) hoặc gạch ngang (-).';
    }

    if ($values['name'] === '') {
        $errors[] = 'Vui lòng nhập Tên POI.';
    } elseif (str_len($values['name']) > 200) {
        $errors[] = 'Tên POI tối đa 200 ký tự.';
    }

    if ($values['lat'] === '' || !is_numeric($values['lat'])) {
        $errors[] = 'Vui lòng nhập Latitude hợp lệ.';
    }

    if ($values['lng'] === '' || !is_numeric($values['lng'])) {
        $errors[] = 'Vui lòng nhập Longitude hợp lệ.';
    }

    if (empty($errors)) {
        $lat = (float)$values['lat'];
        $lng = (float)$values['lng'];

        if ($lat < -90 || $lat > 90) {
            $errors[] = 'Latitude phải nằm trong [-90, 90].';
        }
        if ($lng < -180 || $lng > 180) {
            $errors[] = 'Longitude phải nằm trong [-180, 180].';
        }

        if (empty($errors)) {
            try {
                if ($mode === 'edit') {
                    $stmt = $conn->prepare('UPDATE pois SET name = :name, description = :description, lat = :lat, lng = :lng WHERE id = :id');
                    $stmt->execute([
                        ':id' => $values['id'],
                        ':name' => $values['name'],
                        ':description' => $values['description'] === '' ? null : $values['description'],
                        ':lat' => $lat,
                        ':lng' => $lng,
                    ]);

                    if ($stmt->rowCount() === 0) {
                        // Could be "no changes" or not found; verify existence
                        $check = $conn->prepare('SELECT 1 FROM pois WHERE id = :id');
                        $check->execute([':id' => $values['id']]);
                        if (!$check->fetchColumn()) {
                            $errors[] = 'POI không tồn tại hoặc đã bị xoá.';
                        }
                    }
                } else {
                    $stmt = $conn->prepare('INSERT INTO pois (id, name, description, lat, lng) VALUES (:id, :name, :description, :lat, :lng)');
                    $stmt->execute([
                        ':id' => $values['id'],
                        ':name' => $values['name'],
                        ':description' => $values['description'] === '' ? null : $values['description'],
                        ':lat' => $lat,
                        ':lng' => $lng,
                    ]);
                }

                if (empty($errors)) {
                    try {
                        $stmtTranslation = $conn->prepare('INSERT INTO poitranslations (poiId, langCode, description) VALUES (:poiId, :langCode, :description) ON DUPLICATE KEY UPDATE description = VALUES(description)');
                        $stmtTranslation->execute([
                            ':poiId' => $values['id'],
                            ':langCode' => 'vi',
                            ':description' => $values['description'] === '' ? null : $values['description'],
                        ]);
                    } catch (Throwable $inner) {
                        // Nếu đồng bộ dịch thất bại, vẫn giữ POI chính.
                    }

                    header('Location: ' . app_url('pages/pois.php'));
                    exit();
                }
            } catch (PDOException $e) {
                // 23000 = integrity constraint violation (e.g., duplicate PK)
                if ((string)$e->getCode() === '23000') {
                    $errors[] = $mode === 'edit'
                        ? 'Không thể lưu POI. Vui lòng thử lại.'
                        : 'Mã POI (ID) đã tồn tại. Vui lòng chọn ID khác.';
                } else {
                    $errors[] = 'Không thể lưu POI. Vui lòng thử lại.';
                }
            } catch (Throwable $e) {
                $errors[] = 'Không thể lưu POI. Vui lòng thử lại.';
            }
        }
    }
}

$pageTitle = $isEdit ? 'Sửa POI | POI Admin' : 'Thêm POI mới | POI Admin';
$pageHeading = $isEdit ? 'Sửa POI' : 'Thêm POI mới';
$pageSub = $isEdit ? 'Cập nhật thông tin điểm tham quan.' : 'Nhập thông tin điểm tham quan để thêm vào hệ thống.';

layout_start('pois', $pageTitle);
?>

<div class="flex items-start justify-between gap-6">
    <div>
        <h1 class="text-2xl font-semibold"><?php echo htmlspecialchars($pageHeading, ENT_QUOTES, 'UTF-8'); ?></h1>
        <p class="text-sm text-slate-500 mt-1"><?php echo htmlspecialchars($pageSub, ENT_QUOTES, 'UTF-8'); ?></p>
    </div>

    <a href="<?php echo htmlspecialchars(app_url('pages/pois.php'), ENT_QUOTES, 'UTF-8'); ?>" class="inline-flex items-center gap-2 rounded-xl bg-white border border-slate-200 text-slate-700 px-4 py-2 text-sm font-semibold hover:bg-slate-50 transition">
        <i class="bi bi-arrow-left"></i>
        <span>Quay lại</span>
    </a>
</div>

<?php if (!empty($errors)) : ?>
    <div class="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
        <div class="font-semibold mb-1">Không thể lưu POI</div>
        <ul class="list-disc pl-5 space-y-0.5">
            <?php foreach ($errors as $err) : ?>
                <li><?php echo htmlspecialchars((string)$err, ENT_QUOTES, 'UTF-8'); ?></li>
            <?php endforeach; ?>
        </ul>
    </div>
<?php endif; ?>

<form method="post" action="<?php echo htmlspecialchars(app_url('poi_form.php'), ENT_QUOTES, 'UTF-8'); ?>" class="mt-6 bg-white border border-slate-200 rounded-2xl p-6" autocomplete="off">
    <input type="hidden" name="csrf_token" value="<?php echo htmlspecialchars(csrf_token(), ENT_QUOTES, 'UTF-8'); ?>" />
    <input type="hidden" name="mode" value="<?php echo $isEdit ? 'edit' : 'add'; ?>" />

    <?php if ($isEdit) : ?>
        <input type="hidden" name="id" value="<?php echo htmlspecialchars($values['id'], ENT_QUOTES, 'UTF-8'); ?>" />
    <?php endif; ?>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
        <?php if (!$isEdit) : ?>
            <label class="block">
                <div class="text-sm font-semibold text-slate-700">Mã POI (ID) <span class="text-rose-600">*</span></div>
                <input name="id" value="<?php echo htmlspecialchars($values['id'], ENT_QUOTES, 'UTF-8'); ?>" class="mt-2 w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition" placeholder="poi_04" required maxlength="50" />
                <div class="mt-1 text-xs text-slate-500">Ví dụ: <span class="font-mono">poi_04</span> (không dấu cách).</div>
            </label>
        <?php endif; ?>

        <label class="block md:col-span-2">
            <div class="text-sm font-semibold text-slate-700">Tên POI <span class="text-rose-600">*</span></div>
            <input name="name" value="<?php echo htmlspecialchars($values['name'], ENT_QUOTES, 'UTF-8'); ?>" class="mt-2 w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition" placeholder="Nhập tên địa điểm..." required maxlength="200" />
        </label>

        <label class="block md:col-span-2">
            <div class="text-sm font-semibold text-slate-700">Mô tả</div>
            <textarea name="description" rows="4" class="mt-2 w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition" placeholder="Mô tả ngắn..."><?php echo htmlspecialchars($values['description'], ENT_QUOTES, 'UTF-8'); ?></textarea>
        </label>

        <label class="block">
            <div class="text-sm font-semibold text-slate-700">Latitude <span class="text-rose-600">*</span></div>
            <input id="poiLat" name="lat" value="<?php echo htmlspecialchars($values['lat'], ENT_QUOTES, 'UTF-8'); ?>" class="mt-2 w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition" placeholder="10.762622" required inputmode="decimal" autocomplete="off" />
        </label>

        <label class="block">
            <div class="text-sm font-semibold text-slate-700">Longitude <span class="text-rose-600">*</span></div>
            <input id="poiLng" name="lng" value="<?php echo htmlspecialchars($values['lng'], ENT_QUOTES, 'UTF-8'); ?>" class="mt-2 w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition" placeholder="106.660172" required inputmode="decimal" autocomplete="off" />
        </label>

        <div class="md:col-span-2">
            <div class="text-sm font-semibold text-slate-700">Chọn vị trí trên bản đồ <span class="text-rose-600">*</span></div>
            <div class="mt-2 bg-white border border-slate-200 rounded-2xl overflow-hidden">
                <div id="poiMap" class="h-[420px] w-full"></div>
            </div>
            <div class="mt-2 text-xs text-slate-500">Click lên bản đồ để đặt marker (có thể kéo marker để tinh chỉnh). Lat/Lng sẽ tự cập nhật.</div>
        </div>
    </div>

    <div class="mt-6 flex items-center justify-end gap-3">
        <a href="<?php echo htmlspecialchars(app_url('pages/pois.php'), ENT_QUOTES, 'UTF-8'); ?>" class="inline-flex items-center gap-2 rounded-xl bg-white border border-slate-200 text-slate-700 px-4 py-2 text-sm font-semibold hover:bg-slate-50 transition">
            Huỷ
        </a>
        <button type="submit" class="inline-flex items-center gap-2 rounded-xl bg-blue-600 text-white px-4 py-2 text-sm font-semibold hover:bg-blue-700 transition">
            <i class="bi bi-check2"></i>
            <span>Lưu POI</span>
        </button>
    </div>
</form>

<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
(function () {
    const latInput = document.getElementById('poiLat');
    const lngInput = document.getElementById('poiLng');
    const mapEl = document.getElementById('poiMap');
    if (!latInput || !lngInput || !mapEl || typeof L === 'undefined') return;

    // Ho Chi Minh City (District 1) as default focus
    const defaultCenter = [10.7769, 106.7009];
    const serverHasCoords = <?php echo ($values['lat'] !== '' && $values['lng'] !== '') ? 'true' : 'false'; ?>;
    const initialLat = Number((latInput.value || '').trim());
    const initialLng = Number((lngInput.value || '').trim());
    const hasInitial = serverHasCoords && Number.isFinite(initialLat) && Number.isFinite(initialLng);

    const map = L.map('poiMap');
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    let marker = null;

    function setLatLng(lat, lng, shouldPan) {
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

        const fixedLat = Number(lat.toFixed(6));
        const fixedLng = Number(lng.toFixed(6));

        latInput.value = String(fixedLat);
        lngInput.value = String(fixedLng);

        const ll = [fixedLat, fixedLng];
        if (!marker) {
            marker = L.marker(ll, { draggable: true }).addTo(map);
            marker.on('dragend', () => {
                const p = marker.getLatLng();
                setLatLng(p.lat, p.lng, false);
            });
        } else {
            marker.setLatLng(ll);
        }

        if (shouldPan) {
            map.setView(ll, Math.max(map.getZoom(), 15), { animate: true });
        }
    }

    if (hasInitial) {
        map.setView([initialLat, initialLng], 15);
        setLatLng(initialLat, initialLng, false);
    } else {
        map.setView(defaultCenter, 13);
    }

    // In case the map renders before layout is fully settled
    setTimeout(() => {
        map.invalidateSize();
        if (hasInitial) {
            map.setView([initialLat, initialLng], 15);
        } else {
            map.setView(defaultCenter, 13);
        }
    }, 0);

    map.on('click', (e) => {
        setLatLng(e.latlng.lat, e.latlng.lng, true);
    });

    function syncFromInputs() {
        const lat = Number((latInput.value || '').trim());
        const lng = Number((lngInput.value || '').trim());
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
        setLatLng(lat, lng, false);
    }

    latInput.addEventListener('change', syncFromInputs);
    lngInput.addEventListener('change', syncFromInputs);
})();
</script>

<?php layout_end(); ?>

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

function normalize_code(string $value): string
{
    return mb_strtolower(trim($value), 'UTF-8');
}

$flashSuccess = '';
$flashError = '';
$errors = [];
$mode = 'add';
$values = [
    'code' => '',
    'name' => '',
    'isActive' => '1',
];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!verify_csrf($_POST['csrf_token'] ?? null)) {
        $flashError = 'Phiên làm việc không hợp lệ. Vui lòng tải lại trang và thử lại.';
    } else {
        $action = (string)($_POST['action'] ?? '');
        $values['code'] = normalize_code((string)($_POST['code'] ?? ''));
        $values['name'] = trim((string)($_POST['name'] ?? ''));
        $values['isActive'] = isset($_POST['isActive']) && ((string)$_POST['isActive'] === '1') ? '1' : '0';

        if ($action === 'toggle_status') {
            $code = normalize_code((string)($_POST['code'] ?? ''));
            if ($code === '') {
                $flashError = 'Thiếu mã ngôn ngữ.';
            } else {
                try {
                    $stmt = $conn->prepare('UPDATE languages SET isActive = NOT isActive WHERE code = :code');
                    $stmt->execute([':code' => $code]);
                    $flashSuccess = 'Đã cập nhật trạng thái ngôn ngữ.';
                } catch (Throwable $e) {
                    $flashError = 'Không thể cập nhật trạng thái ngôn ngữ.';
                }
            }
        } elseif ($action === 'save_language') {
            if ($values['code'] === '') {
                $errors[] = 'Vui lòng nhập mã ngôn ngữ.';
            } elseif (!preg_match('/^[a-z]{2}$/', $values['code'])) {
                $errors[] = 'Mã ngôn ngữ phải gồm 2 chữ cái (ví dụ: vi, en).';
            }

            if ($values['name'] === '') {
                $errors[] = 'Vui lòng nhập tên ngôn ngữ.';
            } elseif (mb_strlen($values['name'], 'UTF-8') > 100) {
                $errors[] = 'Tên ngôn ngữ tối đa 100 ký tự.';
            }

            if (empty($errors)) {
                try {
                    if ((string)($_POST['mode'] ?? 'add') === 'edit') {
                        $mode = 'edit';
                        $stmt = $conn->prepare('UPDATE languages SET name = :name, isActive = :isActive WHERE code = :code');
                        $stmt->execute([
                            ':code' => $values['code'],
                            ':name' => $values['name'],
                            ':isActive' => $values['isActive'],
                        ]);
                        $flashSuccess = 'Cập nhật ngôn ngữ thành công.';
                    } else {
                        $stmt = $conn->prepare('INSERT INTO languages (code, name, isActive) VALUES (:code, :name, :isActive)');
                        $stmt->execute([
                            ':code' => $values['code'],
                            ':name' => $values['name'],
                            ':isActive' => $values['isActive'],
                        ]);
                        $flashSuccess = 'Thêm ngôn ngữ mới thành công.';
                    }
                } catch (PDOException $e) {
                    if ((string)$e->getCode() === '23000') {
                        $errors[] = 'Mã ngôn ngữ đã tồn tại. Vui lòng chọn mã khác.';
                    } else {
                        $errors[] = 'Không thể lưu ngôn ngữ. Vui lòng thử lại.';
                    }
                } catch (Throwable $e) {
                    $errors[] = 'Không thể lưu ngôn ngữ. Vui lòng thử lại.';
                }
            }
        }
    }
}

$editCode = '';
if ($_SERVER['REQUEST_METHOD'] !== 'POST' && isset($_GET['code'])) {
    $editCode = normalize_code((string)($_GET['code']));
    if ($editCode !== '') {
        try {
            $stmt = $conn->prepare('SELECT code, name, isActive FROM languages WHERE code = :code LIMIT 1');
            $stmt->execute([':code' => $editCode]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($row) {
                $values['code'] = (string)($row['code'] ?? '');
                $values['name'] = (string)($row['name'] ?? '');
                $values['isActive'] = ((int)$row['isActive'] === 1) ? '1' : '0';
                $mode = 'edit';
            } else {
                $flashError = 'Không tìm thấy ngôn ngữ để sửa.';
            }
        } catch (Throwable $e) {
            $flashError = 'Không thể tải thông tin ngôn ngữ.';
        }
    }
}

$languages = [];
try {
    $stmt = $conn->query('SELECT code, name, isActive FROM languages ORDER BY code ASC');
    $languages = $stmt->fetchAll(PDO::FETCH_ASSOC);
} catch (Throwable $e) {
    $languages = [];
}

layout_start('languages', 'Quản lý Ngôn ngữ | POI Admin');
?>

<div class="flex items-start justify-between gap-6">
    <div>
        <h1 class="text-2xl font-semibold">Quản lý Ngôn ngữ</h1>
        <p class="text-sm text-slate-500 mt-1">Thêm, sửa và bật/tắt trạng thái ngôn ngữ.</p>
    </div>

    <a href="<?php echo htmlspecialchars(app_url('pages/languages.php'), ENT_QUOTES, 'UTF-8'); ?>" class="inline-flex items-center gap-2 rounded-xl bg-blue-600 text-white px-4 py-2 text-sm font-semibold hover:bg-blue-700 transition">
        <i class="bi bi-plus-lg"></i>
        <span>Thêm ngôn ngữ mới</span>
    </a>
</div>

<?php if ($flashSuccess !== '') : ?>
    <div class="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-700">
        <?php echo htmlspecialchars($flashSuccess, ENT_QUOTES, 'UTF-8'); ?>
    </div>
<?php endif; ?>

<?php if ($flashError !== '') : ?>
    <div class="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
        <?php echo htmlspecialchars($flashError, ENT_QUOTES, 'UTF-8'); ?>
    </div>
<?php endif; ?>

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
                        <?php if (empty($languages)) : ?>
                            <tr>
                                <td class="px-4 py-4 text-sm text-slate-500" colspan="4">Chưa có ngôn ngữ nào.</td>
                            </tr>
                        <?php else : ?>
                            <?php foreach ($languages as $language) :
                                $code = htmlspecialchars((string)($language['code'] ?? ''), ENT_QUOTES, 'UTF-8');
                                $name = htmlspecialchars((string)($language['name'] ?? ''), ENT_QUOTES, 'UTF-8');
                                $isActive = ((int)$language['isActive'] === 1);
                            ?>
                                <tr class="border-t border-slate-100">
                                    <td class="px-4 py-4 text-sm font-semibold"><?php echo $code; ?></td>
                                    <td class="px-4 py-4 text-sm"><?php echo $name; ?></td>
                                    <td class="px-4 py-4 text-sm">
                                        <span class="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold <?php echo $isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'; ?>">
                                            <?php echo $isActive ? 'Hoạt động' : 'Tạm ngưng'; ?>
                                        </span>
                                    </td>
                                    <td class="px-4 py-4 text-sm">
                                        <div class="flex flex-wrap gap-2">
                                            <a href="<?php echo htmlspecialchars(app_url('pages/languages.php?code=' . rawurlencode($code)), ENT_QUOTES, 'UTF-8'); ?>" class="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-600 text-xs font-semibold hover:bg-slate-50 transition">
                                                <i class="bi bi-pencil"></i>
                                                Sửa
                                            </a>
                                            <form method="post" class="inline-block">
                                                <input type="hidden" name="csrf_token" value="<?php echo htmlspecialchars(csrf_token(), ENT_QUOTES, 'UTF-8'); ?>" />
                                                <input type="hidden" name="action" value="toggle_status" />
                                                <input type="hidden" name="code" value="<?php echo $code; ?>" />
                                                <button type="submit" class="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-600 text-xs font-semibold hover:bg-slate-50 transition">
                                                    <i class="bi <?php echo $isActive ? 'bi-toggle2-on' : 'bi-toggle2-off'; ?>"></i>
                                                    <?php echo $isActive ? 'Tắt' : 'Bật'; ?>
                                                </button>
                                            </form>
                                        </div>
                                    </td>
                                </tr>
                            <?php endforeach; ?>
                        <?php endif; ?>
                    </tbody>
                </table>
            </div>
        </div>
    </section>

    <section class="xl:col-span-5">
        <div class="bg-white border border-slate-200 rounded-2xl p-6">
            <h2 class="text-lg font-semibold"><?php echo $mode === 'edit' ? 'Chỉnh sửa ngôn ngữ' : 'Thêm ngôn ngữ mới'; ?></h2>
            <p class="text-sm text-slate-500 mt-1">Nhập mã, tên và trạng thái của ngôn ngữ.</p>

            <?php if (!empty($errors)) : ?>
                <div class="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    <ul class="list-disc pl-5 space-y-1">
                        <?php foreach ($errors as $error) : ?>
                            <li><?php echo htmlspecialchars((string)$error, ENT_QUOTES, 'UTF-8'); ?></li>
                        <?php endforeach; ?>
                    </ul>
                </div>
            <?php endif; ?>

            <form method="post" class="mt-6 space-y-5">
                <input type="hidden" name="csrf_token" value="<?php echo htmlspecialchars(csrf_token(), ENT_QUOTES, 'UTF-8'); ?>" />
                <input type="hidden" name="action" value="save_language" />
                <input type="hidden" name="mode" value="<?php echo $mode === 'edit' ? 'edit' : 'add'; ?>" />

                <label class="block">
                    <div class="text-sm font-semibold text-slate-700">Mã ngôn ngữ <span class="text-rose-600">*</span></div>
                    <input name="code" value="<?php echo htmlspecialchars($values['code'], ENT_QUOTES, 'UTF-8'); ?>" <?php echo $mode === 'edit' ? 'readonly' : ''; ?> class="mt-2 w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition" placeholder="vi" maxlength="2" <?php echo $mode === 'edit' ? 'aria-readonly="true"' : ''; ?> required />
                    <div class="mt-1 text-xs text-slate-500">Mã gồm 2 chữ cái, ví dụ: <span class="font-mono">vi</span>, <span class="font-mono">en</span>.</div>
                </label>

                <label class="block">
                    <div class="text-sm font-semibold text-slate-700">Tên ngôn ngữ <span class="text-rose-600">*</span></div>
                    <input name="name" value="<?php echo htmlspecialchars($values['name'], ENT_QUOTES, 'UTF-8'); ?>" class="mt-2 w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition" placeholder="Tiếng Việt" maxlength="100" required />
                </label>

                <label class="flex items-center gap-3">
                    <input type="checkbox" name="isActive" value="1" <?php echo $values['isActive'] === '1' ? 'checked' : ''; ?> class="h-4 w-4 text-blue-600 border-slate-300 rounded" />
                    <span class="text-sm text-slate-700">Kích hoạt ngôn ngữ</span>
                </label>

                <div class="flex items-center justify-end gap-3">
                    <?php if ($mode === 'edit') : ?>
                        <a href="<?php echo htmlspecialchars(app_url('pages/languages.php'), ENT_QUOTES, 'UTF-8'); ?>" class="inline-flex items-center gap-2 rounded-xl bg-white border border-slate-200 text-slate-700 px-4 py-2 text-sm font-semibold hover:bg-slate-50 transition">Huỷ</a>
                    <?php endif; ?>
                    <button type="submit" class="inline-flex items-center gap-2 rounded-xl bg-blue-600 text-white px-4 py-2 text-sm font-semibold hover:bg-blue-700 transition">
                        <i class="bi bi-check2"></i>
                        <span><?php echo $mode === 'edit' ? 'Cập nhật' : 'Thêm'; ?></span>
                    </button>
                </div>
            </form>
        </div>
    </section>
</div>

<?php layout_end(); ?>

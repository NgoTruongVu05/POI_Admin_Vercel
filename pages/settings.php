<?php
require_once __DIR__ . '/../auth.php';
require_login('login.php');

require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../layout.php';

$success = '';
$error = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $current = (string)($_POST['current_password'] ?? '');
    $new = (string)($_POST['new_password'] ?? '');
    $confirm = (string)($_POST['confirm_password'] ?? '');

    if ($new === '' || $confirm === '' || $current === '') {
        $error = 'Vui lòng nhập đầy đủ thông tin.';
    } elseif ($new !== $confirm) {
        $error = 'Mật khẩu mới và xác nhận mật khẩu không khớp.';
    } else {
        try {
            $uid = (int)($_SESSION['user_id'] ?? 0);
            $stmt = $conn->prepare('SELECT uid, password FROM users WHERE uid = :uid');
            $stmt->execute(['uid' => $uid]);
            $user = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$user) {
                $error = 'Không tìm thấy tài khoản.';
            } elseif ((string)$user['password'] !== $current) {
                $error = 'Mật khẩu hiện tại không đúng.';
            } else {
                $upd = $conn->prepare('UPDATE users SET password = :pass WHERE uid = :uid');
                $upd->execute(['pass' => $new, 'uid' => $uid]);
                $success = 'Cập nhật mật khẩu thành công.';
            }
        } catch (Throwable $e) {
            $error = 'Có lỗi xảy ra khi cập nhật mật khẩu.';
        }
    }
}

layout_start('settings', 'Cài đặt | POI Admin');
?>

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
                <?php if ($success !== '') : ?>
                    <div class="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                        <?php echo htmlspecialchars($success, ENT_QUOTES, 'UTF-8'); ?>
                    </div>
                <?php endif; ?>

                <?php if ($error !== '') : ?>
                    <div class="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        <?php echo htmlspecialchars($error, ENT_QUOTES, 'UTF-8'); ?>
                    </div>
                <?php endif; ?>

                <form method="POST" class="space-y-4">
                    <div>
                        <label class="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Tài khoản</label>
                        <input type="text" value="<?php echo htmlspecialchars((string)($_SESSION['username'] ?? ''), ENT_QUOTES, 'UTF-8'); ?>" readonly class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
                    </div>

                    <div>
                        <label class="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Mật khẩu hiện tại</label>
                        <input name="current_password" type="password" class="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition" />
                    </div>

                    <div>
                        <label class="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Mật khẩu mới</label>
                        <input name="new_password" type="password" class="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition" placeholder="Nhập mật khẩu mới..." />
                    </div>

                    <div>
                        <label class="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Xác nhận mật khẩu mới</label>
                        <input name="confirm_password" type="password" class="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition" placeholder="Nhập lại mật khẩu mới..." />
                    </div>

                    <button type="submit" class="inline-flex items-center gap-2 rounded-xl bg-blue-600 text-white px-5 py-3 text-sm font-semibold hover:bg-blue-700 transition">
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
                <li>Thông tin này được lưu trữ an toàn trong trình duyệt của bạn.</li>
            </ul>
        </div>
    </div>
</div>

<?php layout_end(); ?>

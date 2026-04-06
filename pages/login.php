<?php
session_start();
include __DIR__ . '/../db.php';

$error = "";
$username_value = "";

if (isset($_SESSION['user_id'], $_SESSION['username'])) {
    header('Location: ../index.php');
    exit();
}

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $user_input = $_POST['username'];
    $password_input = $_POST['password'];
    $username_value = $user_input;

    // Truy vấn dùng Prepared Statement để chống SQL Injection
    $sql = "SELECT uid, username FROM users WHERE username = :user AND password = :pass";
    $stmt = $conn->prepare($sql);
    $stmt->execute(['user' => $user_input, 'pass' => $password_input]);

    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($user) {
        // Đăng nhập thành công
        session_regenerate_id(true);
        $_SESSION['user_id'] = $user['uid'];
        $_SESSION['username'] = $user['username'];

        header("Location: ../index.php");
        exit();
    } else {
        $error = "Tên đăng nhập hoặc mật khẩu không chính xác.";
    }
}
?>

<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Đăng nhập | POI Admin</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css" />
</head>

<body class="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center p-6">
    <div class="w-full max-w-md">
        <div class="bg-white border border-slate-100 rounded-3xl shadow-sm p-8">
            <div>
                <h1 class="text-2xl font-light tracking-tight">Đăng nhập</h1>
                <p class="text-sm text-slate-500 mt-1">POI Admin</p>
            </div>

            <?php if (!empty($error)) : ?>
                <div class="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    <?php echo htmlspecialchars($error); ?>
                </div>
            <?php endif; ?>

            <form method="POST" class="mt-6 space-y-5">
                <div>
                    <label class="block text-xs font-bold uppercase text-slate-400 mb-2 tracking-widest">Tên đăng nhập</label>
                    <div class="relative">
                        <span class="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-400">
                            <i class="bi bi-person"></i>
                        </span>
                        <input type="text" name="username" required
                            value="<?php echo htmlspecialchars($username_value); ?>"
                            class="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white focus:outline-none transition"
                            placeholder="admin">
                    </div>
                </div>

                <div>
                    <label class="block text-xs font-bold uppercase text-slate-400 mb-2 tracking-widest">Mật khẩu</label>
                    <div class="relative">
                        <span class="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-400">
                            <i class="bi bi-lock"></i>
                        </span>
                        <input type="password" name="password" required
                            class="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white focus:outline-none transition"
                            placeholder="••••••••">
                    </div>
                </div>

                <button type="submit" class="w-full rounded-xl bg-slate-900 px-4 py-3 text-white font-semibold hover:bg-slate-800 transition">
                    Đăng nhập
                </button>
            </form>
        </div>
    </div>
</body>
</html>

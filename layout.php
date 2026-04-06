<?php

declare(strict_types=1);

function app_base_path(): string
{
    $scriptName = (string)($_SERVER['SCRIPT_NAME'] ?? '/');
    $dir = str_replace('\\', '/', dirname($scriptName));
    $dir = rtrim($dir, '/');

    if ($dir === '') {
        $dir = '/';
    }

    if ($dir !== '/' && substr($dir, -6) === '/pages') {
        $dir = substr($dir, 0, -6);
        $dir = $dir === '' ? '/' : $dir;
    }

    return $dir;
}

function app_url(string $path): string
{
    $path = ltrim($path, '/');
    $base = app_base_path();
    if ($base === '/') {
        return '/' . $path;
    }

    return $base . '/' . $path;
}

function layout_start(string $activePage, string $title = 'POI Admin'): void
{
    if (session_status() !== PHP_SESSION_ACTIVE) {
        session_start();
    }

    $username = (string)($_SESSION['username'] ?? 'Admin');
    $usernameEsc = htmlspecialchars($username, ENT_QUOTES, 'UTF-8');
    $avatarLetter = strtoupper(substr($username, 0, 1));
    $avatarLetterEsc = htmlspecialchars($avatarLetter, ENT_QUOTES, 'UTF-8');

    $navItems = [
        ['href' => app_url('index.php'), 'key' => 'dashboard', 'label' => 'Dashboard', 'icon' => 'bi-grid'],
        ['href' => app_url('pages/pois.php'), 'key' => 'pois', 'label' => 'Quản lý POIs', 'icon' => 'bi-geo-alt'],
        ['href' => app_url('pages/languages.php'), 'key' => 'languages', 'label' => 'Quản lý Ngôn ngữ', 'icon' => 'bi-translate'],
    ];

    echo "<!DOCTYPE html>\n";
    echo "<html lang=\"vi\">\n";
    echo "<head>\n";
    echo "  <meta charset=\"utf-8\" />\n";
    echo "  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />\n";
    echo "  <title>" . htmlspecialchars($title, ENT_QUOTES, 'UTF-8') . "</title>\n";
    echo "  <script src=\"https://cdn.tailwindcss.com\"></script>\n";
    echo "  <link rel=\"stylesheet\" href=\"https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css\" />\n";
    echo "</head>\n";

    echo "<body class=\"bg-slate-50 text-slate-900\">\n";
    echo "  <a href=\"" . htmlspecialchars(app_url('pages/logout.php'), ENT_QUOTES, 'UTF-8') . "\" class=\"fixed bottom-6 left-6 z-40 inline-flex items-center gap-2 rounded-xl bg-white border border-slate-200 text-slate-700 px-4 py-2 text-sm font-semibold hover:bg-slate-50 transition\">\n";
    echo "    <i class=\"bi bi-box-arrow-right\"></i><span>Đăng xuất</span>\n";
    echo "  </a>\n";
    echo "  <div class=\"min-h-screen flex\">\n";

    // Sidebar
    echo "    <aside class=\"w-72 bg-white border-r border-slate-100 flex flex-col\">\n";
    echo "      <div class=\"px-6 py-5\">\n";
    echo "        <div class=\"text-xl font-semibold text-blue-600\">POI Admin</div>\n";
    echo "      </div>\n";

    echo "      <nav class=\"px-4 space-y-1\">\n";
    foreach ($navItems as $item) {
        $isActive = $activePage === $item['key'];
        $base = 'flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition';
        $cls = $isActive
            ? $base . ' bg-blue-50 text-blue-600'
            : $base . ' text-slate-600 hover:bg-slate-50';

        echo "        <a href=\"" . htmlspecialchars($item['href'], ENT_QUOTES, 'UTF-8') . "\" class=\"" . $cls . "\">";
        echo "<i class=\"bi " . htmlspecialchars($item['icon'], ENT_QUOTES, 'UTF-8') . "\"></i>";
        echo "<span>" . htmlspecialchars($item['label'], ENT_QUOTES, 'UTF-8') . "</span>";
        echo "</a>\n";
    }
    echo "      </nav>\n";

    echo "    </aside>\n";

    // Main
    echo "    <div class=\"flex-1 flex flex-col\">\n";

    // Topbar
    echo "      <header class=\"h-16 bg-white border-b border-slate-100 flex items-center justify-between px-8\">\n";
    echo "        <div></div>\n";

    echo "        <div class=\"flex items-center gap-3\">\n";
    $settingsBase = 'inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold transition';
    $settingsCls = $activePage === 'settings'
        ? $settingsBase . ' bg-blue-50 text-blue-600 border-blue-100'
        : $settingsBase . ' text-slate-600 hover:bg-slate-50';

    echo "          <a href=\"" . htmlspecialchars(app_url('pages/settings.php'), ENT_QUOTES, 'UTF-8') . "\" class=\"" . $settingsCls . "\" aria-label=\"Đổi mật khẩu\" title=\"Đổi mật khẩu\">\n";
    echo "            <i class=\"bi bi-shield-lock\"></i><span>Đổi mật khẩu</span>\n";
    echo "          </a>\n";
    echo "          <div class=\"text-sm text-slate-600\">" . $usernameEsc . "</div>\n";
    echo "          <div class=\"w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-semibold\">" . $avatarLetterEsc . "</div>\n";
    echo "        </div>\n";
    echo "      </header>\n";

    echo "      <main class=\"flex-1 px-8 py-6\">\n";
}

function layout_end(): void
{
    echo "      </main>\n";
    echo "    </div>\n";
    echo "  </div>\n";
    echo "</body>\n";
    echo "</html>\n";
}

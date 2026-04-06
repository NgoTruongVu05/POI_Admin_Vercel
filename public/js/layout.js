import { escapeHtml } from './ui.js';

export function renderLayout({ activeKey, title, user }) {
  document.title = title || 'POI Admin';

  const email = (user?.email ?? 'Admin').toString();
  const avatar = (email.trim()[0] || 'A').toUpperCase();

  const navItems = [
    { href: '/', key: 'dashboard', label: 'Dashboard', icon: 'bi-grid' },
    { href: '/pois', key: 'pois', label: 'Quản lý POIs', icon: 'bi-geo-alt' },
    { href: '/languages', key: 'languages', label: 'Quản lý Ngôn ngữ', icon: 'bi-translate' }
  ];

  const navHtml = navItems.map(item => {
    const isActive = activeKey === item.key;
    const base = 'flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition';
    const cls = isActive
      ? `${base} bg-blue-50 text-blue-600`
      : `${base} text-slate-600 hover:bg-slate-50`;

    return `
      <a href="${item.href}" class="${cls}">
        <i class="bi ${escapeHtml(item.icon)}"></i>
        <span>${escapeHtml(item.label)}</span>
      </a>
    `;
  }).join('');

  const settingsBase = 'inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold transition';
  const settingsCls = activeKey === 'settings'
    ? `${settingsBase} bg-blue-50 text-blue-600 border-blue-100`
    : `${settingsBase} text-slate-600 hover:bg-slate-50`;

  document.body.className = 'bg-slate-50 text-slate-900';
  document.body.innerHTML = `
    <a href="/logout" class="fixed bottom-6 left-6 z-40 inline-flex items-center gap-2 rounded-xl bg-white border border-slate-200 text-slate-700 px-4 py-2 text-sm font-semibold hover:bg-slate-50 transition">
      <i class="bi bi-box-arrow-right"></i><span>Đăng xuất</span>
    </a>

    <div class="min-h-screen flex">
      <aside class="w-72 bg-white border-r border-slate-100 flex flex-col">
        <div class="px-6 py-5">
          <div class="text-xl font-semibold text-blue-600">POI Admin</div>
        </div>
        <nav class="px-4 space-y-1">
          ${navHtml}
        </nav>
      </aside>

      <div class="flex-1 flex flex-col">
        <header class="h-16 bg-white border-b border-slate-100 flex items-center justify-between px-8">
          <div></div>
          <div class="flex items-center gap-3">
            <a href="/settings" class="${settingsCls}" aria-label="Đổi mật khẩu" title="Đổi mật khẩu">
              <i class="bi bi-shield-lock"></i><span>Đổi mật khẩu</span>
            </a>
            <div class="text-sm text-slate-600">${escapeHtml(email)}</div>
            <div class="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-semibold">${escapeHtml(avatar)}</div>
          </div>
        </header>

        <main class="flex-1 px-8 py-6" id="pageMain"></main>
      </div>
    </div>
  `;

  return document.getElementById('pageMain');
}

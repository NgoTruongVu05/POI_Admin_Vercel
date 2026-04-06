import { ensureConfigured } from '../bootstrap.js';
import { signOut } from '../auth.js';

if (!ensureConfigured()) {
  // config page already rendered
} else {
  document.body.className = 'min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center p-6';
  document.body.innerHTML = `
    <div class="text-sm text-slate-600">Đang đăng xuất...</div>
  `;

  try {
    await signOut();
  } catch {
    // ignore
  }

  window.location.href = '/login';
}

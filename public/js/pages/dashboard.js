import { ensureConfigured } from '../bootstrap.js';
import { requireAuth, getSession } from '../auth.js';
import { getSupabase } from '../supabaseClient.js';
import { renderLayout } from '../layout.js';
import { escapeHtml } from '../ui.js';

const HEARTBEAT_POLL_MS = 10000;
const HEARTBEAT_WINDOW_SECONDS = 60;
let heartbeatPollTimer = null;

if (!ensureConfigured()) {
  // config page already rendered
} else {
  const session = await requireAuth();
  if (session) {
    const main = renderLayout({ activeKey: 'dashboard', title: 'Dashboard | POI Admin', user: session.user });
    await render(main);
  }
}

async function render(main) {
  const supabase = getSupabase();

  const session = await getSession();
  const userId = session?.user?.id ?? '';
  const role = ((session?.user?.user_metadata?.role ?? '') || '').toString();

  let poiTotal = 0;
  let visitorTotal = 0;
  let recentPois = [];

  try {
    let countQuery = supabase.from('pois').select('*', { count: 'exact', head: true });
    if (role === 'manager' && userId) countQuery = countQuery.eq('user_id', userId);
    const countRes = await countQuery;

    poiTotal = countRes.count ?? 0;

    let recentQuery = supabase.from('pois').select('id,name').order('id', { ascending: false }).limit(2);
    if (role === 'manager' && userId) recentQuery = recentQuery.eq('user_id', userId);
    const recentRes = await recentQuery;

    if (recentRes.error) throw recentRes.error;
    recentPois = recentRes.data ?? [];
  } catch {
    poiTotal = 0;
    recentPois = [];
  }

  const heartbeatStats = await getHeartbeatStats(session);
  const visits = heartbeatStats.activeUsers;
  visitorTotal = heartbeatStats.totalVisitors;

  main.innerHTML = `
    <div>
      <h1 class="text-2xl font-semibold">Tổng quan hệ thống</h1>
      <p class="text-sm text-slate-500 mt-1">Chào mừng quay trở lại.</p>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mt-6">
      <div class="bg-white border border-slate-200 rounded-2xl p-5 flex items-center gap-4">
        <div class="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center"><i class="bi bi-geo-alt"></i></div>
        <div>
          <div class="text-xs text-slate-500">Tổng số POIs</div>
          <div class="text-2xl font-semibold mt-0.5">${escapeHtml(String(poiTotal))}</div>
        </div>
      </div>

      <div class="bg-white border border-slate-200 rounded-2xl p-5 flex items-center gap-4">
        <div class="w-12 h-12 rounded-2xl bg-orange-500 text-white flex items-center justify-center"><i class="bi bi-people"></i></div>
        <div>
          <div class="text-xs text-slate-500">Người dùng online</div>
          <div class="text-2xl font-semibold mt-0.5" data-active-users-count>${escapeHtml(String(visits))}</div>
        </div>
      </div>

      <div class="bg-white border border-slate-200 rounded-2xl p-5 flex items-center gap-4">
        <div class="w-12 h-12 rounded-2xl bg-violet-600 text-white flex items-center justify-center"><i class="bi bi-graph-up"></i></div>
        <div>
          <div class="text-xs text-slate-500">Số lượng du khách</div>
          <div class="text-2xl font-semibold mt-0.5">${escapeHtml(String(visitorTotal))}</div>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 xl:grid-cols-2 gap-6 mt-6">
      <section class="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div class="px-6 py-5 border-b border-slate-100 font-semibold">POIs mới thêm</div>
        <div class="px-6 py-6">
          ${recentPois.length === 0 ? `<div class="text-sm text-slate-500 text-center">Chưa có POI nào.</div>` : renderRecentPois(recentPois)}
        </div>
      </section>
    </div>
  `;

  startActiveUsersPolling(main, session);
}

function stopActiveUsersPolling() {
  if (heartbeatPollTimer) {
    clearInterval(heartbeatPollTimer);
    heartbeatPollTimer = null;
  }
}

function startActiveUsersPolling(main, session) {
  stopActiveUsersPolling();

  const tick = async () => {
    const target = main.querySelector('[data-active-users-count]');
    if (!target) {
      stopActiveUsersPolling();
      return;
    }

    const count = await getActiveUsersCount(session);
    target.textContent = String(count);
  };

  heartbeatPollTimer = setInterval(() => {
    void tick();
  }, HEARTBEAT_POLL_MS);
}

async function getActiveUsersCount(session) {
  const stats = await getHeartbeatStats(session);
  return stats.activeUsers;
}

async function getHeartbeatStats(session) {
  const accessToken = (session?.access_token ?? '').toString();
  if (!accessToken) return { activeUsers: 0, totalVisitors: 0 };

  try {
    const response = await fetch(`/api/heartbeat?window_seconds=${HEARTBEAT_WINDOW_SECONDS}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    if (!response.ok) return { activeUsers: 0, totalVisitors: 0 };
    const payload = await response.json();
    const activeUsersValue = Number(payload?.active_users ?? 0);
    const totalVisitorsValue = Number(payload?.total_visitors ?? 0);

    return {
      activeUsers: Number.isFinite(activeUsersValue) && activeUsersValue >= 0 ? activeUsersValue : 0,
      totalVisitors: Number.isFinite(totalVisitorsValue) && totalVisitorsValue >= 0 ? totalVisitorsValue : 0
    };
  } catch {
    return { activeUsers: 0, totalVisitors: 0 };
  }
}

function renderRecentPois(items) {
  const rows = items.map(poi => {
    const name = (poi?.name ?? '').toString();
    return `
      <div class="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center"><i class="bi bi-geo-alt"></i></div>
          <div class="min-w-0">
            <div class="font-semibold truncate">${escapeHtml(name)}</div>
            <div class="text-xs text-slate-500 truncate">POI mới</div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  return `<div class="space-y-3">${rows}</div>`;
}

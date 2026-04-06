<?php
require_once __DIR__ . '/auth.php';
require_login('pages/login.php');

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/layout.php';

$poiTotal = 0;
$visits = 1284;
$growth = '+12%';

$recentPois = [];

try {
	$poiTotal = (int)$conn->query('SELECT COUNT(*) FROM pois')->fetchColumn();
	$recentPoisStmt = $conn->query('SELECT id, name FROM pois ORDER BY id DESC LIMIT 2');
	$recentPois = $recentPoisStmt->fetchAll(PDO::FETCH_ASSOC);
} catch (Throwable $e) {
	$poiTotal = 0;
	$recentPois = [];
}

layout_start('dashboard', 'Dashboard | POI Admin');
?>

<div>
	<h1 class="text-2xl font-semibold">Tổng quan hệ thống</h1>
	<p class="text-sm text-slate-500 mt-1">Chào mừng quay trở lại, <?php echo htmlspecialchars((string)($_SESSION['username'] ?? 'Admin'), ENT_QUOTES, 'UTF-8'); ?>.</p>
</div>

<div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mt-6">
	<div class="bg-white border border-slate-200 rounded-2xl p-5 flex items-center gap-4">
		<div class="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center">
			<i class="bi bi-geo-alt"></i>
		</div>
		<div>
			<div class="text-xs text-slate-500">Tổng số POIs</div>
			<div class="text-2xl font-semibold mt-0.5"><?php echo $poiTotal; ?></div>
		</div>
	</div>

	<div class="bg-white border border-slate-200 rounded-2xl p-5 flex items-center gap-4">
		<div class="w-12 h-12 rounded-2xl bg-orange-500 text-white flex items-center justify-center">
			<i class="bi bi-people"></i>
		</div>
		<div>
			<div class="text-xs text-slate-500">Lượt truy cập</div>
			<div class="text-2xl font-semibold mt-0.5"><?php echo number_format($visits); ?></div>
		</div>
	</div>

	<div class="bg-white border border-slate-200 rounded-2xl p-5 flex items-center gap-4">
		<div class="w-12 h-12 rounded-2xl bg-violet-600 text-white flex items-center justify-center">
			<i class="bi bi-graph-up"></i>
		</div>
		<div>
			<div class="text-xs text-slate-500">Tăng trưởng</div>
			<div class="text-2xl font-semibold mt-0.5"><?php echo htmlspecialchars($growth, ENT_QUOTES, 'UTF-8'); ?></div>
		</div>
	</div>
</div>

<div class="grid grid-cols-1 xl:grid-cols-2 gap-6 mt-6">
	<section class="bg-white border border-slate-200 rounded-2xl overflow-hidden">
		<div class="px-6 py-5 border-b border-slate-100 font-semibold">POIs mới thêm</div>
		<div class="px-6 py-6">
			<?php if (empty($recentPois)) : ?>
				<div class="text-sm text-slate-500 text-center">Chưa có POI nào.</div>
			<?php else : ?>
				<div class="space-y-3">
					<?php foreach ($recentPois as $poi) :
						$name = (string)($poi['name'] ?? '');
					?>
						<div class="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
							<div class="flex items-center gap-3 min-w-0">
								<div class="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
									<i class="bi bi-geo-alt"></i>
								</div>
								<div class="min-w-0">
									<div class="font-semibold truncate"><?php echo htmlspecialchars($name, ENT_QUOTES, 'UTF-8'); ?></div>
									<div class="text-xs text-slate-500 truncate">POI mới</div>
								</div>
							</div>
						</div>
					<?php endforeach; ?>
				</div>
			<?php endif; ?>
		</div>
	</section>
</div>

<?php layout_end(); ?>
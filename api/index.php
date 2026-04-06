<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

api_set_cors_headers();

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    api_no_content();
}

$path = api_get_request_path();
$path = '/' . ltrim($path, '/');
$segments = array_values(array_filter(explode('/', trim($path, '/')), fn($s) => $s !== ''));

$resource = $segments[0] ?? '';

// Public endpoint
if ($resource === '' || $resource === 'health') {
    api_ok([
        'status' => 'ok',
        'time' => gmdate('c'),
    ]);
}

// All other endpoints require API key (unless API_KEYS is empty)
api_require_api_key();

$method = (string)($_SERVER['REQUEST_METHOD'] ?? 'GET');

try {
    switch ($resource) {
        case 'pois':
            handle_pois($method, $segments);
            break;
        default:
            api_fail(404, 'not_found', 'Endpoint không tồn tại.');
    }
} catch (Throwable $e) {
    api_fail(500, 'server_error', 'Lỗi máy chủ.');
}

function handle_pois(string $method, array $segments): void
{
    global $conn;

    $id = $segments[1] ?? null;

    if ($method === 'GET') {
        if ($id === null) {
            $q = api_string($_GET['q'] ?? '');

            $sql = 'SELECT p.id, p.name, p.description, p.lat, p.lng FROM pois p';

            $where = [];
            $params = [];

            if ($q !== '') {
                $where[] = '(p.id LIKE :q OR p.name LIKE :q OR p.description LIKE :q)';
                $params[':q'] = '%' . $q . '%';
            }

            if ($where) {
                $sql .= ' WHERE ' . implode(' AND ', $where);
            }

            $sql .= ' ORDER BY p.id ASC';

            $stmt = $conn->prepare($sql);
            $stmt->execute($params);
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
            api_ok($rows);
        }

        $stmt = $conn->prepare('SELECT id, name, description, lat, lng FROM pois WHERE id = :id');
        $stmt->execute([':id' => (string)$id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$row) {
            api_fail(404, 'not_found', 'Không tìm thấy POI.');
        }
        api_ok($row);
    }

    if ($method === 'POST') {
        if ($id !== null) {
            api_fail(400, 'bad_request', 'Không hỗ trợ POST theo dạng /pois/{id}.');
        }

        $body = api_read_json_body();
        if ($body === []) {
            // allow form-encoded
            $body = $_POST;
        }

        $poiId = api_string($body['id'] ?? '');
        $name = api_string($body['name'] ?? '');
        $description = api_nullable_string($body['description'] ?? null);
        $lat = api_float($body['lat'] ?? null);
        $lng = api_float($body['lng'] ?? null);

        if ($poiId === '' || $name === '' || $lat === null || $lng === null) {
            api_fail(400, 'validation_error', 'Thiếu trường bắt buộc: id, name, lat, lng.');
        }

        api_validate_lat_lng($lat, $lng);

        $stmt = $conn->prepare('INSERT INTO pois (id, name, description, lat, lng) VALUES (:id, :name, :description, :lat, :lng)');
        $stmt->execute([
            ':id' => $poiId,
            ':name' => $name,
            ':description' => $description,
            ':lat' => $lat,
            ':lng' => $lng,
        ]);

        api_ok(['id' => $poiId], 201);
    }

    if ($method === 'PUT' || $method === 'PATCH') {
        if ($id === null) {
            api_fail(400, 'bad_request', 'Thiếu POI id trong URL (/pois/{id}).');
        }

        $body = api_read_json_body();
        if ($body === []) {
            $body = $_POST;
        }

        $name = api_string($body['name'] ?? '');
        $description = api_nullable_string($body['description'] ?? null);
        $lat = api_float($body['lat'] ?? null);
        $lng = api_float($body['lng'] ?? null);

        if ($name === '' || $lat === null || $lng === null) {
            api_fail(400, 'validation_error', 'Thiếu trường bắt buộc: name, lat, lng.');
        }

        api_validate_lat_lng($lat, $lng);

        $stmt = $conn->prepare('UPDATE pois SET name = :name, description = :description, lat = :lat, lng = :lng WHERE id = :id');
        $stmt->execute([
            ':id' => (string)$id,
            ':name' => $name,
            ':description' => $description,
            ':lat' => $lat,
            ':lng' => $lng,
        ]);

        if ($stmt->rowCount() === 0) {
            // Could be "no changes" or "not found"; check existence
            $check = $conn->prepare('SELECT id FROM pois WHERE id = :id');
            $check->execute([':id' => (string)$id]);
            if (!$check->fetch(PDO::FETCH_ASSOC)) {
                api_fail(404, 'not_found', 'Không tìm thấy POI.');
            }
        }

        api_ok(['id' => (string)$id]);
    }

    if ($method === 'DELETE') {
        if ($id === null) {
            api_fail(400, 'bad_request', 'Thiếu POI id trong URL (/pois/{id}).');
        }

        $stmt = $conn->prepare('DELETE FROM pois WHERE id = :id');
        $stmt->execute([':id' => (string)$id]);

        if ($stmt->rowCount() === 0) {
            api_fail(404, 'not_found', 'Không tìm thấy POI.');
        }

        api_no_content();
    }

    api_fail(405, 'method_not_allowed', 'Method không được hỗ trợ.');
}

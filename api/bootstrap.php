<?php

declare(strict_types=1);

require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/config.php';

/** @var PDO $conn */

function api_set_cors_headers(): void
{
    $origin = (string)($_SERVER['HTTP_ORIGIN'] ?? '');

    $allowed = CORS_ALLOWED_ORIGINS;
    if (in_array('*', $allowed, true)) {
        header('Access-Control-Allow-Origin: *');
    } elseif ($origin !== '' && in_array($origin, $allowed, true)) {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Vary: Origin');
    }

    header('Access-Control-Allow-Methods: ' . CORS_ALLOWED_METHODS);
    header('Access-Control-Allow-Headers: ' . CORS_ALLOWED_HEADERS);
}

function api_send_json(int $statusCode, array $payload): void
{
    http_response_code($statusCode);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function api_fail(int $statusCode, string $code, string $message, $details = null): void
{
    $payload = [
        'ok' => false,
        'error' => [
            'code' => $code,
            'message' => $message,
        ],
    ];

    if ($details !== null) {
        $payload['error']['details'] = $details;
    }

    api_send_json($statusCode, $payload);
}

function api_ok($data, int $statusCode = 200): void
{
    api_send_json($statusCode, [
        'ok' => true,
        'data' => $data,
    ]);
}

function api_no_content(): void
{
    http_response_code(204);
    exit;
}

function api_get_request_path(): string
{
    // Prefer PATH_INFO when available (index.php/pois/poi_01)
    $pathInfo = (string)($_SERVER['PATH_INFO'] ?? '');
    if ($pathInfo !== '') {
        return $pathInfo;
    }

    // Fallback: parse REQUEST_URI and strip query + base '/api'
    $uri = (string)($_SERVER['REQUEST_URI'] ?? '/');
    $uriPath = (string)parse_url($uri, PHP_URL_PATH);

    $pos = strpos($uriPath, '/api/');
    if ($pos !== false) {
        return substr($uriPath, $pos + 4); // includes leading '/'
    }

    // If someone hits /api (no trailing slash)
    if (str_ends_with($uriPath, '/api')) {
        return '/';
    }

    return '/';
}

function api_read_json_body(): array
{
    $raw = file_get_contents('php://input');
    if (!is_string($raw) || trim($raw) === '') {
        return [];
    }

    $data = json_decode($raw, true);
    if (!is_array($data)) {
        api_fail(400, 'invalid_json', 'Body JSON không hợp lệ.');
    }

    return $data;
}

function api_require_api_key(): void
{
    if (!defined('API_KEYS') || !is_array(API_KEYS) || count(API_KEYS) === 0) {
        return; // auth disabled
    }

    $key = (string)($_SERVER['HTTP_X_API_KEY'] ?? '');
    if ($key === '') {
        api_fail(401, 'missing_api_key', 'Thiếu header X-API-Key.');
    }

    foreach (API_KEYS as $allowed) {
        if (is_string($allowed) && $allowed !== '' && hash_equals($allowed, $key)) {
            return;
        }
    }

    api_fail(401, 'invalid_api_key', 'X-API-Key không hợp lệ.');
}

function api_string($value): string
{
    if ($value === null) {
        return '';
    }
    return trim((string)$value);
}

function api_nullable_string($value): ?string
{
    $s = api_string($value);
    return $s === '' ? null : $s;
}

function api_float($value): ?float
{
    if ($value === null || $value === '') {
        return null;
    }
    if (!is_numeric($value)) {
        return null;
    }
    return (float)$value;
}

function api_validate_lat_lng(float $lat, float $lng): void
{
    if ($lat < -90 || $lat > 90) {
        api_fail(400, 'invalid_lat', 'lat phải nằm trong [-90, 90].');
    }
    if ($lng < -180 || $lng > 180) {
        api_fail(400, 'invalid_lng', 'lng phải nằm trong [-180, 180].');
    }
}

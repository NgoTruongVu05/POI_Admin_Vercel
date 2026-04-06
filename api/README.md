# POI Admin API (for .NET MAUI)

## Base URL
- Pretty URLs (if Apache rewrite works):
  - `http://localhost/POI_Admin/api`
  - Example: `GET http://localhost/POI_Admin/api/pois`
- Fallback (always works, no rewrite needed):
  - `http://localhost/POI_Admin/api/index.php`
  - Example: `GET http://localhost/POI_Admin/api/index.php/pois`

## Auth (X-API-Key)
1. Open `api/config.php`
2. Put at least one strong random value into `API_KEYS`.
3. Send header on every request:
   - `X-API-Key: <your_key>`

If `API_KEYS` is left empty, the API will accept requests without auth (not recommended).

## Endpoints
- `GET /health` (no auth)
- `GET /pois` (optional query: `q`)
- `GET /pois/{id}`
- `POST /pois`
- `PUT /pois/{id}`
- `DELETE /pois/{id}`

## OpenAPI for Copilot
- Spec file: `api/openapi.yaml`
- You can attach this file to Copilot Chat in the MAUI solution, then ask it to generate a typed client (Refit/HttpClient) from the spec.

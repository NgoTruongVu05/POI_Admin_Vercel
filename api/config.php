<?php

declare(strict_types=1);

/**
 * API configuration.
 *
 * SECURITY:
 * - Put at least one strong random key into API_KEYS.
 * - Requests must send header: X-API-Key: <key>
 */

// If empty => API auth is disabled (NOT recommended).
const API_KEYS = [
    // 'CHANGE_ME_TO_A_LONG_RANDOM_SECRET',
];

// CORS (mostly relevant for browsers; MAUI doesn't require it).
// Use '*' for any origin, or list specific origins.
const CORS_ALLOWED_ORIGINS = ['*'];

// If you need to allow custom headers/methods, adjust these.
const CORS_ALLOWED_METHODS = 'GET,POST,PUT,PATCH,DELETE,OPTIONS';
const CORS_ALLOWED_HEADERS = 'Content-Type, X-API-Key';

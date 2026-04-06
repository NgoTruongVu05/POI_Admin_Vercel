<?php

declare(strict_types=1);

/**
 * Ensures the user is authenticated.
 *
 * Call this before any HTML output.
 */
function require_login(string $loginPage = 'login.php'): void
{
    if (session_status() !== PHP_SESSION_ACTIVE) {
        session_start();
    }

    if (!isset($_SESSION['user_id'], $_SESSION['username'])) {
        header('Location: ' . $loginPage);
        exit();
    }
}

function is_logged_in(): bool
{
    if (session_status() !== PHP_SESSION_ACTIVE) {
        session_start();
    }

    return isset($_SESSION['user_id'], $_SESSION['username']);
}

<?php
/**
 * API Key Management — store Gemini key in wp_options.
 *
 * Falls back to GEMINI_API_KEY constant defined in wp-config.php.
 * The key is never returned to the browser; only a configured/source
 * status is exposed via the REST API.
 */

defined( 'ABSPATH' ) || exit;

// ── Route Registration ────────────────────────────────────────────────────────

add_action( 'rest_api_init', 'ai_blog_register_api_key_routes' );

function ai_blog_register_api_key_routes(): void {
    // GET — returns configured status only, never the key itself.
    register_rest_route(
        'ai-blog/v1',
        '/api-key',
        [
            'methods'             => WP_REST_Server::READABLE,
            'callback'            => 'ai_blog_get_api_key_status',
            'permission_callback' => 'ai_blog_check_permission',
        ]
    );

    // POST — save or clear the key.
    register_rest_route(
        'ai-blog/v1',
        '/api-key',
        [
            'methods'             => WP_REST_Server::CREATABLE,
            'callback'            => 'ai_blog_save_api_key_handler',
            'permission_callback' => 'ai_blog_check_permission',
            'args'                => [
                'api_key' => [
                    'required'          => true,
                    'type'              => 'string',
                    'sanitize_callback' => 'sanitize_text_field',
                ],
            ],
        ]
    );
}

// ── Callbacks ─────────────────────────────────────────────────────────────────

/**
 * GET /wp-json/ai-blog/v1/api-key
 *
 * @return WP_REST_Response
 */
function ai_blog_get_api_key_status(): WP_REST_Response {
    return new WP_REST_Response( ai_blog_api_key_payload(), 200 );
}

/**
 * POST /wp-json/ai-blog/v1/api-key
 *
 * @param WP_REST_Request $request
 * @return WP_REST_Response|WP_Error
 */
function ai_blog_save_api_key_handler( WP_REST_Request $request ): WP_REST_Response|WP_Error {
    // Disallow overriding a constant — the constant takes priority in ai_blog_get_api_key().
    if ( defined( 'GEMINI_API_KEY' ) && '' !== trim( GEMINI_API_KEY ) ) {
        return new WP_Error(
            'ai_blog_key_locked',
            __( 'The API key is set via the GEMINI_API_KEY constant in wp-config.php and cannot be changed here. Remove the constant to manage it from the admin UI.', 'ai-blog-generator' ),
            [ 'status' => 403 ]
        );
    }

    $key = trim( $request->get_param( 'api_key' ) );

    if ( '' === $key ) {
        delete_option( 'ai_blog_gemini_api_key' );
    } else {
        // Store without autoload — only needed at API-call time, not every page load.
        update_option( 'ai_blog_gemini_api_key', $key, false );
    }

    return new WP_REST_Response( ai_blog_api_key_payload(), 200 );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Build the API key status payload (shared by GET and POST handlers).
 *
 * @return array{configured: bool, source: string}
 */
function ai_blog_api_key_payload(): array {
    $has_constant = defined( 'GEMINI_API_KEY' ) && '' !== trim( GEMINI_API_KEY );
    $has_db_key   = '' !== (string) get_option( 'ai_blog_gemini_api_key', '' );

    return [
        'configured' => $has_constant || $has_db_key,
        'source'     => $has_constant ? 'constant' : ( $has_db_key ? 'database' : 'none' ),
    ];
}

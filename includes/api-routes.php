<?php
/**
 * REST API Routes — /wp-json/ai-blog/v1/
 */

defined( 'ABSPATH' ) || exit;

// ── Route Registration ────────────────────────────────────────────────────────

add_action( 'rest_api_init', 'ai_blog_register_routes' );

function ai_blog_register_routes(): void {
    register_rest_route(
        'ai-blog/v1',
        '/generate',
        [
            'methods'             => WP_REST_Server::CREATABLE, // POST only
            'callback'            => 'ai_blog_handle_generate',
            'permission_callback' => 'ai_blog_check_permission',
            'args'                => [
                'topic' => [
                    'required'          => true,
                    'type'              => 'string',
                    'sanitize_callback' => 'sanitize_text_field',
                    'validate_callback' => fn( $v ) => is_string( $v ) && trim( $v ) !== '',
                    'description'       => 'The blog topic to generate content about.',
                ],
                'tone' => [
                    'required'          => true,
                    'type'              => 'string',
                    'sanitize_callback' => 'sanitize_text_field',
                    'validate_callback' => fn( $v ) => in_array( $v, [ 'professional', 'casual', 'beginner' ], true ),
                    'description'       => 'Writing tone: professional, casual, or beginner.',
                ],
                'length' => [
                    'required'          => true,
                    'type'              => 'string',
                    'sanitize_callback' => 'sanitize_text_field',
                    'validate_callback' => fn( $v ) => in_array( $v, [ 'short', 'medium', 'long' ], true ),
                    'description'       => 'Post length: short (~300 words), medium (~600), or long (~1200).',
                ],
            ],
        ]
    );
}

// ── Publish Route ─────────────────────────────────────────────────────────────

add_action( 'rest_api_init', 'ai_blog_register_publish_route' );

function ai_blog_register_publish_route(): void {
    register_rest_route(
        'ai-blog/v1',
        '/publish',
        [
            'methods'             => WP_REST_Server::CREATABLE,
            'callback'            => 'ai_blog_handle_publish',
            'permission_callback' => 'ai_blog_check_permission',
            'args'                => [
                'title' => [
                    'required'          => true,
                    'type'              => 'string',
                    'sanitize_callback' => 'sanitize_text_field',
                    'validate_callback' => fn( $v ) => is_string( $v ) && trim( $v ) !== '',
                    'description'       => 'The post title.',
                ],
                'content' => [
                    'required'          => true,
                    'type'              => 'string',
                    'sanitize_callback' => 'wp_kses_post',
                    'validate_callback' => fn( $v ) => is_string( $v ) && trim( $v ) !== '',
                    'description'       => 'The post body HTML (Gemini output).',
                ],
                'status' => [
                    'required'          => true,
                    'type'              => 'string',
                    'sanitize_callback' => 'sanitize_text_field',
                    'validate_callback' => fn( $v ) => in_array( $v, [ 'draft', 'publish' ], true ),
                    'description'       => 'Post status: draft or publish.',
                ],
            ],
        ]
    );
}

/**
 * Handles POST /wp-json/ai-blog/v1/publish.
 *
 * @param WP_REST_Request $request
 * @return WP_REST_Response|WP_Error
 */
function ai_blog_handle_publish( WP_REST_Request $request ): WP_REST_Response|WP_Error {
    $title   = $request->get_param( 'title' );
    $content = $request->get_param( 'content' );
    $status  = $request->get_param( 'status' );

    $post_id = wp_insert_post(
        [
            'post_title'   => $title,
            'post_content' => $content,
            'post_status'  => $status,
            'post_type'    => 'post',
            'post_author'  => get_current_user_id(),
        ],
        true // Return WP_Error on failure instead of 0.
    );

    if ( is_wp_error( $post_id ) ) {
        return new WP_Error(
            'ai_blog_publish_failed',
            $post_id->get_error_message(),
            [ 'status' => 500 ]
        );
    }

    return new WP_REST_Response(
        [
            'post_id'  => $post_id,
            'edit_url' => get_edit_post_link( $post_id, 'raw' ),
            'view_url' => get_permalink( $post_id ),
            'status'   => $status,
        ],
        201
    );
}

// ── Permission Callback ───────────────────────────────────────────────────────

/**
 * Verifies the request is from an authenticated admin user.
 *
 * WordPress core validates the X-WP-Nonce header (wp_rest action) before
 * any route callback is reached, so no manual wp_verify_nonce() is needed.
 *
 * @return bool|WP_Error
 */
function ai_blog_check_permission(): bool|WP_Error {
    if ( ! current_user_can( 'manage_options' ) ) {
        return new WP_Error(
            'rest_forbidden',
            __( 'You do not have permission to generate posts.', 'ai-blog-generator' ),
            [ 'status' => 403 ]
        );
    }

    return true;
}

// ── Route Callback ────────────────────────────────────────────────────────────

/**
 * Handles POST /wp-json/ai-blog/v1/generate.
 *
 * By the time this runs, all args have been sanitized and validated by the
 * schema defined in ai_blog_register_routes().
 *
 * @param WP_REST_Request $request
 * @return WP_REST_Response|WP_Error
 */
function ai_blog_handle_generate( WP_REST_Request $request ): WP_REST_Response|WP_Error {
    $topic  = $request->get_param( 'topic' );
    $tone   = $request->get_param( 'tone' );
    $length = $request->get_param( 'length' );

    $content = ai_blog_generate_content( $topic, $tone, $length );

    if ( is_wp_error( $content ) ) {
        // WP REST API serialises WP_Error to JSON automatically.
        return $content;
    }

    return new WP_REST_Response( [ 'content' => $content ], 200 );
}

// ── Settings Routes ───────────────────────────────────────────────────────────

add_action( 'rest_api_init', 'ai_blog_register_settings_routes' );

function ai_blog_register_settings_routes(): void {
    $shared = [
        'permission_callback' => 'ai_blog_check_permission',
    ];

    // GET — return current auto-post settings.
    register_rest_route( 'ai-blog/v1', '/settings', array_merge( $shared, [
        'methods'  => WP_REST_Server::READABLE,
        'callback' => 'ai_blog_get_settings',
    ] ) );

    // POST — save settings and reschedule cron accordingly.
    register_rest_route( 'ai-blog/v1', '/settings', array_merge( $shared, [
        'methods'  => WP_REST_Server::CREATABLE,
        'callback' => 'ai_blog_save_settings',
        'args'     => [
            'enabled' => [
                'required' => true,
                'type'     => 'boolean',
            ],
            'topic' => [
                'required'          => true,
                'type'              => 'string',
                'sanitize_callback' => 'sanitize_text_field',
            ],
            'tone' => [
                'required'          => true,
                'type'              => 'string',
                'sanitize_callback' => 'sanitize_text_field',
                'validate_callback' => fn( $v ) => in_array( $v, [ 'professional', 'casual', 'beginner' ], true ),
            ],
            'length' => [
                'required'          => true,
                'type'              => 'string',
                'sanitize_callback' => 'sanitize_text_field',
                'validate_callback' => fn( $v ) => in_array( $v, [ 'short', 'medium', 'long' ], true ),
            ],
        ],
    ] ) );
}

/**
 * GET /wp-json/ai-blog/v1/settings
 *
 * @return WP_REST_Response
 */
function ai_blog_get_settings(): WP_REST_Response {
    return new WP_REST_Response( ai_blog_settings_payload(), 200 );
}

/**
 * POST /wp-json/ai-blog/v1/settings
 *
 * @param WP_REST_Request $request
 * @return WP_REST_Response
 */
function ai_blog_save_settings( WP_REST_Request $request ): WP_REST_Response {
    $enabled = (bool) $request->get_param( 'enabled' );
    $topic   = $request->get_param( 'topic' );
    $tone    = $request->get_param( 'tone' );
    $length  = $request->get_param( 'length' );

    update_option( 'ai_blog_auto_enabled', $enabled );
    update_option( 'ai_blog_auto_topic',   $topic   );
    update_option( 'ai_blog_auto_tone',    $tone    );
    update_option( 'ai_blog_auto_length',  $length  );

    if ( $enabled ) {
        ai_blog_schedule_cron();
    } else {
        ai_blog_unschedule_cron();
    }

    return new WP_REST_Response( ai_blog_settings_payload(), 200 );
}

/**
 * Build the settings response payload (shared by GET and POST handlers).
 *
 * @return array<string, mixed>
 */
function ai_blog_settings_payload(): array {
    return [
        'enabled'  => (bool) get_option( 'ai_blog_auto_enabled', false ),
        'topic'    => (string) get_option( 'ai_blog_auto_topic',  '' ),
        'tone'     => (string) get_option( 'ai_blog_auto_tone',   'professional' ),
        'length'   => (string) get_option( 'ai_blog_auto_length', 'medium' ),
        'next_run' => ai_blog_next_run_label(),
    ];
}

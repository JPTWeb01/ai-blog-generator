<?php
/**
 * Settings Page — plugin status and API key management for Groq.
 *
 * The API key is read from the GROQ_API_KEY constant in wp-config.php.
 * It is never stored in the database or returned to the browser.
 */

defined( 'ABSPATH' ) || exit;

// ── REST Routes ───────────────────────────────────────────────────────────────

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
}

// ── REST Callbacks ────────────────────────────────────────────────────────────

/**
 * GET /wp-json/ai-blog/v1/api-key
 *
 * @return WP_REST_Response
 */
function ai_blog_get_api_key_status(): WP_REST_Response {
    return new WP_REST_Response( ai_blog_api_key_payload(), 200 );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Build the API key status payload.
 *
 * @return array{configured: bool, source: string}
 */
function ai_blog_api_key_payload(): array {
    $has_constant = defined( 'GROQ_API_KEY' ) && '' !== trim( GROQ_API_KEY );

    return [
        'configured' => $has_constant,
        'source'     => $has_constant ? 'constant' : 'none',
    ];
}

// ── Admin Settings Page ───────────────────────────────────────────────────────

function ai_blog_render_settings_page(): void {
    if ( ! current_user_can( 'manage_options' ) ) {
        wp_die( esc_html__( 'You do not have permission to access this page.', 'ai-blog-generator' ) );
    }

    $key_configured = defined( 'GROQ_API_KEY' ) && '' !== trim( GROQ_API_KEY );
    $key_source     = $key_configured ? 'wp-config.php constant' : 'not set';
    $status_class   = $key_configured ? 'notice-success' : 'notice-error';
    $status_label   = $key_configured
        ? __( 'Configured', 'ai-blog-generator' )
        : __( 'Not configured', 'ai-blog-generator' );
    ?>
    <div class="wrap">
        <h1><?php esc_html_e( 'AI Blog Generator — Settings', 'ai-blog-generator' ); ?></h1>

        <div class="notice <?php echo esc_attr( $status_class ); ?> inline">
            <p>
                <strong><?php esc_html_e( 'Groq API Key:', 'ai-blog-generator' ); ?></strong>
                <?php echo esc_html( $status_label ); ?>
                <?php if ( $key_configured ) : ?>
                    — <?php esc_html_e( 'Source:', 'ai-blog-generator' ); ?>
                    <code><?php echo esc_html( $key_source ); ?></code>
                <?php endif; ?>
            </p>
        </div>

        <?php if ( ! $key_configured ) : ?>
        <div class="notice notice-warning inline">
            <p>
                <?php esc_html_e( 'Add the following line to your wp-config.php to enable blog generation:', 'ai-blog-generator' ); ?>
            </p>
            <pre style="background:#f6f7f7;padding:10px;border-left:4px solid #dba617;">define( 'GROQ_API_KEY', 'your-groq-api-key-here' );</pre>
        </div>
        <?php endif; ?>

        <table class="form-table" role="presentation">
            <tbody>
                <tr>
                    <th scope="row"><?php esc_html_e( 'Plugin Version', 'ai-blog-generator' ); ?></th>
                    <td><code><?php echo esc_html( AI_BLOG_VERSION ); ?></code></td>
                </tr>
                <tr>
                    <th scope="row"><?php esc_html_e( 'AI Provider', 'ai-blog-generator' ); ?></th>
                    <td>Groq</td>
                </tr>
                <tr>
                    <th scope="row"><?php esc_html_e( 'Model', 'ai-blog-generator' ); ?></th>
                    <td><code><?php echo esc_html( AI_BLOG_GROQ_MODEL ); ?></code></td>
                </tr>
                <tr>
                    <th scope="row"><?php esc_html_e( 'Endpoint', 'ai-blog-generator' ); ?></th>
                    <td><code><?php echo esc_html( AI_BLOG_GROQ_ENDPOINT ); ?></code></td>
                </tr>
                <tr>
                    <th scope="row"><?php esc_html_e( 'API Key Source', 'ai-blog-generator' ); ?></th>
                    <td><?php echo esc_html( $key_source ); ?></td>
                </tr>
            </tbody>
        </table>
    </div>
    <?php
}

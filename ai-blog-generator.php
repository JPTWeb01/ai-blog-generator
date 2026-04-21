<?php
/**
 * Plugin Name:       AI Blog Generator
 * Plugin URI:        https://github.com/yourusername/ai-blog-generator
 * Description:       Generate and publish AI-powered blog posts using Google Gemini.
 * Version:           1.1.0
 * Requires at least: 6.0
 * Requires PHP:      8.0
 * Author:            Your Name
 * Author URI:        https://yourwebsite.com
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       ai-blog-generator
 */

defined( 'ABSPATH' ) || exit;

// ── Constants ────────────────────────────────────────────────────────────────

define( 'AI_BLOG_VERSION',     '1.1.0' );
define( 'AI_BLOG_PLUGIN_DIR',  plugin_dir_path( __FILE__ ) );
define( 'AI_BLOG_PLUGIN_URL',  plugin_dir_url( __FILE__ ) );
define( 'AI_BLOG_PLUGIN_FILE', __FILE__ );
define( 'AI_BLOG_GROQ_MODEL',    'llama-3.3-70b-versatile' );
define( 'AI_BLOG_GROQ_ENDPOINT', 'https://api.groq.com/openai/v1/chat/completions' );

// ── Includes ─────────────────────────────────────────────────────────────────

require_once AI_BLOG_PLUGIN_DIR . 'includes/ai-handler.php';
require_once AI_BLOG_PLUGIN_DIR . 'includes/cron.php';
require_once AI_BLOG_PLUGIN_DIR . 'includes/api-routes.php';
require_once AI_BLOG_PLUGIN_DIR . 'includes/settings-page.php';

// ── Activation ───────────────────────────────────────────────────────────────

register_activation_hook( __FILE__, 'ai_blog_activate' );

function ai_blog_activate(): void {
    // Verify the server meets minimum requirements.
    if ( version_compare( PHP_VERSION, '8.0', '<' ) ) {
        deactivate_plugins( plugin_basename( __FILE__ ) );
        wp_die(
            esc_html__( 'AI Blog Generator requires PHP 8.0 or higher.', 'ai-blog-generator' ),
            esc_html__( 'Plugin Activation Error', 'ai-blog-generator' ),
            [ 'back_link' => true ]
        );
    }

    // Store the installed version for future migration checks.
    update_option( 'ai_blog_version', AI_BLOG_VERSION );

    // Re-schedule the cron event if auto-posting was enabled before deactivation.
    if ( get_option( 'ai_blog_auto_enabled' ) ) {
        ai_blog_schedule_cron();
    }

    // Flush rewrite rules so the REST route is available immediately.
    flush_rewrite_rules();
}

// ── Deactivation ─────────────────────────────────────────────────────────────

register_deactivation_hook( __FILE__, 'ai_blog_deactivate' );

function ai_blog_deactivate(): void {
    ai_blog_unschedule_cron();
    flush_rewrite_rules();
}

// ── Admin Menu ────────────────────────────────────────────────────────────────

add_action( 'admin_menu', 'ai_blog_register_menu' );

function ai_blog_register_menu(): void {
    add_menu_page(
        __( 'AI Blog Generator', 'ai-blog-generator' ), // Page title
        __( 'AI Blog', 'ai-blog-generator' ),            // Menu label
        'manage_options',                                 // Capability
        'ai-blog-generator',                             // Menu slug
        'ai_blog_render_admin_page',                     // Callback
        'dashicons-welcome-write-blog',                  // Icon
        30                                               // Position
    );

    add_submenu_page(
        'ai-blog-generator',
        __( 'AI Blog — Settings', 'ai-blog-generator' ),
        __( 'Settings', 'ai-blog-generator' ),
        'manage_options',
        'ai-blog-settings',
        'ai_blog_render_settings_page'
    );
}

// ── Admin Page Callback ───────────────────────────────────────────────────────

function ai_blog_render_admin_page(): void {
    // Only users with the required capability should reach this page.
    if ( ! current_user_can( 'manage_options' ) ) {
        wp_die( esc_html__( 'You do not have permission to access this page.', 'ai-blog-generator' ) );
    }
    ?>
    <div class="wrap ai-blog-plugin-wrap">
        <h1><?php echo esc_html( get_admin_page_title() ); ?></h1>
        <div id="ai-blog-root">
            <?php esc_html_e( 'Loading…', 'ai-blog-generator' ); ?>
        </div>
    </div>
    <?php
}

// ── Enqueue Admin Assets ──────────────────────────────────────────────────────

add_action( 'admin_enqueue_scripts', 'ai_blog_enqueue_assets' );

function ai_blog_enqueue_assets( string $hook ): void {
    // Only load on this plugin's admin page.
    if ( 'toplevel_page_ai-blog-generator' !== $hook ) {
        return;
    }

    $js_path  = AI_BLOG_PLUGIN_DIR . 'build/index.js';
    $css_path = AI_BLOG_PLUGIN_DIR . 'admin/styles.css';

    // Bail early if the build artefact doesn't exist yet (pre-build).
    if ( ! file_exists( $js_path ) ) {
        return;
    }

    wp_enqueue_script(
        'ai-blog-app',
        AI_BLOG_PLUGIN_URL . 'build/index.js',
        [],
        filemtime( $js_path ),
        true // Load in footer
    );

    if ( file_exists( $css_path ) ) {
        wp_enqueue_style(
            'ai-blog-styles',
            AI_BLOG_PLUGIN_URL . 'admin/styles.css',
            [],
            filemtime( $css_path )
        );
    }

    // Pass nonce and REST URL to the React app — API key is never included here.
    wp_localize_script(
        'ai-blog-app',
        'aiBlogData',
        [
            'restUrl' => esc_url_raw( rest_url( 'ai-blog/v1/' ) ),
            'nonce'   => wp_create_nonce( 'wp_rest' ),
        ]
    );
}

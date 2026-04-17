<?php
/**
 * WP-Cron — daily auto-posting logic.
 *
 * Scheduling helpers are called from the activation/deactivation hooks in
 * ai-blog-generator.php and from the settings REST route in api-routes.php.
 */

defined( 'ABSPATH' ) || exit;

// ── Cron Callback ─────────────────────────────────────────────────────────────

add_action( 'ai_blog_daily_post', 'ai_blog_run_auto_post' );

/**
 * Fired once daily by WP-Cron. Reads saved settings, generates a post with
 * Gemini, and publishes it.
 */
function ai_blog_run_auto_post(): void {
    $enabled = (bool) get_option( 'ai_blog_auto_enabled', false );
    if ( ! $enabled ) {
        return;
    }

    $topic  = sanitize_text_field( get_option( 'ai_blog_auto_topic', '' ) );
    $tone   = sanitize_text_field( get_option( 'ai_blog_auto_tone',  'professional' ) );
    $length = sanitize_text_field( get_option( 'ai_blog_auto_length', 'medium' ) );

    if ( '' === $topic ) {
        error_log( '[AI Blog Generator] Auto-post skipped: no topic configured.' );
        return;
    }

    $content = ai_blog_generate_content( $topic, $tone, $length );

    if ( is_wp_error( $content ) ) {
        error_log( '[AI Blog Generator] Auto-post generation failed: ' . $content->get_error_message() );
        return;
    }

    $post_id = wp_insert_post(
        [
            'post_title'   => $topic,
            'post_content' => $content,
            'post_status'  => 'publish',
            'post_type'    => 'post',
        ],
        true
    );

    if ( is_wp_error( $post_id ) ) {
        error_log( '[AI Blog Generator] Auto-post insert failed: ' . $post_id->get_error_message() );
        return;
    }

    error_log( sprintf( '[AI Blog Generator] Auto-post published (ID %d): %s', $post_id, $topic ) );
}

// ── Schedule Helpers ──────────────────────────────────────────────────────────

/**
 * Schedule the daily cron event if it is not already scheduled.
 */
function ai_blog_schedule_cron(): void {
    if ( ! wp_next_scheduled( 'ai_blog_daily_post' ) ) {
        wp_schedule_event( time(), 'daily', 'ai_blog_daily_post' );
    }
}

/**
 * Remove the daily cron event.
 */
function ai_blog_unschedule_cron(): void {
    $timestamp = wp_next_scheduled( 'ai_blog_daily_post' );
    if ( $timestamp ) {
        wp_unschedule_event( $timestamp, 'ai_blog_daily_post' );
    }
}

/**
 * Return a human-readable string for when the next auto-post run is scheduled,
 * or an empty string if the event is not scheduled.
 *
 * @return string
 */
function ai_blog_next_run_label(): string {
    $timestamp = wp_next_scheduled( 'ai_blog_daily_post' );
    if ( ! $timestamp ) {
        return '';
    }

    return wp_date( 'F j, Y \a\t g:i a', $timestamp );
}

<?php
/**
 * AI Handler — Google Gemini API integration.
 *
 * Requires GEMINI_API_KEY to be defined in wp-config.php:
 *   define( 'GEMINI_API_KEY', 'your-key-here' );
 */

defined( 'ABSPATH' ) || exit;

// ── Constants ─────────────────────────────────────────────────────────────────

define( 'AI_BLOG_GEMINI_MODEL',    'gemini-2.0-flash' );
define( 'AI_BLOG_GEMINI_ENDPOINT', 'https://generativelanguage.googleapis.com/v1beta/models/' . AI_BLOG_GEMINI_MODEL . ':generateContent' );

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Generate blog post HTML for a given topic, tone, and length.
 *
 * @param string $topic  The blog topic (already sanitized by the REST layer).
 * @param string $tone   Writing tone: professional | casual | beginner.
 * @param string $length Post length: short | medium | long.
 * @return string|WP_Error Generated HTML content, or WP_Error on failure.
 */
function ai_blog_generate_content( string $topic, string $tone, string $length ): string|WP_Error {
    $api_key = ai_blog_get_api_key();
    if ( is_wp_error( $api_key ) ) {
        return $api_key;
    }

    $prompt   = ai_blog_build_prompt( $topic, $tone, $length );
    $response = ai_blog_call_gemini( $api_key, $prompt );
    if ( is_wp_error( $response ) ) {
        return $response;
    }

    return $response;
}

// ── Internal Helpers ──────────────────────────────────────────────────────────

/**
 * Retrieve the API key — constant in wp-config.php takes priority over the DB.
 *
 * @return string|WP_Error
 */
function ai_blog_get_api_key(): string|WP_Error {
    if ( defined( 'GEMINI_API_KEY' ) && '' !== trim( GEMINI_API_KEY ) ) {
        return GEMINI_API_KEY;
    }

    $db_key = (string) get_option( 'ai_blog_gemini_api_key', '' );
    if ( '' !== $db_key ) {
        return $db_key;
    }

    return new WP_Error(
        'ai_blog_no_api_key',
        __( 'Gemini API key is not configured. Add it in AI Blog → Settings or define GEMINI_API_KEY in wp-config.php.', 'ai-blog-generator' ),
        [ 'status' => 500 ]
    );
}

/**
 * Build the Gemini prompt from the user's inputs.
 *
 * @param string $topic
 * @param string $tone
 * @param string $length
 * @return string
 */
function ai_blog_build_prompt( string $topic, string $tone, string $length ): string {
    $tone_instructions = [
        'professional' => 'Use a formal, authoritative tone suitable for industry professionals. Avoid slang. Use precise vocabulary.',
        'casual'       => 'Use a friendly, conversational tone. Write as if talking to a friend. Keep it engaging and light.',
        'beginner'     => 'Use simple, clear language for someone with no prior knowledge. Define any technical terms. Be encouraging.',
    ];

    $word_targets = [
        'short'  => '300',
        'medium' => '600',
        'long'   => '1200',
    ];

    $tone_instruction = $tone_instructions[ $tone ]  ?? $tone_instructions['professional'];
    $word_target      = $word_targets[ $length ] ?? $word_targets['medium'];

    return "Write a blog post about the following topic: \"{$topic}\"\n\n"
         . "Tone: {$tone_instruction}\n\n"
         . "Length: Aim for approximately {$word_target} words.\n\n"
         . "Format the output as valid HTML using the following structure:\n"
         . "- An <h2> tag for the main title\n"
         . "- <h3> tags for section headings\n"
         . "- <p> tags for paragraphs\n"
         . "- <ul> or <ol> with <li> tags for any lists\n"
         . "- <strong> or <em> for emphasis where appropriate\n\n"
         . "Return ONLY the HTML content — no markdown, no code fences, no explanations outside the HTML.";
}

/**
 * Call the Gemini REST API and return the generated text.
 *
 * Uses wp_remote_post() so WordPress proxy/SSL settings are respected.
 *
 * @param string $api_key
 * @param string $prompt
 * @return string|WP_Error
 */
function ai_blog_call_gemini( string $api_key, string $prompt ): string|WP_Error {
    $url  = add_query_arg( 'key', $api_key, AI_BLOG_GEMINI_ENDPOINT );
    $body = wp_json_encode( [
        'contents' => [
            [
                'parts' => [
                    [ 'text' => $prompt ],
                ],
            ],
        ],
        'generationConfig' => [
            'temperature'     => 0.7,
            'maxOutputTokens' => 2048,
        ],
    ] );

    $response = wp_remote_post(
        $url,
        [
            'headers' => [ 'Content-Type' => 'application/json' ],
            'body'    => $body,
            'timeout' => 30,
        ]
    );

    // Network-level error (DNS, timeout, etc.).
    if ( is_wp_error( $response ) ) {
        return new WP_Error(
            'ai_blog_request_failed',
            sprintf(
                /* translators: %s: underlying error message */
                __( 'Could not reach the Gemini API: %s', 'ai-blog-generator' ),
                $response->get_error_message()
            ),
            [ 'status' => 502 ]
        );
    }

    $http_code = wp_remote_retrieve_response_code( $response );
    $raw_body  = wp_remote_retrieve_body( $response );
    $data      = json_decode( $raw_body, true );

    // Non-200 response from Gemini.
    if ( 200 !== (int) $http_code ) {
        $api_message = $data['error']['message'] ?? $raw_body;

        return new WP_Error(
            'ai_blog_api_error',
            sprintf(
                /* translators: 1: HTTP status code, 2: API error message */
                __( 'Gemini API returned HTTP %1$d: %2$s', 'ai-blog-generator' ),
                (int) $http_code,
                sanitize_text_field( $api_message )
            ),
            [ 'status' => 502 ]
        );
    }

    // Extract generated text from the response structure.
    $text = $data['candidates'][0]['content']['parts'][0]['text'] ?? '';

    if ( '' === trim( $text ) ) {
        return new WP_Error(
            'ai_blog_empty_response',
            __( 'Gemini returned an empty response. Please try again.', 'ai-blog-generator' ),
            [ 'status' => 502 ]
        );
    }

    // Strip any accidental markdown code fences Gemini may have added.
    $text = preg_replace( '/^```(?:html)?\s*/i', '', trim( $text ) );
    $text = preg_replace( '/\s*```$/i', '', $text );

    return trim( $text );
}

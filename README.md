# AI Blog Generator

A WordPress plugin that generates and publishes AI-powered blog posts using the Google Gemini API.

## Requirements

- WordPress 6.0+
- PHP 8.0+
- Node.js 18+ (for building the React frontend)
- A Google Gemini API key

## Installation

1. Clone or download this repository into your WordPress `wp-content/plugins/` directory.
2. Add your Gemini API key to `wp-config.php`:

   ```php
   define( 'GEMINI_API_KEY', 'your-key-here' );
   ```

3. Install Node dependencies and build the frontend:

   ```bash
   npm install
   npm run build
   ```

4. Activate the plugin from the **Plugins** screen in WordPress admin.

## Development

```bash
npm install
npm run dev   # watch mode
npm run build # production build
```

## Security

- All REST API requests are protected by WordPress nonce verification.
- The Gemini API key is read only from `wp-config.php` — it is never exposed to the browser.
- GitHub Actions runs [Gitleaks](https://github.com/gitleaks/gitleaks) on every push and pull request to prevent accidental secret commits.
- Dependabot keeps npm and GitHub Actions dependencies up to date.

## Phases

| Phase | Description |
|-------|-------------|
| 2 | Plugin base file, activation/deactivation hooks, admin menu |
| 3 | React 18 + Webpack setup, script/style enqueueing |
| 4 | REST API endpoint with nonce verification |
| 5 | Gemini API integration |
| 6 | Publish post system (draft or published) |
| 7 | WP-Cron daily auto-posting |

## License

GPL-2.0-or-later

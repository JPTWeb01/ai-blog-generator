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

## Deployment

Push to `main` to trigger the GitHub Actions deploy pipeline. It builds the React frontend and deploys plugin files to Hostinger via SSH.

Configure these GitHub repository secrets:

| Secret | Value |
|--------|-------|
| `SSH_HOST` | Hostinger server hostname or IP |
| `SSH_USERNAME` | SSH username |
| `SSH_PRIVATE_KEY` | Private key (PEM format) |
| `SSH_PORT` | SSH port (defaults to 22 if omitted) |
| `DEPLOY_PATH` | Absolute path to plugin dir on server (e.g. `/public_html/wp-content/plugins/ai-blog-generator`) |

## Phases

| Phase | Description |
|-------|-------------|
| 2 | Plugin base file, activation/deactivation hooks, admin menu |
| 3 | React 18 + Webpack setup, script/style enqueueing |
| 4 | REST API endpoint with nonce verification |
| 5 | Gemini API integration |
| 6 | Publish post system (draft or published) |
| 7 | WP-Cron daily auto-posting |
| 8 | Admin UI for Gemini API key management (no wp-config.php required) |
| 9 | Category and tag selection before publishing |
| 10 | Post history dashboard with pagination and regenerate |

## License

GPL-2.0-or-later

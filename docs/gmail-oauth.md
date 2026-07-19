# Gmail OAuth setup

Last verified against code: 2026-07-17 (Gmail OAuth connect/callback/disconnect).

apptrack uses Google OAuth 2.0 with **PKCE** and the `gmail.readonly` scope. Tokens are encrypted with AES-256-GCM before storage. The server never returns refresh or access tokens in API JSON.

## 1. Create a Google Cloud project

1. Open [Google Cloud Console](https://console.cloud.google.com/).
2. Create a project (or pick an existing one).
3. Enable **Gmail API**.

## 2. OAuth consent screen

1. APIs & Services → OAuth consent screen.
2. Choose **External**.
3. Add yourself as a **test user** while the app is in Testing.
4. Scopes: add `https://www.googleapis.com/auth/gmail.readonly` (and openid/email/profile as requested by the authorize URL).

**Important:** While the consent screen is in _Testing_, Google may expire refresh tokens after **7 days**. For long-running personal use, publish the consent screen to **Production** and acknowledge the unverified-app warning. Self-hosters always bring their own OAuth client (this avoids Google’s restricted-scope security audit for a SaaS product).

## 3. Create OAuth client credentials

1. Credentials → Create credentials → OAuth client ID → **Web application**.
2. Authorized redirect URI:

   ```
   ${APP_BASE_URL}/api/v1/gmail/callback
   ```

   Example for local: `http://localhost:3000/api/v1/gmail/callback`

3. Copy Client ID and Client Secret into `.env`:

   ```
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   APP_BASE_URL=http://localhost:3000
   APP_ENCRYPTION_KEY=<openssl rand -base64 32>
   ```

## 4. Connect flow

1. Ensure Postgres is up and migrated (`pnpm migrate`).
2. Start the server (`pnpm --filter @apptrack/server dev`).
3. Visit `http://localhost:3000/api/v1/gmail/connect` (browser redirects to Google).
4. After consent, Google returns to `/api/v1/gmail/callback`; the app stores encrypted tokens and redirects to `/settings?gmail=connected`.

Machine-friendly: `GET /api/v1/gmail/connect?format=json` returns `{ authorizeUrl }`.

## 5. API surface

| Method | Path                                 | Purpose                                                   |
| ------ | ------------------------------------ | --------------------------------------------------------- |
| GET    | `/api/v1/gmail/connect`              | Start PKCE authorize                                      |
| GET    | `/api/v1/gmail/callback`             | Code exchange + store                                     |
| GET    | `/api/v1/gmail/accounts`             | List connected accounts (no secrets)                      |
| DELETE | `/api/v1/gmail/accounts/:id`         | Revoke at Google + delete credentials                     |
| POST   | `/api/v1/gmail/accounts/:id/refresh` | Refresh access token; `invalid_grant` → `reauth_required` |

## 6. Failure modes

- **Invalid/expired `state`** → 400 (CSRF protection).
- **`invalid_grant` on refresh** → account status `reauth_required`; user must reconnect (no retry loop).
- Missing `GOOGLE_CLIENT_*` or `APP_ENCRYPTION_KEY` → Gmail routes are not registered / connect fails with a clear message.

# Property Post Hub

Cloudflare Workers + D1 + R2 implementation.

## Architecture
- Worker API: `src/index.js`
- Static UI: `public/`
- Database: Cloudflare D1
- Property images: Cloudflare R2
- Authentication: HMAC-signed HttpOnly cookie using Worker secrets

## One-time Cloudflare setup

```bash
npm install
npx wrangler login
npm run db:create
npm run r2:create
```

Copy the D1 `database_id` returned by Cloudflare into `wrangler.jsonc`, replacing `REPLACE_WITH_D1_DATABASE_ID`.

Then:

```bash
npm run db:migrate:remote
npx wrangler secret put ADMIN_USER
npx wrangler secret put ADMIN_PASSWORD
npx wrangler secret put SESSION_SECRET
npm run deploy
```

Recommended values:
- `ADMIN_USER`: owner
- `ADMIN_PASSWORD`: a unique long password
- `SESSION_SECRET`: at least 32 random bytes

The deployed URL will normally be under `*.workers.dev` while `workers_dev` is enabled.

## Security / data notes
- Do not commit secrets.
- Upload accepts JPG, PNG and WebP only, max 8 MB each and 12 files/request.
- Admin-changing API calls reject cross-origin requests.
- Public visitors see only `published` properties.
- No Facebook scraping/import is performed. Keep the original public Facebook URL and image provenance for each listing.

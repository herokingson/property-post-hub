# Cloudflare deployment

The application has been migrated from Express/SQLite/local disk to native Cloudflare services.

- Worker: `src/index.js`
- D1 binding: `DB`
- R2 binding: `IMAGES`
- Static assets binding: `ASSETS`
- Database migration: `migrations/0001_init.sql`
- Configuration: `wrangler.jsonc`

Before the first deploy, create D1 and R2 resources, insert the real D1 database ID in `wrangler.jsonc`, apply the migration, and create the three secrets documented in README.

Do not put passwords or session secrets in `wrangler.jsonc`.

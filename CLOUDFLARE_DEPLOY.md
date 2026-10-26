# Cloudflare deployment status

This repository is NOT yet Cloudflare Workers-compatible.

Current backend uses Express, better-sqlite3, express-session in-memory store, and local filesystem uploads. Do not deploy it directly to Workers as a production app.

Required migration:
1. Move property records and admin identities to Cloudflare D1, with SQL migrations.
2. Move uploaded images to R2, validating file type and size, and keep provenance fields.
3. Replace express-session with secure signed cookies or Workers-compatible session storage; implement CSRF protection and rate limiting.
4. Adapt HTTP routes to Workers-compatible request handlers, and static assets to Workers Assets.
5. Add Wrangler config with D1 and R2 bindings and secret management.
6. Test CRUD, admin authorization, image upload, filters, responsive UI, and data persistence.
7. Create a GitHub repository, push this source, and connect it in Cloudflare Workers & Pages.

Do not commit credentials, databases, or user-uploaded images to Git. No real Facebook properties have been verified/imported.
